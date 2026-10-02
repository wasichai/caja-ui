// copiado de srtm-ui@a1df33a (src/portal/shell/AppShell.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// adaptado: diverge de srtm-ui en que no hay búsqueda global ni entidad fija: el lateral clásico dibuja el árbol que
// se le ofrece a la cuenta (useArbol), la cabecera dice appName y la cuenta que contesta wasichai (useCuenta), y cada
// hoja va dentro de LimiteDeHoja. la estructura (cabecera, lateral, pestañas sobre el contenido, PortalShell con el
// tema portal-tributario) es la de srtm
import { useWasichaiConfig } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { FileText, Home, Landmark, LogOut, Menu, Settings, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useVarianteTema } from '../../themes'
import { useSession } from '../auth/session'
import { useCuenta } from '../queries'
import { Breadcrumbs } from './Breadcrumbs'
import { rotuloDeCuenta, type LateralProps, type PiezasShell } from './comun'
import { LimiteDeHoja } from './LimiteDeHoja'
import { esGrupo, hojasDe, useArbol } from './navTree'
import { usePanelLateral } from './panelLateral'
import { PortalShell } from './PortalShell'
import { TabBar } from './TabBar'
import { ThemeMenu } from './ThemeMenu'

// the classic shell of the cash desk: light header, dark sidebar, workspace tabs over the content.
// under the portal-tributario theme it delegates to PortalShell (brand bar, the tree of Tesorería, footer). one frame for
// both, each variant bringing its pieces: a theme switch redraws the bar, the lateral and the footer but keeps the
// page (and whatever is not saved in it) and the theme menu, with its focus and its error, mounted
export function AppShell() {
  const { isAdmin } = useSession()
  const piezas = useVarianteTema() === 'portal' ? PortalShell : CLASICO
  const { Marca, Sesion, Lateral, Pie } = piezas
  const lateral = usePanelLateral(piezas.plegable === true)
  const { pathname, search } = useLocation()

  return (
    <div className="flex h-full flex-col">
      <header className={piezas.cabecera}>
        <button
          ref={lateral.boton}
          type="button"
          className={piezas.botonMenu}
          // a foldable lateral folds itself: this one only brings it back
          hidden={piezas.plegable && lateral.abierto}
          aria-label={piezas.plegable ? 'Mostrar el menú' : 'Menú'}
          aria-expanded={lateral.abierto}
          aria-controls="sidebar"
          onClick={lateral.alternar}
        >
          <Menu className="size-5" />
        </button>
        <Marca />
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {isAdmin && (
            <a href="/admin" className={piezas.admin}>
              <Settings className="size-4" />
              Administración
            </a>
          )}
          <ThemeMenu className={piezas.tema} />
          <Sesion />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <Lateral abierto={lateral.abierto} onNavegar={lateral.alNavegar} onPlegar={lateral.plegar} />
        <main id="content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TabBar />
          <Breadcrumbs />
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <LimiteDeHoja reinicio={pathname + search}>
              <Outlet />
            </LimiteDeHoja>
          </div>
        </main>
      </div>
      {Pie && <Pie />}
    </div>
  )
}

const CLASICO: PiezasShell = {
  cabecera: 'flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4',
  botonMenu: 'rounded p-1.5 text-ink-muted hover:bg-surface-muted md:hidden',
  admin: 'hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink sm:flex',
  Marca: MarcaClasica,
  Sesion: SesionClasica,
  Lateral: LateralClasico
}

function MarcaClasica() {
  const { appName } = useWasichaiConfig()
  return (
    <div className="flex items-center gap-2">
      <Landmark className="size-5 text-brand" />
      <span className="text-sm font-bold text-brand">{appName}</span>
      <span className="hidden truncate text-sm text-ink-muted lg:inline">Ventanilla de Tesorería</span>
    </div>
  )
}

// the account wasichai answers (useCuenta): its initials, and its name from a wide screen on
function SesionClasica() {
  const { signOut } = useSession()
  const { nombre, iniciales, correo } = rotuloDeCuenta(useCuenta())
  return (
    <>
      <span title={correo ?? nombre} className="flex items-center gap-2">
        <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
          {iniciales}
        </span>
        <span className="hidden max-w-40 truncate text-sm text-ink lg:inline">{nombre}</span>
      </span>
      <button type="button" onClick={signOut} aria-label="Cerrar sesión" className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink">
        <LogOut className="size-4" />
      </button>
    </>
  )
}

// the classic sidebar: home, then each module of the tree the account is offered (useArbol) with its leaves. the
// administration is in the header already
function LateralClasico({ abierto, onNavegar }: LateralProps) {
  const grupos = useArbol().filter(esGrupo)
  return (
    <nav id="sidebar" aria-label="Secciones" className={cn('w-60 shrink-0 bg-shell p-3 md:block', abierto ? 'block' : 'hidden')}>
      <ul className="space-y-1">
        <li>
          <EnlaceClasico to="/" end label="Inicio" icon={Home} onNavegar={onNavegar} />
        </li>
        {grupos.map((grupo) => (
          <li key={grupo.label}>
            <p className="px-3 pt-3 pb-1 text-xs font-semibold text-shell-muted">{grupo.label}</p>
            <ul className="space-y-1">
              {hojasDe(grupo.hijos)
                .filter((hoja) => !hoja.externa)
                .map((hoja) => (
                  <li key={hoja.to}>
                    <EnlaceClasico to={hoja.to} label={hoja.label} icon={FileText} onNavegar={onNavegar} />
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function EnlaceClasico({ to, end, label, icon: Icon, onNavegar }: { to: string; end?: boolean; label: string; icon: LucideIcon; onNavegar: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavegar}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm',
          isActive ? 'bg-shell-ink/10 text-shell-ink' : 'text-shell-muted hover:bg-shell-ink/5 hover:text-shell-ink'
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  )
}
