import { Button } from '@wasichai/ui'
import type { ComponentProps, ReactNode } from 'react'

// a button that is never mute (caja ADR-0044): while it cannot go, it says why at its side, and the reason is its
// accessible description. `form` ties a submit to a form drawn elsewhere; `nombre`, its accessible name when the text
// alone does not say which (a button per row)
export function BotonConMotivo({
  id,
  nombre,
  impedido,
  onClick,
  variante,
  type = 'button',
  form,
  children
}: {
  id: string
  nombre?: string
  impedido: string | null
  onClick?: () => void
  variante: ComponentProps<typeof Button>['variant']
  type?: 'button' | 'submit'
  form?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {impedido && (
        <p id={id} className="max-w-xl text-right text-sm text-ink-muted">
          {impedido}
        </p>
      )}
      <Button
        type={type}
        form={form}
        variant={variante}
        disabled={impedido !== null}
        aria-label={nombre}
        aria-describedby={impedido ? id : undefined}
        onClick={onClick}
      >
        {children}
      </Button>
    </div>
  )
}
