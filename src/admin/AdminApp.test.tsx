import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { AdminApp } from './AdminApp'

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  window.history.pushState({}, '', '/admin')
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

// mounts the real App and signs in through its login form. anything else gets the mock's 404 problem
async function signIn() {
  fetch = mockFetch([
    { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: admin } },
    { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
    { path: '/objects', body: [] }
  ])
  render(<AdminApp />)
  const email = await screen.findByLabelText('Correo')
  // the login offers the seeded admin
  expect(email).toHaveValue('admin@wasichai.local')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'admin')
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
}

describe('admin', () => {
  it('signs the seeded admin in, under caja.*', async () => {
    await signIn()
    expect(screen.getAllByText('Caja').length).toBeGreaterThan(0)
    expect(localStorage.getItem('caja.token')).toBe('t')
  })

  // caja-backend runs views, forms and pages: their screens, and none of the modules it does not run
  it('adds the screens of the backend modules, and only those', async () => {
    await signIn()
    for (const label of ['Vistas', 'Formularios', 'Páginas']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Workflows', 'Documentos', 'Mapas', 'Capas', 'Reglas', 'Asistente']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
  })

  // the portal's themes are the admin's too: a pick on either side shows on the other
  it('offers the caja themes, and opens on the one the portal stored', async () => {
    localStorage.setItem('caja.theme', 'portal-tributario')
    await signIn()
    expect(document.documentElement.dataset.theme).toBe('portal-tributario')
    const theme = screen.getByRole('combobox', { name: 'Tema' })
    expect(theme).toHaveValue('portal-tributario')
    expect(screen.getByRole('option', { name: 'Portal tributario' })).toBeInTheDocument()

    await userEvent.selectOptions(theme, 'dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('caja.theme')).toBe('dark')
  })
})
