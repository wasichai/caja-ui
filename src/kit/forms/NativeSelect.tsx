// copiado de srtm-ui@a1df33a (src/kit/forms/NativeSelect.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { cn } from '@wasichai/ui'
import type { ComponentProps } from 'react'
import { selectClass } from './styles'

// a native select, looking like @wasichai/ui's Input (selectClass). it wears the library's select-trigger slot, so a
// theme styles it as the library's selects
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="select-trigger" className={cn(selectClass, className)} {...props} />
}
