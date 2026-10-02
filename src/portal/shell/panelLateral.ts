// copiado de srtm-ui@a1df33a (src/portal/shell/panelLateral.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'

export const NAV_KEY = 'caja.nav'

// what the portal's tree keeps per browser tab (sessionStorage), like the workspace tabs: whether the panel is open,
// and which groups are (by key; a group not in it is open)
export interface EstadoNav {
  abierto?: boolean
  grupos?: Record<string, boolean>
}

export function leerNav(): EstadoNav {
  try {
    const valor: unknown = JSON.parse(sessionStorage.getItem(NAV_KEY) ?? '{}')
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as EstadoNav) : {}
  } catch {
    return {}
  }
}

export function guardarNav(cambio: EstadoNav) {
  try {
    sessionStorage.setItem(NAV_KEY, JSON.stringify({ ...leerNav(), ...cambio }))
  } catch {
    // storage full or blocked: the tree just does not remember
  }
}

// the prototype's narrow screen: there the tree starts folded, and folds on a pick
const estrecha = () => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1080px)').matches

// whether AppShell's lateral is open, for the header's menu button and the lateral. the classic one opens only on a
// phone, from the header, and closes on a pick. a foldable one (the portal's tree) is open or folded on any screen,
// remembered for the browser tab; a narrow screen starts it folded and folds it on a pick (not remembered: it is the
// screen's, not the user's). the header's button shows only while it is folded, so focus goes from one to the other
export function usePanelLateral(plegable: boolean) {
  const boton = useRef<HTMLButtonElement>(null)
  const [movil, setMovil] = useState(false)
  const [panel, setPanel] = useState(() => !estrecha() && leerNav().abierto !== false)

  const mover = (abrir: boolean) => {
    flushSync(() => setPanel(abrir))
    if (abrir) document.getElementById('sidebar')?.querySelector<HTMLElement>('a[href], button')?.focus()
    else boton.current?.focus()
  }
  const cambiar = (abrir: boolean) => {
    if (!plegable) return setMovil(abrir)
    mover(abrir)
    guardarNav({ abierto: abrir })
  }

  return {
    boton,
    abierto: plegable ? panel : movil,
    alternar: () => cambiar(!(plegable ? panel : movil)),
    plegar: () => cambiar(false),
    alNavegar: () => {
      if (!plegable) setMovil(false)
      else if (panel && estrecha()) mover(false)
    }
  }
}
