import { onlineManager } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import type { CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// a leaf's screen is kept by the same seOfreceCon as the tree: whoever arrives by its url without it reads what the
// account lacks, instead of a screen full of 403s
const registradas = vi.hoisted(() => ({}) as Record<string, ComponentType>)
vi.mock('./pantallas', () => ({ PANTALLAS: registradas }))

function Prueba() {
  return <h2>Pantalla de prueba</h2>
}

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  Object.assign(registradas, { 'caja-tributaria': Prueba, 'duplicado-recibo': Prueba })
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start(path: string, permisos: CallerPermissions, extra: MockRoute[] = []) {
  abrirSesion(CAJERA)
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...rutasDeSesion(CAJERA, permisos)])
  render(<PortalApp />)
}

const hoja = () => within(screen.getByRole('main'))

// the permissions are read, then asked again (a reconnection, as react-query does when the network comes back), and
// that read fails: the route that answers them is handed back to change it in between
function conPermisosQueFallanAlReleer(path: string, permisos: CallerPermissions) {
  const ruta: MockRoute = { path: '/auth/me/permissions', body: permisos }
  start(path, permisos, [ruta])
  return async () => {
    Object.assign(ruta, { status: 403, body: { title: 'Forbidden', status: 403 } })
    act(() => onlineManager.setOnline(false))
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(fetch!.calls.filter((c) => c.path === '/auth/me/permissions')).toHaveLength(2))
  }
}

describe('the guard of a leaf', () => {
  it('draws the screen for an account the tree offers it to', async () => {
    start('/caja-tributaria', { admin: false, objects: { orden_de_cobro: ['READ'] } })
    expect(await screen.findByRole('heading', { name: 'Pantalla de prueba' })).toBeInTheDocument()
  })

  it('says what the account lacks, and does not draw the screen', async () => {
    start('/caja-tributaria', { admin: false, objects: { orden_de_cobro: ['UPDATE'], recibo: ['READ'] } })
    expect(await hoja().findByText('Su cuenta no puede abrir «Caja tributaria»: le falta lectura de orden_de_cobro.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pantalla de prueba' })).not.toBeInTheDocument()
  })

  it('names every alternative of a leaf that has several', async () => {
    start('/duplicado-recibo', { admin: false, objects: {} })
    expect(
      await hoja().findByText('Su cuenta no puede abrir «Duplicado de recibo»: le falta lectura de recibo, o creación de anulacion_recibo.')
    ).toBeInTheDocument()
  })

  it('keeps the open screen when the permissions read once fail to be read again', async () => {
    const releer = conPermisosQueFallanAlReleer('/caja-tributaria', { admin: false, objects: { orden_de_cobro: ['READ'] } })
    expect(await screen.findByRole('heading', { name: 'Pantalla de prueba' })).toBeInTheDocument()
    await releer()
    // what was typed in it would go with it: the screen stays, and so does the tree that offers it
    expect(screen.getByRole('heading', { name: 'Pantalla de prueba' })).toBeInTheDocument()
    expect(hoja().queryByText(/No se pudieron leer los permisos/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Caja tributaria' })).toBeInTheDocument()
  })

  it('keeps home saying what the menu offers when the permissions fail to be read again', async () => {
    const releer = conPermisosQueFallanAlReleer('/', { admin: false, objects: { orden_de_cobro: ['READ'] } })
    expect(await hoja().findByText('Elija una pantalla del menú.')).toBeInTheDocument()
    await releer()
    expect(hoja().getByText('Elija una pantalla del menú.')).toBeInTheDocument()
  })

  it('says so when the permissions cannot be read', async () => {
    start('/caja-tributaria', { admin: false, objects: {} }, [{ path: '/auth/me/permissions', status: 403, body: { title: 'Forbidden', status: 403 } }])
    expect(await hoja().findByText('No se pudieron leer los permisos de su cuenta: esta pantalla no se abre.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pantalla de prueba' })).not.toBeInTheDocument()
  })
})
