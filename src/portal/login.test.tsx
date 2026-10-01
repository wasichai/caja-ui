import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// the portal's login: core's session (POST /api/auth/login, kept under caja.*) and RequireSession in front of the shell

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

const login = (status = 200): MockRoute =>
  status === 200
    ? { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: CAJERA } }
    : { method: 'POST', path: '/auth/login', status, body: { title: 'Unauthorized', status, detail: 'Bad credentials' } }

function start(path: string, routes: MockRoute[]) {
  window.history.pushState({}, '', path)
  fetch = mockFetch(routes)
  render(<PortalApp />)
}

async function ingresar(email: string, password: string) {
  const correo = await screen.findByLabelText('Correo')
  await userEvent.clear(correo)
  await userEvent.type(correo, email)
  await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

const aqui = () => window.location.pathname + window.location.search

describe('login', () => {
  it('sends a visitor without a session to the login, keeping where they were going', async () => {
    start('/cierre?fecha=2026-10-01', [])
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/cierre?fecha=2026-10-01')
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('signs in with the right credentials, keeps the session under caja.* and goes on to next', async () => {
    start('/cierre?fecha=2026-10-01', [login(), ...rutasDeSesion(CAJERA, { admin: false, objects: {} })])
    await ingresar('cajera@caja.test', 'secreta')

    expect(await screen.findByRole('banner')).toBeInTheDocument()
    expect(aqui()).toBe('/cierre?fecha=2026-10-01')
    const post = fetch!.calls.find((call) => call.method === 'POST' && call.path === '/auth/login')
    expect(post?.body).toEqual({ email: 'cajera@caja.test', password: 'secreta' })
    expect(localStorage.getItem('caja.token')).toBe('t')
    expect(JSON.parse(localStorage.getItem('caja.user') ?? 'null')).toEqual(CAJERA)
  })

  it('says so on a 401, and keeps no session', async () => {
    start('/login', [login(401)])
    await ingresar('cajera@caja.test', 'equivocada')

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos')
    expect(window.location.pathname).toBe('/login')
    expect(localStorage.getItem('caja.token')).toBeNull()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('tells any other failure apart from wrong credentials', async () => {
    start('/login', [login(503)])
    await ingresar('cajera@caja.test', 'secreta')
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo iniciar sesión')
    expect(alerta).not.toHaveTextContent('Correo o contraseña incorrectos')
  })

  // only same-site paths: ?next=//evil.example must not leave the app
  it('goes home instead of to another site', async () => {
    start('/login?next=//evil.example', [login(), ...rutasDeSesion(CAJERA, { admin: false, objects: {} })])
    await ingresar('cajera@caja.test', 'secreta')
    expect(within(await screen.findByRole('main')).getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(aqui()).toBe('/')
  })

  it('signs out from the session menu, back to the login, forgetting the session and the tabs', async () => {
    abrirSesion(CAJERA)
    localStorage.setItem('caja.theme', 'portal-tributario')
    sessionStorage.setItem('caja.tabs', '[]')
    start('/', rutasDeSesion(CAJERA, { admin: false, objects: {} }))
    await userEvent.click(await within(await screen.findByRole('banner')).findByRole('button', { name: /menú de sesión/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument()
    expect(localStorage.getItem('caja.token')).toBeNull()
    expect(localStorage.getItem('caja.user')).toBeNull()
    expect(sessionStorage.getItem('caja.tabs')).toBeNull()
  })
})
