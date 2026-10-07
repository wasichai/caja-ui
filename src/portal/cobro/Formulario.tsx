import { Alert, Button, Label, Textarea } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { NativeSelect } from '../../kit/forms/NativeSelect'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Importe, SinDato } from '../cifras/Importe'
import { ConfirmarEscritura } from '../components/ConfirmarEscritura'
import { conError, ErrorDelCampo, OBSERVACION } from '../forms/campos'
import { etiqueta } from '../forms/etiquetas'
import { FORMAS_DE_PAGO, type VistaPrevia } from '../types'
import { MISMO_INTENTO, NO_SE_SABE, OTRO_COBRO } from './envio'

// the pieces of a cobro's form that «Caja tributaria» and «Caja de tasas» share: the forma de pago, the observación,
// the total the backend previews, the button that is never mute and the confirmation (a cobro is not undone)

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

// what the backend refused that no field of the form has, an attempt whose outcome is not known (envio.ts), and the
// button: while it cannot cobrar, it says why at its side, never mute
export function PieDelCobro({
  general,
  incierto,
  onOtroCobro,
  impedido,
  enviando
}: {
  general: string | null
  // what happened to the attempt that may have been charged, or null
  incierto: string | null
  onOtroCobro: () => void
  impedido: string | null
  enviando: boolean
}) {
  return (
    <>
      {incierto && (
        <Alert tone="danger">
          <span className="block font-semibold">{NO_SE_SABE}</span>
          <span className="mt-1 block">{MISMO_INTENTO}</span>
          <span className="mt-1 block">Lo que pasó: {incierto}.</span>
          <span className="mt-2 flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={onOtroCobro} aria-describedby="cobro-otro-cobro">
              {OTRO_COBRO}
            </Button>
            <span id="cobro-otro-cobro" className="text-xs">
              Solo si en Duplicado de recibo vio que no se cobró, o que se anuló: el siguiente cobro irá como uno nuevo.
            </span>
          </span>
        </Alert>
      )}
      {general && <Alert tone="danger">{general}</Alert>}
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

// a total that is not asked for (what is chosen cannot be sent yet): it says why in its place, never vanishes
export function TotalSinPedir({ motivo }: { motivo: string }) {
  return (
    <p className="text-sm text-ink">
      Total a cobrar:{' '}
      <span data-ui="total-a-cobrar">
        <SinDato motivo={motivo} />
      </span>
    </p>
  )
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
        <Alert tone="warning" title="No se puede cobrar.">
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {previa.motivos.map((motivo) => (
              <li key={motivo}>{motivo}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  )
}

// the confirmation, with what is cobrado (the lines of the preview, as the screen lists them), the preview's total and
// the forma de pago. spans, not a list: the dialog's description is a paragraph. the lines scroll in their own box (a
// year of arbitrios is a long list), so the total and «Cobrar» stay in view; the box takes the focus, or a keyboard
// could not scroll it
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
    <ConfirmarEscritura
      title="Confirmar el cobro"
      description={
        <>
          <span className="block">
            Se cobran {que} en la caja {caja}:
          </span>
          <span role="list" aria-label="Lo que se cobra" tabIndex={0} className="mt-2 block max-h-[40vh] space-y-1 overflow-y-auto">
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
      enviando={enviando}
      enviandoLabel="Cobrando…"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
