// copiado de srtm-ui@a1df33a (src/portal/components/Alerta.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { cn } from '@wasichai/ui'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export type TonoAlerta = 'exito' | 'atencion' | 'error' | 'aviso'

// the classic look: the text in its tone's colour. the box of the prototype (soft background, border, padding) is
// portal-tributario's alone (a theme partial paints it by data-ui and data-tono), so light and dark look as before
const TEXTO: Record<TonoAlerta, string> = {
  exito: 'text-success',
  atencion: 'text-warning',
  error: 'text-danger',
  aviso: 'text-notice'
}

// a message with a tone: an error interrupts (alert), the rest is announced politely (status). className is what the
// place adds to the classic look (a box, a margin, the alignment)
export function Alerta({
  tono,
  titulo,
  children,
  onCerrar,
  className
}: {
  tono: TonoAlerta
  // in bold at the start: "Atención.", "La sesión caducó."
  titulo?: ReactNode
  children: ReactNode
  onCerrar?: () => void
  className?: string
}) {
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} data-ui="alerta" data-tono={tono} className={cn('text-sm', TEXTO[tono], className)}>
      <span data-ui="alerta-texto">
        {titulo && <strong className="font-bold">{titulo}</strong>}
        {titulo && ' '}
        {children}
      </span>
      {onCerrar && (
        <button
          type="button"
          data-ui="alerta-cerrar"
          aria-label="Entendido, cerrar el aviso"
          onClick={onCerrar}
          className="ml-2 inline-flex rounded p-0.5 align-middle opacity-80 hover:opacity-100"
        >
          <Check className="size-4" />
        </button>
      )}
    </div>
  )
}
