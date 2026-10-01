import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirSesion, CAJERA, yo } from '../test/portal'
import { PortalApp } from './PortalApp'

// the account the bar names is the one wasichai answers (GET /api/auth/me, with the name core got at sign-in). when
// that read fails the bar says the account is not known: it never makes one up, nor takes the email typed at login

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

const permisos: MockRoute = { path: '/auth/me/permissions', body: { admin: false, objects: {} } }
const bar = () => within(screen.getByRole('banner'))
// nowhere in the bar, not even in a title or a label
const sinNombre = () => expect(screen.getByRole('banner').outerHTML).not.toMatch(/Cajera de prueba|cajera@caja\.test/)

function start(tema: string, routes: MockRoute[], { conSesion = true, path = '/' } = {}) {
  if (conSesion) abrirSesion(CAJERA)
  localStorage.setItem('caja.theme', tema)
  window.history.pushState({}, '', path)
  fetch = mockFetch([permisos, ...routes])
  render(<PortalApp />)
}

describe('the account in the bar', () => {
  it('is the one wasichai answers, not the email typed at login', async () => {
    start(
      'portal-tributario',
      [
        { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: CAJERA } },
        { path: '/auth/me', body: yo(CAJERA) }
      ],
      { conSesion: false, path: '/login' }
    )
    // an alias the backend resolves to the cajera's account
    const correo = await screen.findByLabelText('Correo')
    await userEvent.clear(correo)
    await userEvent.type(correo, 'ventanilla3@caja.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    const sesion = await within(await screen.findByRole('banner')).findByRole('button', { name: 'Cajera de prueba, Usuario: menú de sesión' })
    expect(sesion).toHaveTextContent('CDCajera de pruebaUsuario')
    await userEvent.click(sesion)
    expect(bar().getByText('cajera@caja.test')).toBeInTheDocument()
    expect(screen.queryByText(/ventanilla3/)).not.toBeInTheDocument()
  })

  it('says it is not known when /api/auth/me fails, and names nobody', async () => {
    start('portal-tributario', [{ path: '/auth/me', status: 404, body: { title: 'Not Found', status: 404 } }])
    const sesion = await bar().findByRole('button', { name: 'No se conoce la cuenta, Usuario: menú de sesión' })
    expect(sesion).toHaveTextContent('?No se conoce la cuentaUsuario')
    await userEvent.click(sesion)
    expect(within(screen.getByRole('banner')).getAllByText('No se conoce la cuenta').length).toBeGreaterThan(0)
    sinNombre()
    // signing out stays at hand
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it.each([
    ['answers', [{ path: '/auth/me', body: yo(CAJERA) }], 'Cajera de prueba'],
    ['fails', [], 'No se conoce la cuenta']
  ])('names it the same way in the classic shell when /api/auth/me %s', async (_, routes: MockRoute[], nombre) => {
    start('light', routes)
    expect(await bar().findByText(nombre)).toBeInTheDocument()
    if (nombre !== 'Cajera de prueba') sinNombre()
  })
})
