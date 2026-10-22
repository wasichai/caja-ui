import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { TAMANO_DE_PAGINA } from './cobro/api'
import { PortalApp } from './PortalApp'

// «Órdenes retiradas por el origen» (ordenes-retiradas): the orders their source system withdrew (ANULADA), with why
// and when, and the one that replaced each when there is one. caja-backend is mocked with its contract: GET
// /api/caja/ordenes-de-cobro?estado=ANULADA (#39 adds motivo_retiro and retirada_en; #40, sustituida_por). the list
// has no date filter: it pages by TAMANO_DE_PAGINA

const SUPERVISORA: AuthUser = { ...CAJERA, id: 'u-supervisora', email: 'supervisora@caja.test', roles: ['SUPERVISOR_CAJA'] }
const SUPERVISOR: CallerPermissions = { admin: false, objects: { orden_de_cobro: ['READ'], turno: ['READ'] } }

const retirada = (referencia: string, extra: Record<string, unknown> = {}) => ({
  orden_id: `id-${referencia}`,
  sistema_origen: 'rentas',
  referencia_externa: referencia,
  concepto: 'ARBITRIOS 2026 - LIMPIEZA',
  detalle: null,
  importe: { importe: '12.50', actualizado_a: '2026-10-01' },
  fecha_exigibilidad: '2026-03-31',
  pagador_documento: '12345678',
  pagador_nombre: 'FLORES OTINIANO JUNIOR',
  pagador_externo_id: 1234,
  estado: 'ANULADA',
  observacion: null,
  sustituye_a: null,
  motivo_retiro: 'Redeterminación por la DJ n° 12',
  retirada_en: '2026-10-21T10:15:30.123456-05:00',
  ...extra
})

const pagina = (content: unknown[], totalElements = content.length) => ({
  content,
  page: 0,
  size: TAMANO_DE_PAGINA,
  totalElements,
  totalPages: Math.ceil(totalElements / TAMANO_DE_PAGINA)
})

let fetch: FetchMock | null = null
let rutas: MockRoute[] = []
const rutaDe = (path: string) => rutas.find((r) => r.path === path)!

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-22T17:00:00Z') })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  fetch?.restore()
  fetch = null
})

function start({ path = '/ordenes-retiradas', permisos = SUPERVISOR }: { path?: string; permisos?: CallerPermissions } = {}) {
  abrirSesion(SUPERVISORA)
  rutas = [{ method: 'GET', path: '/caja/ordenes-de-cobro', body: pagina([retirada('ARB-1')]) }, ...rutasDeSesion(SUPERVISORA, permisos)]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  render(<PortalApp />)
}

const main = () => within(screen.getByRole('main'))
const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ').replace(/ +/g, ' ').trim()
const filas = async () =>
  within(await main().findByRole('table', { name: 'Órdenes retiradas' }))
    .getAllByRole('row')
    .slice(1)
    .map((tr) => [...tr.querySelectorAll('td')].map((celda) => texto(celda)))
const llamadas = () => fetch!.calls.filter((c) => c.path.split('?')[0] === '/caja/ordenes-de-cobro').map((c) => c.path)
const enLaRuta = () => window.location.pathname + window.location.search

describe('Órdenes retiradas por el origen', () => {
  it('lists the withdrawn orders with motivo and date', async () => {
    start()
    expect(await main().findByRole('heading', { name: 'Órdenes retiradas por el origen', level: 1 })).toBeInTheDocument()
    expect(await filas()).toEqual([
      [
        'ARB-1',
        'rentas',
        'ARBITRIOS 2026 - LIMPIEZA',
        '12345678 · FLORES OTINIANO JUNIOR',
        expect.stringContaining('12.50'),
        'Redeterminación por la DJ n° 12',
        '21/10/2026 10:15 (hora de Lima)',
        'Retirada por el origen'
      ]
    ])
    expect(llamadas()).toEqual([`/caja/ordenes-de-cobro?estado=ANULADA&page=0&size=${TAMANO_DE_PAGINA}`])
  })

  it('says why when an order has no motivo or date of its withdrawal', async () => {
    start()
    rutaDe('/caja/ordenes-de-cobro').body = pagina([retirada('ARB-1', { motivo_retiro: null, retirada_en: undefined })])
    const [fila] = await filas()
    expect(fila[5]).toBe('— El backend no mandó el motivo del retiro')
    expect(fila[6]).toBe('— El backend no mandó cuándo se retiró')
  })

  it('filters by pagador documento in the URL', async () => {
    start()
    await filas()
    await userEvent.type(main().getByLabelText('Documento del pagador'), ' 12345678 ')
    await userEvent.click(main().getByRole('button', { name: 'Consultar' }))
    await waitFor(() => expect(enLaRuta()).toBe('/ordenes-retiradas?documento=12345678'))
    await waitFor(() => expect(llamadas().at(-1)).toBe(`/caja/ordenes-de-cobro?estado=ANULADA&pagador_documento=12345678&page=0&size=${TAMANO_DE_PAGINA}`))
  })

  it('reads the filter of the URL on load', async () => {
    start({ path: '/ordenes-retiradas?documento=12345678' })
    await filas()
    expect(main().getByLabelText('Documento del pagador')).toHaveValue('12345678')
    expect(llamadas()).toEqual([`/caja/ordenes-de-cobro?estado=ANULADA&pagador_documento=12345678&page=0&size=${TAMANO_DE_PAGINA}`])
  })

  it('pages with TAMANO_DE_PAGINA', async () => {
    start({ path: '/ordenes-retiradas?documento=12345678' })
    rutaDe('/caja/ordenes-de-cobro').body = pagina([retirada('ARB-1')], TAMANO_DE_PAGINA * 2 + 1)
    await filas()
    await userEvent.click(await main().findByRole('button', { name: /siguiente/i }))
    await waitFor(() => expect(enLaRuta()).toBe('/ordenes-retiradas?documento=12345678&page=1'))
    await waitFor(() => expect(llamadas().at(-1)).toBe(`/caja/ordenes-de-cobro?estado=ANULADA&pagador_documento=12345678&page=1&size=${TAMANO_DE_PAGINA}`))
    // a new search starts at its first page
    await userEvent.clear(main().getByLabelText('Documento del pagador'))
    await userEvent.click(main().getByRole('button', { name: 'Consultar' }))
    await waitFor(() => expect(enLaRuta()).toBe('/ordenes-retiradas'))
  })

  it('leads back from a page past the last instead of saying none matches', async () => {
    start({ path: '/ordenes-retiradas?documento=12345678&page=3' })
    rutaDe('/caja/ordenes-de-cobro').body = { ...pagina([], 5), page: 3 }
    expect(await main().findByText(/Esta página ya no tiene órdenes: las que coinciden caben en las anteriores\./)).toBeInTheDocument()
    rutaDe('/caja/ordenes-de-cobro').body = pagina([retirada('ARB-1')])
    await userEvent.click(main().getByRole('button', { name: 'Ir a la primera página' }))
    await waitFor(() => expect(enLaRuta()).toBe('/ordenes-retiradas?documento=12345678'))
    expect(await filas()).toHaveLength(1)
  })

  it('says when none was withdrawn', async () => {
    start()
    rutaDe('/caja/ordenes-de-cobro').body = pagina([])
    expect(await main().findByText('Ninguna orden retirada por su sistema de origen coincide con la consulta.')).toBeInTheDocument()
  })

  it('says the backend detail when the list is refused', async () => {
    start()
    Object.assign(rutaDe('/caja/ordenes-de-cobro'), { status: 400, body: { title: 'Bad Request', status: 400, detail: 'estado no válido' } })
    expect(await main().findByRole('alert')).toHaveTextContent('No se pudo leer la lista de órdenes retiradas: estado no válido')
  })

  it('shows «sustituida por» when it has one', async () => {
    start()
    rutaDe('/caja/ordenes-de-cobro').body = pagina([retirada('ARB-1-v1', { sustituida_por: 'ARB-1-v2' }), retirada('ARB-2')])
    const [primera, segunda] = await filas()
    expect(primera[0]).toBe('ARB-1-v1 sustituida por ARB-1-v2')
    expect(segunda[0]).toBe('ARB-2')
  })

  it('is offered to SUPERVISOR_CAJA with READ on orden_de_cobro and hidden without it', async () => {
    start({ path: '/' })
    const lateral = () => within(screen.getByRole('navigation', { name: 'Secciones' }))
    expect(await lateral().findByRole('link', { name: 'Órdenes retiradas por el origen' })).toBeInTheDocument()
    cleanup()
    fetch?.restore()

    start({ path: '/ordenes-retiradas', permisos: { admin: false, objects: { turno: ['READ'] } } })
    expect(await main().findByText('Su cuenta no puede abrir «Órdenes retiradas por el origen»: le falta lectura de orden_de_cobro.')).toBeInTheDocument()
    expect(lateral().queryByRole('link', { name: 'Órdenes retiradas por el origen' })).not.toBeInTheDocument()
    expect(llamadas()).toEqual([])
  })
})
