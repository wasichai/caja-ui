// copiado de srtm-ui@a1df33a (src/portal/shell/comun.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import type { ComponentType } from 'react'
import type { Cuenta } from '../queries'

// what both shells (AppShell's classic one and PortalShell) share

// the lateral gets whether it is open (the header's menu button, usePanelLateral) and tells a pick, which may close
// it; a foldable one (the portal's tree) has its own button to fold it
export interface LateralProps {
  abierto: boolean
  onNavegar: () => void
  onPlegar: () => void
}

// what a variant of the shell draws inside AppShell's frame: class names of the frame's own elements (over their
// classic look where the name says so) and its pieces
export interface PiezasShell {
  cabecera: string
  botonMenu: string
  // the lateral folds on any screen, remembered for the browser tab, and the header's menu button shows only while
  // it is folded (the portal's tree). otherwise it is the classic phone menu
  plegable?: boolean
  // the theme button, over its classic look
  tema?: string
  admin: string
  Marca: ComponentType
  Sesion: ComponentType
  Lateral: ComponentType<LateralProps>
  Pie?: ComponentType
}

// how the bar writes the account (useCuenta): its name and initials, its email once known
export function rotuloDeCuenta(cuenta: Cuenta): { nombre: string; iniciales: string; correo: string | null } {
  if (cuenta.estado === 'conocida') return { nombre: cuenta.nombre, iniciales: initials(cuenta.nombre), correo: cuenta.correo }
  return { nombre: cuenta.estado === 'cargando' ? 'Cargando la cuenta…' : 'No se conoce la cuenta', iniciales: '?', correo: null }
}

export function initials(name: string): string {
  const parts = name.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
