import { ConfirmDialog, type ConfirmDialogProps } from '@wasichai/ui'

// the confirmation of an act that writes, none of which is undone (caja ADR-0044). once confirmed the write is on its
// way and nothing calls it back: «Volver», Escape, the X or a click outside would only hide the dialog, while the act
// still landed (or its refusal was lost). so, while it has no answer, they wait, and the dialog says why. the status
// line is there from the start, empty, so a screen reader hears it when it fills. upstream: ConfirmDialog's busy
// should hold the cancel too (wasichai-ui)
export function ConfirmarEscritura({
  enviando,
  enviandoLabel,
  confirmLabel,
  description,
  onCancel,
  ...props
}: Omit<ConfirmDialogProps, 'busy'> & {
  enviando: boolean
  // the confirm button while the write has no answer: «Cobrando…»
  enviandoLabel: string
}) {
  return (
    <ConfirmDialog
      {...props}
      description={
        <>
          {description}
          <span role="status" className={enviando ? 'mt-2 block font-semibold text-ink' : 'block'}>
            {enviando && 'Se envió al backend: espere su respuesta, ya no se puede volver atrás.'}
          </span>
        </>
      }
      confirmLabel={enviando ? enviandoLabel : confirmLabel}
      busy={enviando}
      onCancel={() => {
        if (!enviando) onCancel()
      }}
    />
  )
}
