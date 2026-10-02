// copiado de srtm-ui@a1df33a (src/portal/shell/ThemeMenu.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { SYSTEM_THEME, useTheme } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { Check, Monitor, Moon, Palette, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

// core's own choices have their icon; a theme the app adds (config.themes) gets the palette
const ICONS: Record<string, LucideIcon> = { [SYSTEM_THEME]: Monitor, light: Sun, dark: Moon }

// the shell's theme picker, a menu button: system plus every theme core knows, caja's included, nothing listed here.
// core's ThemeProvider applies the pick and stores it for the user, so the admin follows. `className` styles the
// button for the header it sits in
export function ThemeMenu({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { preference, themes, setPreference } = useTheme()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const options = [{ id: SYSTEM_THEME, label: t('theme.system') }, ...themes.map((theme) => ({ id: theme.id, label: t(theme.label) }))]
  // an id core does not know (an old build, another app's theme) falls to the os setting: shown as system, as core does
  const current = options.find((option) => option.id === preference) ?? options[0]
  const Icon = ICONS[current.id] ?? Palette

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])

  // opened: focus on the theme in use, and a press anywhere else closes it
  useEffect(() => {
    if (!open) return
    items()
      .find((item) => item.getAttribute('aria-checked') === 'true')
      ?.focus()
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

  const choose = (id: string) => {
    close()
    if (id === preference) return
    setError(null)
    setPreference(id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
  }

  // the arrows walk the items round, home and end jump to the ends; escape gives focus back to the button
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
        aria-label={`Tema: ${current.label}. Elegir tema`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={error ?? `Tema: ${current.label}`}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onButtonKey}
        className={cn('rounded p-1.5 hover:bg-surface-muted hover:text-ink', error ? 'text-danger' : 'text-ink-muted', className)}
      >
        <Icon className="size-4" />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label="Tema"
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-30 mt-1 min-w-44 rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option) => {
            const OptionIcon = ICONS[option.id] ?? Palette
            const checked = option.id === current.id
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => choose(option.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:-outline-offset-2"
              >
                <OptionIcon className="size-4 text-ink-muted" />
                <span className="flex-1">{option.label}</span>
                <Check className={cn('size-4 text-brand', !checked && 'invisible')} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
