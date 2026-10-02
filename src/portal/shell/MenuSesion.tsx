// copiado de srtm-ui@a1df33a (src/portal/shell/MenuSesion.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { cn } from '@wasichai/ui'
import { LogOut, Settings } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useSession } from '../auth/session'
import { useCuenta } from '../queries'
import { rotuloDeCuenta } from './comun'

const ITEM = 'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-brand-soft focus-visible:bg-brand-soft focus-visible:-outline-offset-2'

// the brand bar's session menu: initials, name and role on the button (for the bar's colours); a panel with who is
// signed in (the account wasichai answers, useCuenta), the administration (admins only) and sign-out. a menu button
// like ThemeMenu: the arrows, home and end walk it, escape gives focus back to the button, a pick or a press anywhere
// else closes it.
// the panel's data-ui hooks let a theme refine it (src/themes/portal-tributario/shell.css)
export function MenuSesion() {
  const { isAdmin, signOut } = useSession()
  const { nombre, iniciales, correo } = rotuloDeCuenta(useCuenta())
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const rol = isAdmin ? 'Administrador' : 'Usuario'

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  // opened: focus on the first option, and a press anywhere else closes it
  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  const onMenuKey = (event: KeyboardEvent) => {
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLElement)
    const focus = (index: number) => {
      event.preventDefault()
      list[(index + list.length) % list.length]?.focus()
    }
    if (event.key === 'ArrowDown') focus(at + 1)
    else if (event.key === 'ArrowUp') focus(at < 0 ? -1 : at - 1)
    else if (event.key === 'Home') focus(0)
    else if (event.key === 'End') focus(-1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') setOpen(false)
  }

  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setOpen(true)
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={`${nombre}, ${rol}: menú de sesión`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onButtonKey}
        className="group flex items-center gap-2 rounded-md py-1 pr-2 pl-1 text-left hover:bg-shell-ink/10 focus-visible:outline-shell-ink"
      >
        {/* 15% white, not the prototype's 22%: white initials on it keep 4.5:1 */}
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-shell-ink/15 text-xs font-bold">
          {iniciales}
        </span>
        <span className="leading-tight max-[860px]:hidden">
          <span className="block max-w-40 truncate text-[13px] font-bold">{nombre}</span>
          <span className="block text-[11px] text-shell-muted group-hover:text-shell-ink">{rol}</span>
        </span>
      </button>
      {open && (
        <div
          data-ui="menu-sesion-panel"
          className="absolute top-full right-0 z-30 mt-1 w-67 max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-border bg-surface text-ink shadow-lg"
        >
          <div data-ui="menu-sesion-cabecera" className="border-b border-border bg-surface-muted px-4 py-3">
            <p className="truncate text-sm font-bold">{nombre}</p>
            {correo && <p className="truncate text-xs text-ink-muted">{correo}</p>}
          </div>
          <div ref={menu} id={menuId} role="menu" aria-label="Sesión" onKeyDown={onMenuKey} className="py-1">
            {isAdmin && (
              <a href="/admin" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={cn(ITEM, 'text-link')}>
                <Settings aria-hidden className="size-4" />
                Administración
              </a>
            )}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className={cn(ITEM, 'text-danger')}
            >
              <LogOut aria-hidden className="size-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
