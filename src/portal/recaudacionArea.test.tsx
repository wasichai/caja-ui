import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// «Recaudación por área» (recaudacion-area): what was collected in a range by área, partida and concepto, with the
// backend's neto, and neto_sin_partida said with its reason: what was charged by orders has no partida, and it is
// neither hidden nor shared out. the área and the range live in the url. caja-backend is mocked with its contract (PR
// #22). today is 2026-10-02 in Lima

const AL = '2026-10-02'
const cifra = (importe: string, actualizado_a = AL) => ({ importe, actualizado_a })
const fila = (area: string | null, area_nombre: string | null, partida: string | null, concepto: string | null, cobrado: string, neto = cobrado) => ({
  area,
  area_nombre,
  partida,
  concepto,
  cobrado: cifra(cobrado),
  anulado: cifra('0.00'),
  neto: cifra(neto)
})

// the brief's answer, verbatim
const POR_AREA = {
  desde: '2026-10-01',
  hasta: AL,
  a_la_fecha: AL,
  filas: [fila(null, null, null, 'rentas', '400.00'), fila('A-113300', 'SUBGERENCIA DE COMERCIALIZACIÓN', '1.3.1.1.1.1', 'T-001', '36.90')],
  neto: cifra('436.90'),
  neto_sin_partida: cifra('400.00')
}

const lee = (...objetos: string[]) => Object.fromEntries(objetos.map((objeto) => [objeto, ['READ']]))
const TESORERIA: CallerPermissions = { admin: false, objects: lee('recibo', 'linea_recibo', 'area', 'tasa') }

let fetch: FetchMock | null = null
let rutas: MockRoute[] = []
const rutaDe = (path: string) => rutas.find((r) => r.path === path)!

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-02T17:00:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
  fetch?.restore()
  fetch = null
})

function start({ path = '/recaudacion-area', permisos = TESORERIA }: { path?: string; permisos?: CallerPermissions } = {}) {
  abrirSesion(CAJERA)
  rutas = [{ method: 'GET', path: '/caja/recaudacion/por-area', body: POR_AREA }, ...rutasDeSesion(CAJERA, permisos)]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  render(<PortalApp />)
}

const main = () => within(screen.getByRole('main'))
const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ').replace(/ +/g, ' ').trim()
const celdas = (tr: Element) => [...tr.querySelectorAll('th, td')].map((celda) => texto(celda))
const filas = async () =>
  within(await main().findByRole('table', { name: 'Por área y partida' }))
    .getAllByRole('row')
    .map(celdas)
const llamadas = () => fetch!.calls.filter((c) => c.path.split('?')[0] === '/caja/recaudacion/por-area')
const enLaRuta = () => window.location.pathname + window.location.search
const problema = (status: number, detail: string, errors?: { field: string; message: string }[]) => ({
  title: 'Error',
  status,
  detail,
  ...(errors ? { errors } : {})
})

const SIN_PARTIDA =
  'Lo cobrado por órdenes de los sistemas de origen no tiene área ni partida: se cuenta aparte, en el neto sin partida, y no se reparte entre las áreas.'

describe('Recaudación por área: the leaf', () => {
  it('is offered with READ on linea_recibo and area, and its screen asks the recaudación', async () => {
    start()
    expect(await main().findByRole('heading', { name: 'Recaudación por área', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Recaudación por área' }).length).toBeGreaterThan(0)
    await filas()
    expect(llamadas().map((c) => c.path)).toEqual(['/caja/recaudacion/por-area'])
  })

  it('is kept by the same pairs: without them its url says what the account lacks', async () => {
    start({ permisos: { admin: false, objects: lee('recibo', 'tasa') } })
    expect(await main().findByText('Su cuenta no puede abrir «Recaudación por área»: le falta lectura de linea_recibo y lectura de area.')).toBeInTheDocument()
    expect(fetch!.calls.filter((c) => c.path.startsWith('/caja/'))).toEqual([])
  })
})

describe('Recaudación por área: the rows', () => {
  it('draws a row per área, partida and concepto; what orders charged says it has no área nor partida, never a filler', async () => {
    start()
    expect(await filas()).toEqual([
      ['Área', 'Partida', 'Concepto', 'Cobrado', 'Anulado', 'Neto'],
      ['— cobrado por órdenes: no tiene área', '— cobrado por órdenes: no tiene partida', 'rentas', 'S/ 400.00', 'S/ 0.00', 'S/ 400.00'],
      ['A-113300 — SUBGERENCIA DE COMERCIALIZACIÓN', '1.3.1.1.1.1', 'T-001', 'S/ 36.90', 'S/ 0.00', 'S/ 36.90'],
      ['Neto', 'S/ 436.90'],
      ['Neto sin partida (lo cobrado por órdenes)', 'S/ 400.00']
    ])
    expect(texto(await main().findByRole('table', { name: 'Por área y partida' }))).toContain('Cifras al 02/10/2026')
  })

  it('says neto_sin_partida with its reason', async () => {
    start()
    await filas()
    const periodo = texto(main().getByTestId('periodo'))
    expect(periodo).toContain('Desde: 01/10/2026')
    expect(periodo).toContain('Hasta: 02/10/2026')
    expect(periodo).toContain('A la fecha: 02/10/2026')
    expect(periodo).toContain('Neto: S/ 436.90')
    expect(periodo).toContain('Neto sin partida: S/ 400.00')
    expect(main().getByText(SIN_PARTIDA)).toBeInTheDocument()
  })

  it('shows the backend’s neto, which no sum with Number would give', async () => {
    start()
    const [a, b] = ['45035996273704.97', '45035996273704.96']
    const total = '90071992547409.93'
    expect((Number(a) + Number(b)).toFixed(2)).not.toBe(total)
    rutaDe('/caja/recaudacion/por-area').body = {
      ...POR_AREA,
      filas: [fila('A-1', 'UNO', '1.1', 'T-001', a), fila('A-2', 'DOS', '1.2', 'T-002', b)],
      neto: cifra(total),
      neto_sin_partida: cifra('0.00')
    }
    expect((await filas()).at(-2)).toEqual(['Neto', 'S/ 90,071,992,547,409.93'])
  })

  it('names an área the backend sent without its name by its code', async () => {
    start()
    rutaDe('/caja/recaudacion/por-area').body = { ...POR_AREA, filas: [fila('A-9', null, '1.9', 'T-009', '5.00')] }
    expect((await filas())[1][0]).toBe('A-9')
  })

  it('says a period without cobros', async () => {
    start()
    rutaDe('/caja/recaudacion/por-area').body = { ...POR_AREA, filas: [], neto: cifra('0.00'), neto_sin_partida: cifra('0.00') }
    expect(await main().findByText('No se cobró nada en el periodo.')).toBeInTheDocument()
  })
})

describe('Recaudación por área: the área and the range live in the url', () => {
  it('writes the filters to the url on «Consultar» and asks them; a reload asks the same', async () => {
    start()
    await filas()
    await userEvent.type(main().getByRole('textbox', { name: 'Área (código)' }), 'A-113300')
    await userEvent.type(main().getByLabelText('Desde'), '2026-10-01')
    await userEvent.type(main().getByLabelText('Hasta'), '2026-10-02')
    await userEvent.click(main().getByRole('button', { name: 'Consultar' }))

    const filtros = 'area=A-113300&desde=2026-10-01&hasta=2026-10-02'
    await waitFor(() => expect(enLaRuta()).toBe(`/recaudacion-area?${filtros}`))
    await waitFor(() => expect(llamadas().at(-1)?.path).toBe(`/caja/recaudacion/por-area?${filtros}`))

    cleanup()
    fetch!.restore()
    start({ path: `/recaudacion-area?${filtros}` })
    await filas()
    expect(main().getByRole('textbox', { name: 'Área (código)' })).toHaveValue('A-113300')
    expect(main().getByLabelText('Desde')).toHaveValue('2026-10-01')
    expect(llamadas().map((c) => c.path)).toEqual([`/caja/recaudacion/por-area?${filtros}`])
  })

  it('says a 400 under its filter', async () => {
    start({ path: '/recaudacion-area?desde=ayer' })
    const mensaje = 'no es una fecha AAAA-MM-DD: ayer'
    Object.assign(rutaDe('/caja/recaudacion/por-area'), {
      status: 400,
      body: problema(400, 'La consulta no es válida', [{ field: 'desde', message: mensaje }])
    })
    expect(await main().findByText(mensaje)).toBeInTheDocument()
    expect(main().getByLabelText('Desde')).toHaveAccessibleDescription(mensaje)
  })

  it('says a 403 in its place', async () => {
    start()
    const detail = 'Ver la recaudación por área exige permiso de lectura sobre tasa'
    Object.assign(rutaDe('/caja/recaudacion/por-area'), { status: 403, body: problema(403, detail) })
    expect(await main().findByText(`No se pudo leer la recaudación por área: ${detail}`)).toBeInTheDocument()
  })
})
