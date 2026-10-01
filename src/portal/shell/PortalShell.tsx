// copiado de srtm-ui@a1df33a (src/portal/shell/PortalShell.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { useWasichaiConfig } from '@wasichai/core'
import { Landmark } from 'lucide-react'
import { type PiezasShell } from './comun'
import { LateralPortal } from './LateralPortal'
import { MenuSesion } from './MenuSesion'

// the shell of the portal-tributario theme (useVarianteTema() === 'portal'), drawn in AppShell's frame: a brand bar in
// the shell colours with the administration, the theme menu and the session menu; a light lateral with the tree of
// trámites, which folds; and the footer. the bar, the lateral and the footer do not print
export const PortalShell: PiezasShell = {
  cabecera: 'flex h-14 shrink-0 items-center gap-2 bg-shell px-4 text-shell-ink sm:gap-4 print:hidden',
  // the prototype's 30px hamburger, on the bar's colours: it brings back the folded tree (the tree folds itself)
  botonMenu:
    'grid size-[30px] shrink-0 place-items-center rounded border border-shell-ink/50 text-shell-ink hover:bg-shell-ink/10 focus-visible:outline-shell-ink [&>svg]:size-4',
  plegable: true,
  tema: 'text-shell-muted hover:bg-shell-ink/10 hover:text-shell-ink focus-visible:outline-shell-ink',
  admin:
    'hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-shell-muted hover:bg-shell-ink/10 hover:text-shell-ink focus-visible:outline-shell-ink sm:flex',
  Marca,
  // the prototype's bar also shows the contributor's condition and a notices tray (a button with a badge) here,
  // before the session. the staff portal has no data for either, so neither is drawn: no empty button
  Sesion: MenuSesion,
  Lateral: LateralPortal,
  Pie
}

// the institution's shield: lucide's Landmark for now. the real shield (an image) goes here and nowhere else
function Escudo() {
  return <Landmark aria-hidden className="size-9 shrink-0" strokeWidth={1.75} />
}

function Marca() {
  const { appName } = useWasichaiConfig()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Escudo />
      {/* on a phone the bar needs the room: the shield alone */}
      <div className="min-w-0 leading-tight max-sm:hidden">
        <p className="truncate text-[17px] font-bold">{appName}</p>
        <p className="truncate text-[11.5px] text-shell-muted max-[860px]:hidden">Ventanilla de Tesorería</p>
      </div>
    </div>
  )
}

function Pie() {
  const { appName } = useWasichaiConfig()
  return (
    <footer className="shrink-0 border-t border-line bg-table-stripe px-4 py-2.5 text-center text-[13px] text-ink-muted print:hidden">
      {appName} — Ventanilla de Tesorería
    </footer>
  )
}
