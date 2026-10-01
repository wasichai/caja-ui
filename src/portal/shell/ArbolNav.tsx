// copiado de srtm-ui@a1df33a (src/portal/shell/ArbolNav.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { cn } from '@wasichai/ui'
import { ChevronLeft, ChevronRight, Home } from 'lucide-react'
import { useId, type ComponentProps } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { esGrupo, hojaActiva, type GrupoNav, type HojaNav, type NodoNav } from './navTree'

export interface ArbolNavProps {
  id?: string
  etiqueta: string
  titulo: string
  nodos: NodoNav[]
  // the panel: folded, it is hidden, and whoever folded it shows a way back
  abierto: boolean
  // which groups are open, by key (a group's labels from the root, joined by "/"); a group not in it is open
  grupos: Record<string, boolean>
  onGrupo: (clave: string) => void
  onNavegar: () => void
  onPlegar: () => void
}

interface Contexto {
  grupos: Record<string, boolean>
  onGrupo: (clave: string) => void
  onNavegar: () => void
  actual: HojaNav | undefined
}

// the prototype's tree menu, with tokens: a light panel headed by the way home and a button that folds it, a title,
// and groups (buttons with a caret, folding their leaves) of leaves in the link colour, the current one marked on
// its left, in bold and with a chevron. the data-ui hooks let a theme refine it (portal-tributario/nav.css)
export function ArbolNav({ id, etiqueta, titulo, nodos, abierto, grupos, onGrupo, onNavegar, onPlegar }: ArbolNavProps) {
  const { pathname } = useLocation()
  const contexto: Contexto = { grupos, onGrupo, onNavegar, actual: hojaActiva(nodos, pathname) }
  return (
    <nav
      id={id}
      aria-label={etiqueta}
      data-ui="arbol-nav"
      hidden={!abierto}
      // on a phone, over the whole row: a pick folds it
      className="w-73 shrink-0 overflow-y-auto border-r border-border bg-table-head max-sm:w-full print:hidden"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4 pt-3.5 pb-3">
        <Home aria-hidden className="size-[17px] shrink-0 text-link" strokeWidth={1.9} />
        <NavLink to="/" end onClick={onNavegar} className="min-w-0 flex-1 text-base text-link hover:underline">
          Ir al inicio
        </NavLink>
        <button
          type="button"
          aria-label="Ocultar el menú"
          aria-controls={id}
          onClick={onPlegar}
          className="grid size-6 shrink-0 place-items-center rounded text-link hover:bg-ink/4"
        >
          <ChevronLeft aria-hidden className="size-[15px]" strokeWidth={2.6} />
        </button>
      </div>
      <p className="px-4 pt-4 pb-2.5 text-lg leading-tight font-bold text-link">{titulo}</p>
      <Nodos nodos={nodos} nivel={0} padre="" contexto={contexto} />
    </nav>
  )
}

function Nodos({
  nodos,
  nivel,
  padre,
  contexto,
  id,
  hidden
}: {
  nodos: NodoNav[]
  nivel: number
  padre: string
  contexto: Contexto
  id?: string
  hidden?: boolean
}) {
  return (
    <ul id={id} hidden={hidden} className={cn(nivel === 0 && 'pb-4')}>
      {nodos.map((nodo) =>
        esGrupo(nodo) ? (
          <Grupo key={nodo.label} grupo={nodo} nivel={nivel} clave={padre + nodo.label} contexto={contexto} />
        ) : (
          <li key={nodo.to}>
            <Hoja hoja={nodo} nivel={nivel} actual={nodo === contexto.actual} onNavegar={contexto.onNavegar} />
          </li>
        )
      )}
    </ul>
  )
}

// a group (17px) or a subgroup (16px, indented): a button that folds its list, the caret turned while it is open
function Grupo({ grupo, nivel, clave, contexto }: { grupo: GrupoNav; nivel: number; clave: string; contexto: Contexto }) {
  const lista = useId()
  const abierto = contexto.grupos[clave] !== false
  const sub = nivel > 0
  return (
    <li>
      <button
        type="button"
        data-ui="arbol-grupo"
        aria-expanded={abierto}
        aria-controls={lista}
        onClick={() => contexto.onGrupo(clave)}
        className={cn(
          'flex w-full items-center gap-[9px] text-left font-bold text-ink hover:text-link focus-visible:-outline-offset-2',
          sub ? 'py-[9px] pr-3.5 pl-[26px] text-base' : 'px-3.5 py-2.5 text-[17px]'
        )}
      >
        <Caret abierto={abierto} sub={sub} />
        <span className="min-w-0 flex-1">{grupo.label}</span>
      </button>
      <Nodos id={lista} hidden={!abierto} nodos={grupo.hijos} nivel={nivel + 1} padre={`${clave}/`} contexto={contexto} />
    </li>
  )
}

// the prototype's caret: a small triangle that turns to point down, still when the user asks for less motion
function Caret({ abierto, sub }: { abierto: boolean; sub: boolean }) {
  return (
    <span
      aria-hidden
      data-ui="arbol-caret"
      className={cn(
        'grid shrink-0 place-items-center text-ink-muted transition-transform duration-130 motion-reduce:transition-none',
        sub ? 'size-[13px]' : 'size-3.5',
        abierto && 'rotate-90'
      )}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className={sub ? 'size-[9px]' : 'size-2.5'}>
        <path d="M8 5l10 7-10 7z" />
      </svg>
    </span>
  )
}

// a leaf: 15px in the link colour, indented under its group (deeper under a subgroup). one at the root, beside the
// groups (the administration), takes their type, with its icon, if any, where they have the caret
function Hoja({ hoja, nivel, actual, onNavegar }: { hoja: HojaNav; nivel: number; actual: boolean; onNavegar: () => void }) {
  const comun = { hoja, 'aria-current': actual ? ('page' as const) : undefined, onClick: hoja.externa ? undefined : onNavegar }
  if (nivel === 0) {
    const Icono = hoja.icono
    return (
      <Enlace
        {...comun}
        data-ui="arbol-grupo"
        className="flex w-full items-center gap-[9px] px-3.5 py-2.5 text-[17px] font-bold text-ink hover:text-link focus-visible:-outline-offset-2"
      >
        <span aria-hidden data-ui="arbol-caret" className="grid size-3.5 shrink-0 place-items-center text-ink-muted">
          {Icono && <Icono className="size-3.5" />}
        </span>
        <span className="min-w-0 flex-1">{hoja.label}</span>
      </Enlace>
    )
  }
  return (
    <Enlace
      {...comun}
      data-ui="arbol-hoja"
      className={cn(
        'flex items-center gap-2 border-l-4 py-[9px] pr-3.5 text-[15px] leading-[1.35] text-link focus-visible:-outline-offset-2',
        nivel > 1 ? 'pl-[48px]' : 'pl-[34px]',
        actual ? 'border-link bg-ink/6 font-bold' : 'border-transparent hover:bg-ink/4'
      )}
    >
      <span className="min-w-0 flex-1">{hoja.label}</span>
      {actual && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-link" strokeWidth={3} />}
    </Enlace>
  )
}

// a page of the app goes through the router; another app (externa) is a plain link, loaded in full
function Enlace({ hoja, ...props }: { hoja: HojaNav } & Omit<ComponentProps<'a'>, 'href'>) {
  return hoja.externa ? <a href={hoja.to} {...props} /> : <Link to={hoja.to} {...props} />
}
