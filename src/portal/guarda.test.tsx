import { render, screen, within } from '@testing-library/react'
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

  it('says so when the permissions cannot be read', async () => {
    start('/caja-tributaria', { admin: false, objects: {} }, [{ path: '/auth/me/permissions', status: 403, body: { title: 'Forbidden', status: 403 } }])
    expect(await hoja().findByText('No se pudieron leer los permisos de su cuenta: esta pantalla no se abre.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pantalla de prueba' })).not.toBeInTheDocument()
  })
})
