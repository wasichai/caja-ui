import { ApiError } from '@wasichai/core'
import { useRef, useState } from 'react'
import { errorMessage } from '../../kit/ui/errorMessage'
import { SesionCaducada, useEscritura } from '../escritura/useEscritura'
import { claveDelIntento, type Intento } from './intento'

// how a cobro is sent, shared by «Caja tributaria» and «Caja de tasas»: one Idempotency-Key per attempt (intento.ts),
// a 401 that keeps the draft (useEscritura), and the backend's refusal told where it belongs: a 400 under its field, or
// above the button when the form has no control for it; any other, with its detail.
//
// an attempt with no answer (the network failed, an answer that cannot be read, a 5xx or a 408) may have been charged:
// the form says it is not known (NO_SE_SABE), and while it says so every cobro goes with that attempt's key, even if
// the clerk changes the orders, the lines or any field. caja-backend answers a key that already names a recibo with
// that recibo (200, emitido false) whatever the body (caja-backend's Ventanilla): so the first is never charged twice,
// and if it was not charged, what is on screen is, once. editing is not blocked: nothing typed is lost, and blocking
// would still leave a key no one can change. only an answered cobro (2xx) says what happened; a refusal of a later
// attempt (a 400) says nothing of the first, and the notice stays. the clerk may let the key go on purpose, once they
// checked in «Duplicado de recibo» that it was not charged, or that it was annulled (OTRO_COBRO)

// caja-backend's Observacion: trimmed, 5 to 500 characters
export const OBSERVACION = { minimo: 5, maximo: 500 }

export const NO_SE_SABE =
  'No se sabe si se cobró: vuelva a pulsar Cobrar sin cambiar nada (se reconoce el mismo intento), o busque el recibo en Duplicado de recibo.'
export const MISMO_INTENTO =
  'Si cambia algo antes de volver a cobrar, sale con el mismo intento: si el anterior sí se cobró, el backend devuelve ese recibo y no cobra otra vez.'
export const OTRO_COBRO = 'Ya lo revisé: es un cobro nuevo'

// whether a failed cobro may have been charged: no answer, one that could not be read, or the backend's (or a proxy's)
// failure halfway. a 4xx is the backend refusing it before charging
function sinDesenlace(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true
  return e.status >= 500 || e.status === 408
}

// what happened to it, in words: the backend's detail, or that no answer came (and the browser's reason)
function loQuePaso(e: unknown): string {
  if (e instanceof ApiError) return errorMessage(e, `el backend contestó ${e.status}`)
  const motivo = e instanceof Error ? e.message.trim() : ''
  return motivo ? `no llegó la respuesta del backend (${motivo})` : 'no llegó la respuesta del backend'
}

// what both forms check before asking: a forma de pago, and an observación of 5 to 500 characters
export function validarCobro(forma: string, observacion: string): { forma_pago?: string; observacion?: string } {
  const largo = observacion.trim().length
  return {
    ...(forma ? {} : { forma_pago: 'Elija la forma de pago.' }),
    ...(largo >= OBSERVACION.minimo && largo <= OBSERVACION.maximo ? {} : { observacion: 'Explique el cobro: de 5 a 500 caracteres.' })
  }
}

export function useEnvioDelCobro<Campo extends string>({
  acto,
  borradorDe,
  controles,
  rotular
}: {
  // the draft's key, and what of the typed values a 401 keeps (module constants: useEscritura's callbacks depend on them)
  acto: string
  borradorDe: readonly string[]
  // the fields the form has a control for: a 400 on one goes under it
  controles: readonly Campo[]
  // how a field with no control reads above the button
  rotular: (campo: string) => string
}) {
  const { borrador, escribir } = useEscritura(acto, borradorDe)
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const intento = useRef<Intento | null>(null)
  // what happened to the attempt whose outcome is not known (its key stays while this is not null), or null
  const [incierto, setIncierto] = useState<string | null>(null)

  // the form's own check, before the confirmation: whether it found nothing
  const revisar = (halladas: Partial<Record<Campo, string>>) => {
    setErrores(halladas)
    setGeneral(null)
    return Object.keys(halladas).length === 0
  }

  const esControl = (campo: string): campo is Campo => (controles as readonly string[]).includes(campo)

  const contar = (e: unknown) => {
    const violaciones = e instanceof ApiError ? e.violations : []
    const propias = violaciones.filter((v) => esControl(v.field))
    const ajenas = violaciones.filter((v) => !esControl(v.field))
    setErrores(Object.fromEntries(propias.map((v) => [v.field, v.message])) as Partial<Record<Campo, string>>)
    if (ajenas.length > 0) setGeneral(ajenas.map((v) => `${rotular(v.field)}: ${v.message}`).join(' · '))
    else if (propias.length === 0) setGeneral(errorMessage(e, 'No se pudo cobrar'))
  }

  // sends `cuerpo` with the attempt's key (the same one when the same body is sent again). what it answered, or null:
  // the session expired (the draft of `tecleado` is kept and the login says so), or it failed and the form says why
  const enviar = async <Hecho>(cuerpo: object, tecleado: object, mandar: (clave: string) => Promise<Hecho>): Promise<Hecho | null> => {
    intento.current = claveDelIntento(intento.current, cuerpo, incierto !== null)
    const { clave } = intento.current
    setEnviando(true)
    try {
      const hecho = await escribir(tecleado, () => mandar(clave))
      setIncierto(null)
      return hecho
    } catch (e) {
      if (e instanceof SesionCaducada) return null
      if (sinDesenlace(e)) {
        setErrores({})
        setGeneral(null)
        setIncierto(loQuePaso(e))
      } else contar(e)
      return null
    } finally {
      setEnviando(false)
    }
  }

  // the clerk checked that the attempt was not charged (or was annulled): the next cobro is another one, with a new key
  const olvidarIntento = () => {
    intento.current = null
    setIncierto(null)
  }

  return { borrador, errores, general, incierto, enviando, revisar, enviar, olvidarIntento }
}
