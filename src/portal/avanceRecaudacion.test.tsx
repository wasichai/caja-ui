import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// «Avance de recaudación» (avance-recaudacion): what was collected in a range of days of the turno, by source system,
// with the backend's totals, and the live turno of a caja and a cajero when both are asked for. the range lives in the
// url. caja-backend is mocked with its contract (PR #22). today is 2026-10-02 in Lima

const AL = '2026-10-02'
const cifra = (importe: string, actualizado_a = AL) => ({ importe, actualizado_a })
const fila = (origen: string | null, cobrado: string, anulado: string, neto: string) => ({
  origen,
  cobrado: cifra(cobrado),
  anulado: cifra(anulado),
  neto: cifra(neto)
})

// the brief's answer, verbatim
const AVANCE = {
  desde: '2026-10-01',
  hasta: AL,
  a_la_fecha: AL,
  filas: [fila('rentas', '370.50', '220.00', '150.50'), fila('TASA', '36.90', '0.00', '36.90')],
  cobrado: cifra('407.40'),
  anulado: cifra('220.00'),
  neto: cifra('187.40'),
  turno: null
}

const TURNO = {
  turno_id: '0b0a6c1e-3f2d-4c7a-9d4e-2a1b3c4d5e6f',
  caja: 'C-01',
  cajero: 'ana@muni.gob.pe',
  fecha: AL,
  estado_del_turno: 'ABIERTO',
  arqueo: {
    lineas: [{ forma_pago: 'EFECTIVO', cobrado: cifra('187.40'), anulado: cifra('0.00'), neto: cifra('187.40'), declarado: null, diferencia: null }],
    recibos_emitidos: 4,
    recibos_anulados: 1,
    total_cobrado: cifra('268.35'),
    total_anulado: cifra('80.25'),
    neto: cifra('188.10'),
    total_declarado: null,
    diferencia: null,
    cuadra: null
  }
}

const lee = (...objetos: string[]) => Object.fromEntries(objetos.map((objeto) => [objeto, ['READ']]))
const TESORERIA: CallerPermissions = { admin: false, objects: lee('recibo', 'linea_recibo', 'area', 'tasa', 'turno', 'anulacion_recibo', 'caja') }

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
  vi.restoreAllMocks()
  fetch?.restore()
  fetch = null
})

function start({ path = '/avance-recaudacion', permisos = TESORERIA }: { path?: string; permisos?: CallerPermissions } = {}) {
  abrirSesion(CAJERA)
  rutas = [{ method: 'GET', path: '/caja/recaudacion/avance', body: AVANCE }, ...rutasDeSesion(CAJERA, permisos)]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  render(<PortalApp />)
}

const main = () => within(screen.getByRole('main'))
const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ').replace(/ +/g, ' ').trim()
const celdas = (tr: Element) => [...tr.querySelectorAll('th, td')].map((celda) => texto(celda))
const filas = async (nombre = 'Por origen') =>
  within(await main().findByRole('table', { name: nombre }))
    .getAllByRole('row')
    .map(celdas)
const llamadas = () => fetch!.calls.filter((c) => c.path.split('?')[0] === '/caja/recaudacion/avance')
const enLaRuta = () => window.location.pathname + window.location.search
const problema = (status: number, detail: string, errors?: { field: string; message: string }[]) => ({
  title: 'Error',
  status,
  detail,
  ...(errors ? { errors } : {})
})

describe('Avance de recaudación: the leaf', () => {
  it('is offered with READ on recibo and linea_recibo, and its screen asks the avance', async () => {
    start()
    expect(await main().findByRole('heading', { name: 'Avance de recaudación', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Avance de recaudación' }).length).toBeGreaterThan(0)
    await filas()
    expect(llamadas().map((c) => c.path)).toEqual(['/caja/recaudacion/avance'])
  })

  it('takes down only itself when the backend answers something it cannot draw: the bar and the tree stay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    start()
    rutaDe('/caja/recaudacion/avance').body = { desde: '2026-10-01' }
    expect(await main().findByRole('alert')).toHaveTextContent('Esta pantalla no se pudo dibujar')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Avance de recaudación' })).toBeInTheDocument()
  })

  it('is kept by the backend’s own pairs: without READ on recibo and linea_recibo its url says what the account lacks', async () => {
    start({ permisos: { admin: false, objects: lee('turno') } })
    expect(
      await main().findByText('Su cuenta no puede abrir «Avance de recaudación»: le falta lectura de recibo y lectura de linea_recibo.')
    ).toBeInTheDocument()
    expect(fetch!.calls.filter((c) => c.path.startsWith('/caja/'))).toEqual([])
  })
})

describe('Avance de recaudación: the period', () => {
  it('draws a row per source and the backend’s totals, the date once in the heading', async () => {
    start()
    expect(await filas()).toEqual([
      ['Origen', 'Cobrado', 'Anulado', 'Neto'],
      ['rentas', 'S/ 370.50', 'S/ 220.00', 'S/ 150.50'],
      ['Tasas y derechos administrativos', 'S/ 36.90', 'S/ 0.00', 'S/ 36.90'],
      ['Total', 'S/ 407.40', 'S/ 220.00', 'S/ 187.40']
    ])
    expect(texto(await main().findByRole('table', { name: 'Por origen' }))).toContain('Cifras al 02/10/2026')
    const periodo = texto(main().getByTestId('periodo'))
    expect(periodo).toContain('Desde: 01/10/2026')
    expect(periodo).toContain('Hasta: 02/10/2026')
    expect(periodo).toContain('A la fecha: 02/10/2026')
  })

  it('shows the backend’s totals, which no sum with Number would give', async () => {
    start()
    const [a, b] = ['45035996273704.97', '45035996273704.96']
    const total = '90071992547409.93'
    // what adding them on the client would say: off by a cent
    expect((Number(a) + Number(b)).toFixed(2)).not.toBe(total)
    rutaDe('/caja/recaudacion/avance').body = {
      ...AVANCE,
      filas: [fila('rentas', a, '0.00', a), fila('TASA', b, '0.00', b)],
      cobrado: cifra(total),
      anulado: cifra('0.00'),
      neto: cifra(total)
    }
    expect((await filas()).at(-1)).toEqual(['Total', 'S/ 90,071,992,547,409.93', 'S/ 0.00', 'S/ 90,071,992,547,409.93'])
  })

  it('says a period without cobros, with its real totals', async () => {
    start()
    rutaDe('/caja/recaudacion/avance').body = { ...AVANCE, filas: [], cobrado: cifra('0.00'), anulado: cifra('0.00'), neto: cifra('0.00') }
    expect(await main().findByText('No se cobró nada en el periodo.')).toBeInTheDocument()
    expect((await filas()).at(-1)).toEqual(['Total', 'S/ 0.00', 'S/ 0.00', 'S/ 0.00'])
  })

  it('says a row whose source the backend did not send, never inventing one', async () => {
    start()
    rutaDe('/caja/recaudacion/avance').body = { ...AVANCE, filas: [fila(null, '1.00', '0.00', '1.00')] }
    expect((await filas())[1][0]).toBe('— el backend no mandó el origen: un recibo de órdenes sin líneas de su cobro')
  })
})

describe('Avance de recaudación: the range lives in the url', () => {
  it('writes the filters to the url on «Consultar» and asks them; a reload asks the same', async () => {
    start()
    await filas()
    await userEvent.type(main().getByLabelText('Desde'), '2026-10-01')
    await userEvent.type(main().getByLabelText('Hasta'), '2026-10-02')
    await userEvent.type(main().getByRole('textbox', { name: 'Origen' }), 'rentas')
    await userEvent.click(main().getByRole('button', { name: 'Consultar' }))

    const filtros = 'desde=2026-10-01&hasta=2026-10-02&origen=rentas'
    await waitFor(() => expect(enLaRuta()).toBe(`/avance-recaudacion?${filtros}`))
    await waitFor(() => expect(llamadas().at(-1)?.path).toBe(`/caja/recaudacion/avance?${filtros}`))

    cleanup()
    fetch!.restore()
    start({ path: `/avance-recaudacion?${filtros}` })
    await filas()
    expect(main().getByLabelText('Desde')).toHaveValue('2026-10-01')
    expect(main().getByLabelText('Hasta')).toHaveValue('2026-10-02')
    expect(main().getByRole('textbox', { name: 'Origen' })).toHaveValue('rentas')
    expect(llamadas().map((c) => c.path)).toEqual([`/caja/recaudacion/avance?${filtros}`])
  })

  it('asks again when «Consultar» is pressed with the same filters', async () => {
    const filtros = 'desde=2026-10-01&hasta=2026-10-02'
    start({ path: `/avance-recaudacion?${filtros}` })
    await filas()
    expect(llamadas()).toHaveLength(1)

    await userEvent.click(main().getByRole('button', { name: 'Consultar' }))
    await waitFor(() => expect(llamadas().map((c) => c.path)).toEqual([`/caja/recaudacion/avance?${filtros}`, `/caja/recaudacion/avance?${filtros}`]))
    expect(enLaRuta()).toBe(`/avance-recaudacion?${filtros}`)
  })

  it('says a 400 under its filter', async () => {
    start({ path: '/avance-recaudacion?desde=2026-10-05&hasta=2026-10-01' })
    const mensaje = 'el rango está al revés: desde 2026-10-05 hasta 2026-10-01'
    Object.assign(rutaDe('/caja/recaudacion/avance'), { status: 400, body: problema(400, 'La consulta no es válida', [{ field: 'hasta', message: mensaje }]) })
    expect(await main().findByText(mensaje)).toBeInTheDocument()
    expect(main().getByLabelText('Hasta')).toHaveAccessibleDescription(mensaje)
  })

  // the pairs of the leaf are the backend's gate; core's 403 at read time (turno, anulacion_recibo…) is not among them
  it('says a 403 of core at read time in its place', async () => {
    start()
    const detail = 'Leer anulacion_recibo exige permiso de lectura sobre anulacion_recibo'
    Object.assign(rutaDe('/caja/recaudacion/avance'), { status: 403, body: problema(403, detail) })
    expect(await main().findByText(`No se pudo leer el avance de recaudación: ${detail}`)).toBeInTheDocument()
  })
})

describe('Avance de recaudación: the live turno of today', () => {
  it('with caja and cajero, shows that turno’s live arqueo: nothing declared, never a 0', async () => {
    start({ path: '/avance-recaudacion?caja=C-01&cajero=ana%40muni.gob.pe' })
    rutaDe('/caja/recaudacion/avance').body = { ...AVANCE, turno: TURNO }
    expect(await main().findByRole('heading', { name: 'Turno de hoy de ana@muni.gob.pe en la caja C-01' })).toBeInTheDocument()
    expect(await filas('Arqueo del turno de hoy')).toEqual([
      ['Forma de pago', 'Cobrado', 'Anulado', 'Neto', 'Declarado', 'Diferencia'],
      ['Efectivo', 'S/ 187.40', 'S/ 0.00', 'S/ 187.40', '— sin declarar', '— sin declarar'],
      ['Total', 'S/ 268.35', 'S/ 80.25', 'S/ 188.10', '— sin declarar', '— sin declarar']
    ])
    const turno = texto(main().getByTestId('turno-del-avance'))
    expect(turno).toContain('Estado del turno: Abierto')
    expect(turno).toContain('Recibos emitidos: 4')
    expect(turno).toContain('Recibos anulados: 1')
    expect(turno).toContain('¿Cuadra?: — sin declarar: el backend lo dice al cerrar')
    expect(llamadas().map((c) => c.path)).toEqual(['/caja/recaudacion/avance?caja=C-01&cajero=ana%40muni.gob.pe'])
  })

  it('without them, there is no turno to show', async () => {
    start()
    await filas()
    expect(main().queryByTestId('turno-del-avance')).not.toBeInTheDocument()
  })

  it('says the 404 of a cajero with no turno today in that caja', async () => {
    start({ path: '/avance-recaudacion?caja=C-01&cajero=ana%40muni.gob.pe' })
    const detail = "El cajero 'ana@muni.gob.pe' no abrió turno en la caja 'C-01' el 2026-10-02: no hay nada que arquear"
    Object.assign(rutaDe('/caja/recaudacion/avance'), { status: 404, body: problema(404, detail) })
    expect(await main().findByText(`No se pudo leer el avance de recaudación: ${detail}`)).toBeInTheDocument()
  })
})
