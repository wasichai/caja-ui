import { Button, ConfirmDialog, Label, Textarea } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { NativeSelect } from '../../kit/forms/NativeSelect'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Importe } from '../cifras/Importe'
import { Alerta } from '../components/Alerta'
import { etiqueta } from '../forms/etiquetas'
import { FORMAS_DE_PAGO, type VistaPrevia } from '../types'
import { OBSERVACION } from './envio'

// the pieces of a cobro's form that «Caja tributaria» and «Caja de tasas» share: the forma de pago, the observación,
// the total the backend previews, the button that is never mute and the confirmation (a cobro is not undone)

// a field's error under it, tied to its control
const idDelError = (id: string) => `${id}-error`
export const conError = (id: string, error: string | undefined) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? idDelError(id) : undefined
})

export function ErrorDelCampo({ id, error }: { id: string; error: string | undefined }) {
  return error ? (
    <p id={idDelError(id)} className="text-xs text-danger">
      {error}
    </p>
  ) : null
}

// the five forms of payment, with their etiqueta
export function CampoFormaDePago({ value, onChange, error }: { value: string; onChange: (valor: string) => void; error: string | undefined }) {
  const id = 'cobro-forma-pago'
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Forma de pago</Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} {...conError(id, error)}>
        <option value="">Elija la forma de pago</option>
        {FORMAS_DE_PAGO.map((valor) => (
          <option key={valor} value={valor}>
            {etiqueta('forma_pago', valor)}
          </option>
        ))}
      </NativeSelect>
      <ErrorDelCampo id={id} error={error} />
    </div>
  )
}

export function CampoObservacion({ value, onChange, error }: { value: string; onChange: (valor: string) => void; error: string | undefined }) {
  const id = 'cobro-observacion'
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Observación</Label>
      <Textarea id={id} rows={2} maxLength={OBSERVACION.maximo} value={value} onChange={(e) => onChange(e.target.value)} {...conError(id, error)} />
      <ErrorDelCampo id={id} error={error} />
    </div>
  )
}

// what the backend refused that no field of the form has, and the button: while it cannot cobrar, it says why at its
// side, never mute
export function PieDelCobro({ general, impedido, enviando }: { general: string | null; impedido: string | null; enviando: boolean }) {
  return (
    <>
      {general && <Alerta tono="error">{general}</Alerta>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {impedido && (
          <p id="cobro-impedido" className="text-sm text-ink-muted">
            {impedido}
          </p>
        )}
        <Button type="submit" disabled={impedido !== null || enviando} aria-describedby={impedido ? 'cobro-impedido' : undefined}>
          Cobrar
        </Button>
      </div>
    </>
  )
}

// why the preview keeps the cobro from going, or null: it failed, it has not come, or the backend says it cannot
export function impedimentoDeLaVistaPrevia(fallo: boolean, previa: VistaPrevia | undefined): string | null {
  if (fallo) return 'No se pudo pedir el total al backend: sin él no se cobra.'
  if (!previa) return 'Esperando el total del backend.'
  if (!previa.cobrable) return 'El backend dice que no se puede cobrar: vea los motivos de arriba.'
  return null
}

// the total of what is chosen, as the backend previews it, and what keeps it from being cobrable, said as it comes.
// `sinTotal`: why there is none when no line was left
export function TotalDeLaVistaPrevia({
  cargando,
  error,
  previa,
  sinTotal
}: {
  cargando: boolean
  error: unknown
  previa: VistaPrevia | undefined
  sinTotal: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        Total a cobrar:{' '}
        <span data-ui="total-a-cobrar" className="font-semibold">
          {error ? (
            <span className="font-normal text-danger">No se pudo pedir el total: {errorMessage(error, 'el backend no contestó')}</span>
          ) : cargando || !previa ? (
            <span className="font-normal text-ink-muted">pidiéndolo al backend…</span>
          ) : previa.total ? (
            <Importe cifra={previa.total} />
          ) : (
            <Importe cifra={{ importe: null, actualizado_a: null }} motivo={sinTotal} />
          )}
        </span>
      </p>
      {previa && previa.motivos.length > 0 && (
        <Alerta tono="atencion" titulo="No se puede cobrar.">
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {previa.motivos.map((motivo) => (
              <li key={motivo}>{motivo}</li>
            ))}
          </ul>
        </Alerta>
      )}
    </div>
  )
}

// the confirmation, with what is cobrado (the lines of the preview, as the screen lists them), the preview's total and
// the forma de pago. spans, not a list: the dialog's description is a paragraph
export function ConfirmarCobro({
  que,
  caja,
  forma,
  previa,
  enviando,
  onConfirm,
  onCancel,
  extra,
  children
}: {
  // "estas órdenes", "estas tasas"
  que: string
  caja: string
  forma: string
  previa: VistaPrevia
  enviando: boolean
  onConfirm: () => void
  onCancel: () => void
  // what the screen adds after the forma de pago (the payer), as spans
  extra?: ReactNode
  // a span role="listitem" per line
  children: ReactNode
}) {
  return (
    <ConfirmDialog
      title="Confirmar el cobro"
      description={
        <>
          <span className="block">
            Se cobran {que} en la caja {caja}:
          </span>
          <span role="list" className="mt-2 block space-y-1">
            {children}
          </span>
          {previa.total && (
            <span className="mt-2 block font-semibold text-ink">
              Total: <Importe cifra={previa.total} />
            </span>
          )}
          <span className="block text-ink">Forma de pago: {etiqueta('forma_pago', forma)}</span>
          {extra}
          <span className="mt-2 block">Un cobro no se deshace: para devolverlo hay que anular el recibo.</span>
        </>
      }
      confirmLabel="Cobrar"
      cancelLabel="Cancelar"
      variant="primary"
      busy={enviando}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
