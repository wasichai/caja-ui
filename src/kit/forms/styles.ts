// copiado de srtm-ui@a1df33a (src/kit/forms/styles.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// a native select, looking like @wasichai/ui's Input
export const selectClass =
  'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted aria-[invalid=true]:border-danger'

// span on the six-column grid -> tailwind classes (literal, so tailwind sees them)
export const SPAN: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'sm:col-span-2 lg:col-span-2',
  3: 'sm:col-span-2 lg:col-span-3',
  4: 'sm:col-span-2 lg:col-span-4',
  6: 'sm:col-span-2 lg:col-span-6'
}

export const GRID = 'grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-6'
