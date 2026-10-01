import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, ADMIN, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// a leaf whose screen throws while drawing takes itself down, not the root: the bar and the tree stay, with why, and
// another leaf draws (caja: una hoja que revienta no tumba la raíz)
const registradas = vi.hoisted(() => ({}) as Record<string, ComponentType>)
vi.mock('./pantallas', () => ({ PANTALLAS: registradas }))

function Revienta(): never {
  throw new Error('importe con otra forma: «12,3,4»')
}

function Tasas() {
  return <h2>Pantalla de tasas</h2>
}

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
  Object.assign(registradas, { 'cierre-caja': Revienta, 'caja-tasas': Tasas })
  // react reports what a boundary catches on the console; the boundary logs it too
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  vi.restoreAllMocks()
})

const lateral = () => screen.getByRole('navigation', { name: 'Secciones' })

describe('a leaf that throws', () => {
  it.each(['portal-tributario', 'light'])('keeps the bar and the tree with why, and recovers on another leaf (%s)', async (tema) => {
    abrirSesion(ADMIN)
    localStorage.setItem('caja.theme', tema)
    window.history.pushState({}, '', '/cierre-caja')
    fetch = mockFetch(rutasDeSesion(ADMIN, { admin: true, objects: {} }))
    render(<PortalApp />)

    const fallo = await within(await screen.findByRole('main')).findByRole('alert')
    expect(fallo).toHaveTextContent('Esta pantalla no se pudo dibujar')
    expect(fallo).toHaveTextContent('importe con otra forma: «12,3,4»')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(await within(lateral()).findByRole('link', { name: 'Cierre y arqueo de caja' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(within(lateral()).getByRole('link', { name: 'Caja de tasas y derechos administrativos' }))
    expect(await screen.findByRole('heading', { name: 'Pantalla de tasas' })).toBeInTheDocument()
    expect(screen.queryByText('Esta pantalla no se pudo dibujar')).not.toBeInTheDocument()

    // back on it, it is tried again (and fails again, with its why)
    await userEvent.click(within(lateral()).getByRole('link', { name: 'Cierre y arqueo de caja' }))
    expect(await within(screen.getByRole('main')).findByRole('alert')).toHaveTextContent('Esta pantalla no se pudo dibujar')
  })
})
