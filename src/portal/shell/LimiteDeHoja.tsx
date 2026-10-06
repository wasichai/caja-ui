import { Button } from '@wasichai/ui'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  // what, on changing, tries the drawing again: the leaf's route (path and query). another leaf, or the same one with
  // something else picked in its route, draws afresh
  reinicio: string
}

interface Estado {
  error: Error | null
}

// the net under each screen: what a screen throws while drawing stays in it. without it the data router takes the
// error and draws its own page instead of the whole shell, so the bar, the tree and the session go and the clerk
// cannot even move to another leaf. one over the shell's outlet: the screen goes down, the rest stays.
// a class, since react has no other way to catch what a render throws
export class LimiteDeHoja extends Component<Props, Estado> {
  override state: Estado = { error: null }

  static getDerivedStateFromError(error: unknown): Estado {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // on the console, with the component stack: where whoever debugs looks for it
    console.error('Una pantalla de la caja no se pudo dibujar', error, info.componentStack)
  }

  override componentDidUpdate(anteriores: Props) {
    if (this.state.error && anteriores.reinicio !== this.props.reinicio) this.setState({ error: null })
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    // it names what was thrown: it is what support needs to find it. what failed once may not fail again (a figure
    // read again, a moment later), and the same leaf in the menu is the same route, which tries nothing: so a button
    return (
      <div role="alert" className="space-y-2 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
        <p className="font-semibold">Esta pantalla no se pudo dibujar</p>
        <p className="text-ink">
          El resto de la caja sigue en pie: puede volver a intentarlo o elegir otra opción del menú. Si vuelve a pasar, avise a soporte con el nombre de esta
          pantalla y lo que dice abajo.
        </p>
        <p className="font-mono text-xs break-words text-ink-muted">{error.message}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => this.setState({ error: null })}>
          Volver a intentar
        </Button>
      </div>
    )
  }
}
