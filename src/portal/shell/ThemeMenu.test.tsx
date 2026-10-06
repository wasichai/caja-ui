import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../../test/portal'
import { PortalApp } from '../PortalApp'

// the shell's theme menu: system, light, dark and portal-tributario. the pick is applied, kept under caja.theme (what
// index.html's boot script reads, registro.test.tsx) and stored for the user, as the admin does

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

// signed in, with the theme the user stored on the server
function start(routes: MockRoute[] = []) {
  abrirSesion(CAJERA)
  window.history.pushState({}, '', '/')
  fetch = mockFetch([
    ...routes,
    { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
    ...rutasDeSesion(CAJERA, { admin: false, objects: {} })
  ])
  render(<PortalApp />)
}

describe('theme menu', () => {
  it('switches the theme from a menu, keeps it under caja.theme and stores it for the user', async () => {
    start([{ method: 'PUT', path: '/auth/me/preferences', body: { theme: 'dark', locale: null } }])
    const button = await screen.findByRole('button', { name: /^Tema: Sistema/ })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    // system plus every theme core knows, caja's included
    const menu = screen.getByRole('menu', { name: 'Tema' })
    const items = within(menu).getAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent)).toEqual(['Sistema', 'Claro', 'Oscuro', 'Portal tributario'])
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])

    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Oscuro' }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('caja.theme')).toBe('dark')
    await waitFor(() => expect(fetch!.calls.find((c) => c.method === 'PUT' && c.path === '/auth/me/preferences')?.body).toEqual({ theme: 'dark' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Tema: Oscuro/ })).toHaveFocus()
  })

  // the portal-tributario theme changes the shell too: the brand bar and the tree
  it('draws the portal shell with portal-tributario', async () => {
    start([{ method: 'PUT', path: '/auth/me/preferences', body: { theme: 'portal-tributario', locale: null } }])
    await userEvent.click(await screen.findByRole('button', { name: /^Tema: Sistema/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Portal tributario' }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('portal-tributario'))
    expect(localStorage.getItem('caja.theme')).toBe('portal-tributario')
    expect(screen.getByRole('banner')).toHaveClass('bg-shell')
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toHaveAttribute('data-slot', 'nav-tree')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Caja — Ventanilla de Tesorería')
  })

  it('works from the keyboard, and closes with escape or a click outside', async () => {
    start()
    const button = await screen.findByRole('button', { name: /^Tema: Sistema/ })
    button.focus()
    await userEvent.keyboard('{Enter}')
    const menu = screen.getByRole('menu', { name: 'Tema' })
    // focus goes to the theme in use, and the arrows walk the menu round
    expect(within(menu).getByRole('menuitemradio', { name: 'Sistema' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(within(menu).getByRole('menuitemradio', { name: 'Claro' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(within(menu).getByRole('menuitemradio', { name: 'Portal tributario' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(within(menu).getByRole('menuitemradio', { name: 'Sistema' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(within(menu).getByRole('menuitemradio', { name: 'Portal tributario' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveFocus()

    await userEvent.click(button)
    expect(screen.getByRole('menu', { name: 'Tema' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('heading', { name: 'Inicio' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // opened and closed, never picked: the user's theme stays, nothing sent
    expect(localStorage.getItem('caja.theme')).toBe('system')
    expect(fetch!.calls.some((c) => c.method === 'PUT' && c.path === '/auth/me/preferences')).toBe(false)
  })

  it('keeps the theme and says why when the backend refuses it', async () => {
    start([{ method: 'PUT', path: '/auth/me/preferences', status: 500, body: { title: 'Error', detail: 'sin conexión' } }])
    await userEvent.click(await screen.findByRole('button', { name: /^Tema: Sistema/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Oscuro' }))
    const button = screen.getByRole('button', { name: /^Tema: Sistema/ })
    await waitFor(() => expect(button).toHaveAttribute('title', expect.stringMatching(/sin conexión/)))
    expect(button).toHaveClass('text-danger')
    expect(localStorage.getItem('caja.theme')).toBe('system')
  })
})
