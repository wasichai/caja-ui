import { ApiError } from '@wasichai/core'
import { Button, ConfirmDialog, Label, Textarea } from '@wasichai/ui'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../kit/ui/errorMessage'
import { OBSERVACION } from '../cobro/envio'
import { conError, ErrorDelCampo } from '../cobro/Formulario'
import { Alerta } from '../components/Alerta'
import { AvisoDeBorrador, SesionCaducada, useEscritura } from '../escritura/useEscritura'
import { etiqueta } from '../forms/etiquetas'
import type { PagoDelBuzon, PeticionDeExplicacion } from '../types'
import { pagos } from './api'

// «Explicar» a payment that could not be delivered (MUERTO): someone takes charge of it in writing, and then its turno
// closes. it asks for the explanation (what happened and what was done: it stays in the event) and the observación (it
// stays in the audit), and is confirmed first, because it is not undone. the state is never set here: the payments and
// the arqueo are read again. a 401 keeps what was typed (useEscritura, explicacion.<pago_id>)

export const CAMPOS_DE_LA_EXPLICACION = ['explicacion', 'observacion'] as const
type Campo = (typeof CAMPOS_DE_LA_EXPLICACION)[number]

// the explanation: 5 to 500, trimmed (caja-backend asks at least 5 that are not spaces)
const EXPLICACION = { minimo: 5, maximo: 500 }
// how a field of the explanation the form has no control for reads above the button
const ROTULOS: Record<string, string> = { pago_id: 'Pago' }

const entre = (valor: string, { minimo, maximo }: { minimo: number; maximo: number }) => {
  const largo = valor.trim().length
  return largo >= minimo && largo <= maximo
}

// «Pago registrado a rentas, del recibo 001-0000001»
export function queEs(pago: PagoDelBuzon): string {
  const recibo = pago.recibo ? `del recibo ${pago.recibo}` : 'cuyo recibo no se pudo leer'
  return `${etiqueta('tipo_evento_pago', pago.tipo)} a ${pago.destino}, ${recibo}`
}

export function ExplicarElPago({
  pago,
  onCerrar,
  onExplicado,
  onChoque
}: {
  // the payment of the row: the block mounts this again per payment, so its draft is that payment's
  pago: PagoDelBuzon
  onCerrar: () => void
  onExplicado: (hecho: PagoDelBuzon) => void
  // a 409: the payment is not MUERTO any more (delivered, or explained by someone else): it is read again
  onChoque: () => void
}) {
  const id = pago.pago_id
  const { borrador, escribir, cancelar } = useEscritura(`explicacion.${id}`, CAMPOS_DE_LA_EXPLICACION)
  const [explicacion, setExplicacion] = useState(borrador?.explicacion ?? '')
  const [observacion, setObservacion] = useState(borrador?.observacion ?? '')
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const pedir = (event: FormEvent) => {
    event.preventDefault()
    const halladas: Partial<Record<Campo, string>> = {
      ...(entre(explicacion, EXPLICACION) ? {} : { explicacion: 'Diga qué pasó con el pago y qué se hizo: de 5 a 500 caracteres.' }),
      ...(entre(observacion, OBSERVACION) ? {} : { observacion: 'Explique por qué se registra: de 5 a 500 caracteres.' })
    }
    setErrores(halladas)
    setGeneral(null)
    if (Object.keys(halladas).length === 0) setConfirmando(true)
  }

  const contar = (e: unknown) => {
    const violaciones = e instanceof ApiError ? e.violations : []
    const esCampo = (campo: string): campo is Campo => (CAMPOS_DE_LA_EXPLICACION as readonly string[]).includes(campo)
    const propias = violaciones.filter((v) => esCampo(v.field))
    const ajenas = violaciones.filter((v) => !esCampo(v.field))
    setErrores(Object.fromEntries(propias.map((v) => [v.field, v.message])))
    if (ajenas.length > 0) setGeneral(ajenas.map((v) => `${ROTULOS[v.field] ?? v.field}: ${v.message}`).join(' · '))
    else if (propias.length === 0) setGeneral(errorMessage(e, 'No se pudo explicar el pago'))
  }

  const explicar = async () => {
    const peticion: PeticionDeExplicacion = { explicacion: explicacion.trim(), observacion: observacion.trim() }
    setEnviando(true)
    try {
      const hecho = await escribir({ explicacion, observacion }, () => pagos.explicar(id, peticion))
      onExplicado(hecho)
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

  const prefijo = `explicacion-${id}`

  return (
    <section aria-labelledby={`${prefijo}-titulo`} className="space-y-4 rounded-md border border-border p-4">
      <h3 id={`${prefijo}-titulo`} className="text-sm font-semibold text-ink">
        Explicar el pago {id}
      </h3>
      <p className="text-sm text-ink-muted">
        {queEs(pago)}. Explicar no lo entrega: deja escrito qué pasó con el pago y qué se hizo, el pago deja de intentarse y su turno puede cerrar.
      </p>
      {borrador && <AvisoDeBorrador />}
      <form onSubmit={pedir} noValidate className="max-w-xl space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefijo}-explicacion`}>Explicación</Label>
          <Textarea
            id={`${prefijo}-explicacion`}
            rows={3}
            maxLength={EXPLICACION.maximo}
            value={explicacion}
            onChange={(e) => setExplicacion(e.target.value)}
            {...conError(`${prefijo}-explicacion`, errores.explicacion)}
          />
          <ErrorDelCampo id={`${prefijo}-explicacion`} error={errores.explicacion} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefijo}-observacion`}>Observación</Label>
          <Textarea
            id={`${prefijo}-observacion`}
            rows={2}
            maxLength={OBSERVACION.maximo}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            {...conError(`${prefijo}-observacion`, errores.observacion)}
          />
          <ErrorDelCampo id={`${prefijo}-observacion`} error={errores.observacion} />
        </div>
        {general && <Alerta tono="error">{general}</Alerta>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              cancelar()
              onCerrar()
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Registrar la explicación
          </Button>
        </div>
      </form>
      {confirmando && (
        <ConfirmDialog
          title="Confirmar la explicación"
          description={
            <>
              <span className="block">
                Se explica el pago {id}: {queEs(pago)}.
              </span>
              <span className="mt-2 block text-ink">Explicación: {explicacion.trim()}</span>
              <span className="mt-2 block">
                No se deshace: el pago pasa a «{etiqueta('estado_evento', 'EXPLICADO')}», ya no se intenta entregar a su sistema de origen, y su turno puede
                cerrar.
              </span>
            </>
          }
          confirmLabel="Explicar"
          cancelLabel="Volver"
          variant="primary"
          busy={enviando}
          onConfirm={() => void explicar()}
          onCancel={() => setConfirmando(false)}
        />
      )}
    </section>
  )
}
