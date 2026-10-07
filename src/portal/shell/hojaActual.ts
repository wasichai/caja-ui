import { currentNavTreeLeaf, useWasichaiConfig } from '@wasichai/core'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { NAV_TREE } from './navTree'

// the leaf on screen, said. the browser tab is named by it, so history and tabs stop reading «Caja» for every screen
// (WCAG 2.4.2). and when the clerk moves to another leaf the focus goes to its heading: a screen reader says where it
// landed, a keyboard goes on from there, and the content's scroll box starts at the top instead of where the last leaf
// was left. only the leaf counts: its query (filters, the recibo chosen) moves nothing, and the first drawing keeps
// the browser's focus. leaving the shell (signing out) gives the tab its plain name back
export function useHojaActual() {
  const { pathname } = useLocation()
  const appName = useWasichaiConfig().appName ?? 'Caja'
  // «/» is home, never the tree's «Ir al inicio»; an address of no leaf is its own
  const hoja = pathname === '/' ? undefined : currentNavTreeLeaf(NAV_TREE, pathname)
  const titulo = pathname === '/' ? 'Inicio' : hoja?.label
  const clave = hoja?.to ?? pathname

  useEffect(() => {
    document.title = titulo ? `${titulo} · ${appName}` : appName
    return () => {
      document.title = appName
    }
  }, [titulo, appName])

  const anterior = useRef(clave)
  useEffect(() => {
    if (anterior.current === clave) return
    anterior.current = clave
    // the screen is drawn by now: its h1, or the content when it has none (a leaf the account may not open)
    const destino = document.querySelector<HTMLElement>('#content h1') ?? document.getElementById('content')
    if (!destino) return
    destino.tabIndex = -1
    destino.focus()
  }, [clave])
}
