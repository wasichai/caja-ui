import { ApiError } from '@wasichai/core'
import { useRef, useState } from 'react'
import { errorMessage } from '../../kit/ui/errorMessage'
import { SesionCaducada, useEscritura } from '../escritura/useEscritura'
import { claveDelIntento, type Intento } from './intento'

// how a cobro is sent, shared by «Caja tributaria» and «Caja de tasas»: one Idempotency-Key per attempt (intento.ts),
// a 401 that keeps the draft (useEscritura), and the backend's refusal told where it belongs: a 400 under its field, or
// above the button when the form has no control for it; any other, with its detail

// caja-backend's Observacion: trimmed, 5 to 500 characters
export const OBSERVACION = { minimo: 5, maximo: 500 }

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
    intento.current = claveDelIntento(intento.current, cuerpo)
    const { clave } = intento.current
    setEnviando(true)
    try {
      return await escribir(tecleado, () => mandar(clave))
    } catch (e) {
      if (!(e instanceof SesionCaducada)) contar(e)
      return null
    } finally {
      setEnviando(false)
    }
  }

  return { borrador, errores, general, enviando, revisar, enviar }
}
