import { Button } from '@wasichai/ui'
import { useRouteError } from 'react-router'

// what the data router draws when something outside a leaf throws while drawing (the bar, the tree, the trail, the
// login): LimiteDeHoja holds a leaf's, this the rest. without it react-router draws its own page, in english and with
// the stack. like LimiteDeHoja it names what was thrown, which is what support needs; since the shell itself is what
// failed, the way on is to load the page again
export function FalloDeLaCaja() {
  const error = useRouteError()
  const mensaje = error instanceof Error ? error.message : String(error)
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-ink">La caja no se pudo dibujar</h1>
      <div role="alert" className="space-y-2 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
        <p className="text-ink">Vuelva a cargar la página. Si vuelve a pasar, avise a soporte con lo que dice abajo.</p>
        <p className="font-mono text-xs break-words text-ink-muted">{mensaje}</p>
      </div>
      <Button onClick={() => window.location.reload()}>Volver a cargar</Button>
    </main>
  )
}
