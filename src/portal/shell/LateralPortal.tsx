// copiado de srtm-ui@a1df33a (src/portal/shell/LateralPortal.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { NavTree } from '@wasichai/core'
import { useState } from 'react'
import type { LateralProps } from './comun'
import { useArbol } from './navTree'
import { guardarNav, leerNav } from './panelLateral'

// the portal's lateral: the screens of Tesorería the account is offered (useArbol) in core's NavTree, its groups
// remembered for the browser tab like the panel (usePanelLateral)
export function LateralPortal({ abierto, onNavegar, onPlegar }: LateralProps) {
  const nodos = useArbol()
  const [grupos, setGrupos] = useState(() => leerNav().grupos ?? {})

  const alternar = (clave: string) => {
    const siguientes = { ...grupos, [clave]: grupos[clave] === false }
    setGrupos(siguientes)
    guardarNav({ grupos: siguientes })
  }

  return (
    <NavTree
      id="sidebar"
      label="Secciones"
      title="Ventanilla"
      nodes={nodos}
      homeTo="/"
      open={abierto}
      groups={grupos}
      onToggleGroup={alternar}
      onNavigate={onNavegar}
      onFold={onPlegar}
    />
  )
}
