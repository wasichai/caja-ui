import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, ADMIN, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// the tree of tesorería, offered leaf by leaf with what GET /api/auth/me/permissions answers (ADR-020), and only the
// leaves that have a screen (caja ADR-0044). no leaf has one yet, so each test registers its own
const registradas = vi.hoisted(() => ({}) as Record<string, ComponentType>)
vi.mock('./pantallas', () => ({ PANTALLAS: registradas }))

function Prueba() {
  return <h2>Pantalla de prueba</h2>
}

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
  for (const clave of Object.keys(registradas)) delete registradas[clave]
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start({
  user = CAJERA,
  permisos,
  tema = 'portal-tributario',
  path = '/',
  extra = []
}: {
  user?: AuthUser
  permisos: CallerPermissions
  tema?: string
  path?: string
  extra?: MockRoute[]
}) {
  abrirSesion(user)
  localStorage.setItem('caja.theme', tema)
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...rutasDeSesion(user, permisos)])
  render(<PortalApp />)
}

const lateral = () => screen.getByRole('navigation', { name: 'Secciones' })
const hojas = () =>
  within(lateral())
    .getAllByRole('link')
    .map((link) => link.textContent)
const inicio = () => within(screen.getByRole('main'))

// the screen registered on two leaves: duplicado-recibo (recibo READ, or anulacion_recibo CREATE) and recaudacion-area
// (linea_recibo READ and area READ)
const dosHojas = () => Object.assign(registradas, { 'duplicado-recibo': Prueba, 'recaudacion-area': Prueba })

describe('the tree of tesorería, by /api/auth/me/permissions', () => {
  it('offers a leaf when the account has every pair of one of its alternatives', async () => {
    dosHojas()
    start({ permisos: { admin: false, objects: { anulacion_recibo: ['CREATE'], linea_recibo: ['READ'], area: ['READ', 'UPDATE'] } } })
    expect(await inicio().findByText('Elija una pantalla del menú.')).toBeInTheDocument()
    expect(hojas()).toEqual(['Ir al inicio', 'Duplicado de recibo', 'Recaudación por área'])
    expect(within(lateral()).getByRole('button', { name: 'Tesorería' })).toBeInTheDocument()
    // the lateral's title is the cash desk's, not a taxpayer's procedures
    expect(within(lateral()).getByText('Ventanilla')).toBeInTheDocument()
    expect(lateral()).not.toHaveTextContent('Mis trámites')
  })

  it('does not offer it when a pair is missing', async () => {
    dosHojas()
    // recibo without READ and anulacion_recibo without CREATE: no alternative of duplicado-recibo is whole; area missing
    start({ permisos: { admin: false, objects: { recibo: ['UPDATE'], anulacion_recibo: ['READ'], linea_recibo: ['READ'] } } })
    expect(await inicio().findByText('Su cuenta no tiene acceso a ninguna pantalla de Tesorería.')).toBeInTheDocument()
    expect(hojas()).toEqual(['Ir al inicio'])
    // a module left with no leaf is not drawn either
    expect(within(lateral()).queryByRole('button', { name: 'Tesorería' })).not.toBeInTheDocument()
  })

  it('offers them all to ADMIN', async () => {
    dosHojas()
    start({ user: ADMIN, permisos: { admin: true, objects: {} } })
    expect(await inicio().findByText('Elija una pantalla del menú.')).toBeInTheDocument()
    expect(hojas()).toEqual(['Ir al inicio', 'Duplicado de recibo', 'Recaudación por área', 'Administración'])
  })

  it('filters the classic sidebar the same way', async () => {
    dosHojas()
    start({ tema: 'light', permisos: { admin: false, objects: { recibo: ['READ'], linea_recibo: ['READ'] } } })
    expect(await inicio().findByText('Elija una pantalla del menú.')).toBeInTheDocument()
    expect(hojas()).toEqual(['Inicio', 'Duplicado de recibo'])
  })

  it('offers nothing while the permissions cannot be read, and says why', async () => {
    dosHojas()
    start({ permisos: { admin: false, objects: {} }, extra: [{ path: '/auth/me/permissions', status: 403, body: { title: 'Forbidden', status: 403 } }] })
    expect(await inicio().findByText('No se pudieron leer los permisos de su cuenta: el menú no ofrece ninguna pantalla.')).toBeInTheDocument()
    expect(hojas()).toEqual(['Ir al inicio'])
  })
})

describe('a leaf without a screen', () => {
  it('is not drawn, even for an account that may open it', async () => {
    registradas['duplicado-recibo'] = Prueba
    start({ user: ADMIN, permisos: { admin: true, objects: {} } })
    expect(await inicio().findByText('Elija una pantalla del menú.')).toBeInTheDocument()
    expect(hojas()).toEqual(['Ir al inicio', 'Duplicado de recibo', 'Administración'])
  })

  it('has no page either', async () => {
    start({ permisos: { admin: false, objects: { orden_de_cobro: ['READ'] } }, path: '/caja-tributaria' })
    expect(await screen.findByText('Esta página no existe')).toBeInTheDocument()
  })

  // none has one in this version: home says so, and the tree has no module
  it('leaves home saying there is no screen yet', async () => {
    start({ user: ADMIN, permisos: { admin: true, objects: {} } })
    expect(await inicio().findByText('Todavía no hay pantallas de Tesorería en esta versión de la caja.')).toBeInTheDocument()
    // the permissions in: an admin, who may open every leaf, still gets none
    expect(await within(lateral()).findByRole('link', { name: 'Administración' })).toBeInTheDocument()
    expect(hojas()).toEqual(['Ir al inicio', 'Administración'])
  })
})

describe('a leaf with a screen', () => {
  it('draws it on its route, marked in the tree and in the trail', async () => {
    dosHojas()
    start({ permisos: { admin: false, objects: { recibo: ['READ'] } } })
    await userEvent.click(await within(lateral()).findByRole('link', { name: 'Duplicado de recibo' }))
    expect(await screen.findByRole('heading', { name: 'Pantalla de prueba' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/duplicado-recibo')
    expect(within(lateral()).getByRole('link', { name: 'Duplicado de recibo' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation', { name: 'Ruta' })).toHaveTextContent('TesoreríaDuplicado de recibo')
  })
})
