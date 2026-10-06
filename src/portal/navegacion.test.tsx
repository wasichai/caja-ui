import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { Link } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, ADMIN, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// moving between leaves: the browser tab says which one is on screen, and the focus lands on its heading (so a screen
// reader says where it arrived); a link before the bar skips to the content
const registradas = vi.hoisted(() => ({}) as Record<string, ComponentType>)
vi.mock('./pantallas', () => ({ PANTALLAS: registradas }))

function Tributaria() {
  return <h1>Caja tributaria</h1>
}

function Duplicado() {
  return (
    <>
      <h1>Duplicado de recibo</h1>
      {/* what «Buscar» does: the same leaf, another query */}
      <Link to="?documento=12345678">Buscar</Link>
    </>
  )
}

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
  Object.assign(registradas, { 'caja-tributaria': Tributaria, 'duplicado-recibo': Duplicado })
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start(path: string) {
  abrirSesion(ADMIN)
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutasDeSesion(ADMIN, { admin: true, objects: {} }))
  render(<PortalApp />)
}

const lateral = () => within(screen.getByRole('navigation', { name: 'Secciones' }))

describe('moving between leaves', () => {
  it('names the browser tab after the leaf on screen, and home as Inicio', async () => {
    start('/caja-tributaria')
    await screen.findByRole('heading', { name: 'Caja tributaria' })
    expect(document.title).toBe('Caja tributaria · Caja')
    await userEvent.click(await lateral().findByRole('link', { name: 'Inicio' }))
    await screen.findByRole('heading', { level: 1, name: 'Inicio' })
    expect(document.title).toBe('Inicio · Caja')
  })

  it('takes the focus to the heading of the leaf it arrives at, not on the first drawing', async () => {
    start('/caja-tributaria')
    await screen.findByRole('heading', { name: 'Caja tributaria' })
    expect(document.body).toHaveFocus()

    await userEvent.click(await lateral().findByRole('link', { name: 'Duplicado de recibo' }))
    expect(await screen.findByRole('heading', { name: 'Duplicado de recibo' })).toHaveFocus()
  })

  it('leaves the focus where it is when only the query of the leaf changes', async () => {
    start('/duplicado-recibo')
    const buscar = await screen.findByRole('link', { name: 'Buscar' })
    await userEvent.click(buscar)
    expect(window.location.search).toBe('?documento=12345678')
    expect(buscar).toHaveFocus()
  })

  it('offers a way past the bar and the tree, straight to the content', async () => {
    start('/caja-tributaria')
    await screen.findByRole('heading', { name: 'Caja tributaria' })
    await userEvent.tab()
    const saltar = screen.getByRole('link', { name: 'Ir al contenido' })
    expect(saltar).toHaveFocus()
    await userEvent.click(saltar)
    expect(screen.getByRole('main')).toHaveFocus()
  })
})
