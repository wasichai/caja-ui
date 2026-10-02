import { ApiError } from '@wasichai/core'
import { ConfirmDialog, Input, Label, Textarea } from '@wasichai/ui'
import { Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { OBSERVACION } from '../cobro/envio'
import { conError, ErrorDelCampo } from '../cobro/Formulario'
import { Alerta } from '../components/Alerta'
import { BotonConMotivo } from '../components/BotonConMotivo'
import { AvisoDeBorrador, SesionCaducada, useEscritura } from '../escritura/useEscritura'
import { etiqueta } from '../forms/etiquetas'
import { FORMAS_DE_PAGO, type CierreHecho, type FormaDePago, type PeticionDeCierre, type TurnoEnElDia } from '../types'
import { turnos } from './api'
import { SIN_DECLARAR } from './Arqueo'

// «Cerrar el turno»: what was counted in the drawer by forma de pago, typed as text and sent as the exact string typed
// (never a Number, never the kit's money nor decimal kinds), and why. the difference is not worked out here: the
// backend gives it in the acta. it is not undone, so it is confirmed first. a 401 keeps what was typed
// (useEscritura, cierre.<turno_id>); a 409 reads the turno again (closed meanwhile, payments not delivered)

// what a 401 keeps: each declared amount, as typed, and the observación
const DECLARADO = (forma: FormaDePago) => `declarado.${forma}`
export const CAMPOS_DEL_CIERRE = [...FORMAS_DE_PAGO.map(DECLARADO), 'observacion'] as const

// caja-backend's declared amount: no sign, up to 13 whole digits and 2 decimals, with a point. checked as text: nothing
// here turns it into a number
const IMPORTE_DECLARADO = /^\d{1,13}(\.\d{1,2})?$/
const NO_ES_IMPORTE = 'Escriba el importe sin signo, con punto decimal y a lo sumo 2 decimales (por ejemplo 120.50).'

// how a field of the cierre the form has no control for reads above the button
const ROTULOS: Record<string, string> = { caja: 'Caja', fecha: 'Fecha', cajero: 'Cajero' }

interface Errores {
  declarado?: string
  observacion?: string
  porForma: Partial<Record<FormaDePago, string>>
}

const vacio = (): Errores => ({ porForma: {} })

export function CerrarElTurno({
  turno,
  impedido,
  onCerrado,
  onChoque
}: {
  // the turno chosen, when there is one: the screen mounts this again per turno, so its draft is that turno's
  turno: TurnoEnElDia | null
  impedido: string | null
  onCerrado: (hecho: CierreHecho) => void
  // a 409: the turno is not what the screen says any more, so it is read again
  onChoque: () => void
}) {
  const { borrador, escribir } = useEscritura(`cierre.${turno?.turno_id ?? ''}`, CAMPOS_DEL_CIERRE)
  const [declarados, setDeclarados] = useState<Record<FormaDePago, string>>(
    () => Object.fromEntries(FORMAS_DE_PAGO.map((forma) => [forma, borrador?.[DECLARADO(forma)] ?? ''])) as Record<FormaDePago, string>
  )
  const [observacion, setObservacion] = useState(borrador?.observacion ?? '')
  const [errores, setErrores] = useState<Errores>(vacio)
  const [general, setGeneral] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // what is sent: only what was typed, trimmed and otherwise as it is
  const tecleados = FORMAS_DE_PAGO.filter((forma) => declarados[forma].trim() !== '')
  const sinDeclarar = FORMAS_DE_PAGO.filter((forma) => declarados[forma].trim() === '')

  const pedir = (event: FormEvent) => {
    event.preventDefault()
    if (impedido) return
    const porForma = Object.fromEntries(
      tecleados.flatMap((forma) => (IMPORTE_DECLARADO.test(declarados[forma].trim()) ? [] : [[forma, NO_ES_IMPORTE]]))
    ) as Errores['porForma']
    const largo = observacion.trim().length
    const halladas: Errores = {
      porForma,
      ...(largo >= OBSERVACION.minimo && largo <= OBSERVACION.maximo ? {} : { observacion: 'Explique el cierre: de 5 a 500 caracteres.' })
    }
    setErrores(halladas)
    setGeneral(null)
    if (Object.keys(porForma).length === 0 && !halladas.observacion) setConfirmando(true)
  }

  const contar = (e: unknown) => {
    const violaciones = e instanceof ApiError ? e.violations : []
    const declarado = violaciones.filter((v) => v.field === 'declarado').map((v) => v.message)
    const deObservacion = violaciones.find((v) => v.field === 'observacion')?.message
    const ajenas = violaciones.filter((v) => v.field !== 'declarado' && v.field !== 'observacion')
    setErrores({ porForma: {}, ...(declarado.length > 0 ? { declarado: declarado.join(' · ') } : {}), observacion: deObservacion })
    if (ajenas.length > 0) setGeneral(ajenas.map((v) => `${ROTULOS[v.field] ?? v.field}: ${v.message}`).join(' · '))
    else if (violaciones.length === 0) setGeneral(errorMessage(e, 'No se pudo cerrar el turno'))
  }

  const cerrar = async () => {
    if (!turno?.caja) return
    const peticion: PeticionDeCierre = {
      caja: turno.caja,
      fecha: turno.fecha,
      declarado: Object.fromEntries(tecleados.map((forma) => [forma, declarados[forma].trim()])),
      observacion: observacion.trim()
    }
    const tecleado = { ...Object.fromEntries(FORMAS_DE_PAGO.map((forma) => [DECLARADO(forma), declarados[forma]])), observacion }
    setEnviando(true)
    try {
      const hecho = await escribir(tecleado, () => turnos.cerrar(peticion))
      setDeclarados(Object.fromEntries(FORMAS_DE_PAGO.map((forma) => [forma, ''])) as Record<FormaDePago, string>)
      setObservacion('')
      onCerrado(hecho)
    } catch (e) {
      // a 401: the draft is kept and the login says so
      if (!(e instanceof SesionCaducada)) {
        contar(e)
        if (e instanceof ApiError && e.status === 409) onChoque()
      }
    } finally {
      setEnviando(false)
      setConfirmando(false)
    }
  }

  const formulario = 'cierre-formulario'

  return (
    <section aria-labelledby="cierre-titulo" className="space-y-4">
      <h2 id="cierre-titulo" className="text-lg font-semibold text-ink">
        Cerrar el turno
      </h2>
      {borrador && !impedido && turno && <AvisoDeBorrador />}
      {!impedido && turno && (
        <form id={formulario} onSubmit={pedir} noValidate className="max-w-3xl space-y-4">
          <fieldset className="space-y-3" {...conError('cierre-declarado', errores.declarado)}>
            <legend className="text-sm font-semibold text-ink">Lo declarado</legend>
            <p className="text-sm text-ink-muted">
              Lo que contó en el cajón, por forma de pago. Lo que deje en blanco, el backend lo cierra en cero. La diferencia la calcula el backend al cerrar:
              se ve en el acta del cierre.
            </p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {FORMAS_DE_PAGO.map((forma) => {
                const id = `cierre-declarado-${forma}`
                return (
                  <div key={forma} className="space-y-1.5">
                    <Label htmlFor={id}>Declarado en {etiqueta('forma_pago', forma)}</Label>
                    <Input
                      id={id}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={SIN_DECLARAR}
                      value={declarados[forma]}
                      onChange={(e) => setDeclarados((antes) => ({ ...antes, [forma]: e.target.value }))}
                      {...conError(id, errores.porForma[forma])}
                    />
                    <ErrorDelCampo id={id} error={errores.porForma[forma]} />
                  </div>
                )
              })}
            </div>
            <ErrorDelCampo id="cierre-declarado" error={errores.declarado} />
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="cierre-observacion">Observación</Label>
            <Textarea
              id="cierre-observacion"
              rows={2}
              maxLength={OBSERVACION.maximo}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              {...conError('cierre-observacion', errores.observacion)}
            />
            <ErrorDelCampo id="cierre-observacion" error={errores.observacion} />
          </div>
        </form>
      )}
      {general && <Alerta tono="error">{general}</Alerta>}
      <BotonConMotivo id="cerrar-impedido" impedido={impedido} variante="primary" type="submit" form={formulario}>
        <Lock className="size-4" />
        Cerrar el turno
      </BotonConMotivo>
      {confirmando && turno && (
        <ConfirmDialog
          title="Confirmar el cierre"
          description={
            <>
              <span className="block">
                Se cierra el turno de la caja {turno.caja} del {formatDate(turno.fecha)} con lo que usted contó:
              </span>
              <span role="list" className="mt-2 block space-y-1">
                {tecleados.map((forma) => (
                  <span role="listitem" key={forma} className="block text-ink">
                    {etiqueta('forma_pago', forma)}: {declarados[forma].trim()}
                  </span>
                ))}
              </span>
              {sinDeclarar.length > 0 && (
                <span className="mt-2 block">
                  Sin declarar, el backend las cierra en cero: {sinDeclarar.map((forma) => etiqueta('forma_pago', forma)).join(', ')}.
                </span>
              )}
              <span className="mt-2 block">
                La diferencia la calcula el backend al cerrar, y se ve en el acta. Un cierre no se modifica: si hay que rehacerlo, se reversa desde esta misma
                cuenta, con el permiso de reversión, y se cierra otra vez.
              </span>
            </>
          }
          confirmLabel="Cerrar el turno"
          cancelLabel="Volver"
          variant="primary"
          busy={enviando}
          onConfirm={() => void cerrar()}
          onCancel={() => setConfirmando(false)}
        />
      )}
    </section>
  )
}
