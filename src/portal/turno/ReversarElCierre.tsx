import { ApiError } from '@wasichai/core'
import { Alert, Input, Label, Textarea } from '@wasichai/ui'
import { Undo2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { OBSERVACION } from '../cobro/envio'
import { conError, ErrorDelCampo } from '../cobro/Formulario'
import { BotonConMotivo } from '../components/BotonConMotivo'
import { ConfirmarEscritura } from '../components/ConfirmarEscritura'
import { AvisoDeBorrador, SesionCaducada, useEscritura } from '../escritura/useEscritura'
import type { PeticionDeReversion, ReversionHecha, TurnoEnElDia } from '../types'
import { turnos } from './api'

// «Reversar el cierre»: leaves the cierre in force without effect and opens the turno again, so cobrar goes on in the
// same turno. the cierre is not erased: the reversal is added beside it. it asks for the motive (up to 80) and the
// observación, and is confirmed first. the turno's state is never set here: it is read again. a 401 keeps what was
// typed (useEscritura, reversion.<turno_id>)

export const CAMPOS_DE_LA_REVERSION = ['motivo', 'observacion'] as const
type Campo = (typeof CAMPOS_DE_LA_REVERSION)[number]

// caja-backend's motivo: not blank, up to 80
const MOTIVO = { maximo: 80 }
const ROTULOS: Record<string, string> = { caja: 'Caja', fecha: 'Fecha', cajero: 'Cajero' }

export function ReversarElCierre({
  turno,
  impedido,
  onReversado,
  onChoque
}: {
  // the turno chosen, when there is one: the screen mounts this again per turno, so its draft is that turno's
  turno: TurnoEnElDia | null
  impedido: string | null
  onReversado: (hecha: ReversionHecha) => void
  // a 409: nothing to reverse any more, or another reversal won: the turno is read again
  onChoque: () => void
}) {
  const { borrador, escribir } = useEscritura(`reversion.${turno?.turno_id ?? ''}`, CAMPOS_DE_LA_REVERSION)
  const [motivo, setMotivo] = useState(borrador?.motivo ?? '')
  const [observacion, setObservacion] = useState(borrador?.observacion ?? '')
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const pedir = (event: FormEvent) => {
    event.preventDefault()
    if (impedido) return
    const largo = observacion.trim().length
    const halladas: Partial<Record<Campo, string>> = {
      ...(motivo.trim() === ''
        ? { motivo: 'Escriba el motivo de la reversión.' }
        : motivo.trim().length > MOTIVO.maximo
          ? { motivo: `A lo sumo ${MOTIVO.maximo} caracteres.` }
          : {}),
      ...(largo >= OBSERVACION.minimo && largo <= OBSERVACION.maximo ? {} : { observacion: 'Explique la reversión: de 5 a 500 caracteres.' })
    }
    setErrores(halladas)
    setGeneral(null)
    if (Object.keys(halladas).length === 0) setConfirmando(true)
  }

  const contar = (e: unknown) => {
    const violaciones = e instanceof ApiError ? e.violations : []
    const propias = violaciones.filter((v): v is typeof v & { field: Campo } => (CAMPOS_DE_LA_REVERSION as readonly string[]).includes(v.field))
    const ajenas = violaciones.filter((v) => !(CAMPOS_DE_LA_REVERSION as readonly string[]).includes(v.field))
    setErrores(Object.fromEntries(propias.map((v) => [v.field, v.message])))
    if (ajenas.length > 0) setGeneral(ajenas.map((v) => `${ROTULOS[v.field] ?? v.field}: ${v.message}`).join(' · '))
    else if (propias.length === 0) setGeneral(errorMessage(e, 'No se pudo reversar el cierre'))
  }

  const reversar = async () => {
    if (!turno?.caja) return
    const peticion: PeticionDeReversion = { caja: turno.caja, fecha: turno.fecha, motivo: motivo.trim(), observacion: observacion.trim() }
    setEnviando(true)
    try {
      const hecha = await escribir({ motivo, observacion }, () => turnos.reversar(peticion))
      setMotivo('')
      setObservacion('')
      onReversado(hecha)
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

  const formulario = 'reversion-formulario'

  return (
    <section aria-labelledby="reversion-titulo" className="space-y-4">
      <h2 id="reversion-titulo" className="text-lg font-semibold text-ink">
        Reversar el cierre
      </h2>
      <p className="text-sm text-ink-muted">
        Reversar no borra el cierre: lo deja sin efecto y el turno vuelve a abrirse, para seguir cobrando en él. Solo se reversa el cierre del propio turno,
        desde la cuenta del cajero que lo cerró, y hace falta el permiso de reversión.
      </p>
      {borrador && !impedido && turno && <AvisoDeBorrador />}
      {!impedido && turno && (
        <form id={formulario} onSubmit={pedir} noValidate className="max-w-xl space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reversion-motivo">Motivo</Label>
            <Input
              id="reversion-motivo"
              autoComplete="off"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              {...conError('reversion-motivo', errores.motivo)}
            />
            <ErrorDelCampo id="reversion-motivo" error={errores.motivo} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reversion-observacion">Observación</Label>
            <Textarea
              id="reversion-observacion"
              rows={2}
              maxLength={OBSERVACION.maximo}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              {...conError('reversion-observacion', errores.observacion)}
            />
            <ErrorDelCampo id="reversion-observacion" error={errores.observacion} />
          </div>
        </form>
      )}
      {general && <Alert tone="danger">{general}</Alert>}
      <BotonConMotivo id="reversar-impedido" impedido={impedido} variante="danger" type="submit" form={formulario}>
        <Undo2 className="size-4" />
        Reversar el cierre
      </BotonConMotivo>
      {confirmando && turno && (
        <ConfirmarEscritura
          title="Confirmar la reversión"
          description={
            <>
              <span className="block">
                Se reversa el cierre del turno de la caja {turno.caja} del {formatDate(turno.fecha)}.
              </span>
              <span className="mt-2 block text-ink">Motivo: {motivo.trim()}</span>
              <span className="mt-2 block">
                El cierre no se borra: queda registrado, y el turno vuelve a abrirse para seguir cobrando. Al terminar, se cierra otra vez.
              </span>
            </>
          }
          confirmLabel="Reversar"
          cancelLabel="Volver"
          variant="danger"
          enviando={enviando}
          enviandoLabel="Reversando…"
          onConfirm={() => void reversar()}
          onCancel={() => setConfirmando(false)}
        />
      )}
    </section>
  )
}
