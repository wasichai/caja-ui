import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// «Conciliación del día», a block of «Cierre y arqueo de caja» (cierre-caja): the day is chosen by whoever reconciles and
// lives in the route (?fecha=); until one is chosen, the block says it waits for it (not a 0 before its time). the line
// of a source system that did not answer says why it is not known, in each of its cells, never a 0. caja-backend is
// mocked with its contract (PR #22). today is 2026-10-02 in Lima

const AL = '2026-10-02'
const cifra = (importe: string, actualizado_a = AL) => ({ importe, actualizado_a })

const T1 = '0b0a6c1e-3f2d-4c7a-9d4e-2a1b3c4d5e6f'
const T2 = '5d1e2f3a-4b5c-4d6e-8f70-1a2b3c4d5e6f'
const turno = (turno_id: string, caja: string) => ({
  turno_id,
  caja,
  caja_nombre: null,
  cajero: CAJERA.email,
  fecha: AL,
  abierto_en: '2026-10-02T08:01:12.345678-05:00',
  estado_del_turno: 'ABIERTO'
})
const DEL_DIA = { cajero: CAJERA.email, fecha: AL, situacion: 'VARIOS_ABIERTOS', turnos: [turno(T1, 'C-01'), turno(T2, 'C-02')] }
const ARQUEO = {
  estado_del_turno: 'ABIERTO',
  puede_cerrar: true,
  arqueo: {
    lineas: [],
    recibos_emitidos: 0,
    recibos_anulados: 0,
    total_cobrado: cifra('0.00'),
    total_anulado: cifra('0.00'),
    neto: cifra('0.00'),
    total_declarado: null,
    diferencia: null,
    cuadra: null
  },
  cobrado_con_evento: cifra('0.00'),
  cobrado_sin_evento: cifra('0.00'),
  lo_que_impide_cerrar: [],
  cierre_vigente: null
}

const NO_CONTESTO = 'rentas no contestó: ConnectException: Connection refused'

// the brief's answer, verbatim but the reason: mercados squares, rentas did not answer
const MERCADOS = {
  sistema_destino: 'mercados',
  registrados: 1,
  anulados: 0,
  en_transito: 0,
  muertos: 0,
  explicados: 0,
  cobrado: cifra('100.00'),
  anulado: cifra('0.00'),
  neto: cifra('100.00'),
  recibidos: 1,
  aplicados: 1,
  rechazados: 0,
  importe_aplicado: cifra('100.00'),
  diferencia: cifra('0.00'),
  por_que_no_se_sabe: null,
  cuadra: true
}
const RENTAS = {
  sistema_destino: 'rentas',
  registrados: 2,
  anulados: 1,
  en_transito: 0,
  muertos: 0,
  explicados: 0,
  cobrado: cifra('150.00'),
  anulado: cifra('50.00'),
  neto: cifra('100.00'),
  recibidos: null,
  aplicados: null,
  rechazados: null,
  importe_aplicado: null,
  diferencia: null,
  por_que_no_se_sabe: NO_CONTESTO,
  cuadra: false
}
const CONCILIACION = { fecha: AL, a_la_fecha: '2026-10-03', cuadra: false, lineas: [MERCADOS, RENTAS] }

const LECTURAS = ['turno', 'caja', 'recibo', 'anulacion_recibo', 'pago_evento', 'cierre_turno', 'cierre_turno_linea', 'reversion_cierre']
const TESORERIA: CallerPermissions = { admin: false, objects: Object.fromEntries(LECTURAS.map((objeto) => [objeto, ['READ']])) }

let fetch: FetchMock | null = null
let rutas: MockRoute[] = []
const rutaDe = (method: string, path: string) => rutas.find((r) => (r.method ?? 'GET') === method && r.path === path)!

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

function start(path = '/cierre-caja') {
  abrirSesion(CAJERA)
  rutas = [
    { method: 'GET', path: '/caja/turnos/del-dia', body: DEL_DIA },
    { method: 'GET', path: `/caja/turnos/${T1}/arqueo`, body: { ...ARQUEO, turno_id: T1 } },
    { method: 'GET', path: `/caja/turnos/${T2}/arqueo`, body: { ...ARQUEO, turno_id: T2 } },
    { method: 'GET', path: '/caja/pagos/sin-entregar', body: [] },
    { method: 'GET', path: '/caja/conciliacion', body: CONCILIACION },
    ...rutasDeSesion(CAJERA, TESORERIA)
  ]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  render(<PortalApp />)
}

const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ').replace(/ +/g, ' ').trim()
const bloque = () => screen.findByRole('region', { name: 'Conciliación del día' })
const enElBloque = async () => within(await bloque())
const llamadas = () => fetch!.calls.filter((c) => c.path.split('?')[0] === '/caja/conciliacion')
const enLaRuta = () => window.location.pathname + window.location.search
const celdas = (tr: Element) => [...tr.querySelectorAll('th, td')].map((celda) => texto(celda))
const filas = async () =>
  within(await (await enElBloque()).findByRole('table', { name: 'Por sistema de origen' }))
    .getAllByRole('row')
    .map(celdas)
const dia = async () => (await enElBloque()).getByLabelText('Día a conciliar')

describe('Conciliación del día: the day', () => {
  it('waits for a day: asks nothing and shows no figure, no 0', async () => {
    start()
    const espera = await (await enElBloque()).findByText('Elija arriba el día que quiere conciliar y aquí saldrá su cuadre.')
    expect(espera).toBeInTheDocument()
    expect(await dia()).toHaveValue('')
    // the rest of the leaf is there, so the block had its chance to ask
    await screen.findByRole('table', { name: 'Turnos de hoy' })
    expect(llamadas()).toEqual([])
    expect(texto(await bloque())).not.toMatch(/\d|S\//)
  })

  it('writes the day chosen to ?fecha=, keeping the turno, and asks GET /conciliacion?fecha= for it; a reload shows the same', async () => {
    start(`/cierre-caja?turno=${T2}`)
    await userEvent.type(await dia(), AL)
    await userEvent.click((await enElBloque()).getByRole('button', { name: 'Conciliar' }))
    await waitFor(() => expect(enLaRuta()).toBe(`/cierre-caja?turno=${T2}&fecha=${AL}`))
    await waitFor(() => expect(llamadas().map((c) => c.path)).toEqual([`/caja/conciliacion?fecha=${AL}`]))
    await (await enElBloque()).findByRole('table', { name: 'Por sistema de origen' })

    cleanup()
    fetch!.restore()
    start(`/cierre-caja?turno=${T2}&fecha=${AL}`)
    expect(await (await enElBloque()).findByRole('table', { name: 'Por sistema de origen' })).toBeInTheDocument()
    expect(await dia()).toHaveValue(AL)
    expect(llamadas().map((c) => c.path)).toEqual([`/caja/conciliacion?fecha=${AL}`])
    expect(await screen.findByRole('heading', { name: 'Arqueo del turno de la caja C-02' })).toBeInTheDocument()
  })

  it('keeps the day when a turno is chosen', async () => {
    start(`/cierre-caja?fecha=${AL}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Arquear el turno de C-02' }))
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('turno')).toBe(T2))
    expect(new URLSearchParams(window.location.search).get('fecha')).toBe(AL)
  })

  it('says a day badly written as the 400 it is, under the field, and draws no figure', async () => {
    start('/cierre-caja?fecha=2026-13-45')
    Object.assign(rutaDe('GET', '/caja/conciliacion'), {
      status: 400,
      body: {
        title: 'Bad Request',
        status: 400,
        detail: 'La conciliación no es válida',
        errors: [{ field: 'fecha', message: 'no es una fecha AAAA-MM-DD: 2026-13-45' }]
      }
    })
    const mensaje = 'no es una fecha AAAA-MM-DD: 2026-13-45'
    expect(await (await enElBloque()).findByText(mensaje)).toBeInTheDocument()
    expect(await dia()).toHaveAccessibleDescription(mensaje)
    expect(llamadas().map((c) => c.path)).toEqual(['/caja/conciliacion?fecha=2026-13-45'])
    expect(texto(await bloque())).toContain('El backend no aceptó el día «2026-13-45»: La conciliación no es válida')
    expect((await enElBloque()).queryByRole('table')).not.toBeInTheDocument()
  })

  it('says a 403 in the block, and the leaf goes on', async () => {
    start(`/cierre-caja?fecha=${AL}`)
    const detail = 'Ver la conciliación del día exige permiso de lectura sobre pago_evento: cuenta los pagos del buzón y suma sus recibos'
    Object.assign(rutaDe('GET', '/caja/conciliacion'), { status: 403, body: { title: 'Forbidden', status: 403, detail } })
    expect(await (await enElBloque()).findByText(`No se pudo leer la conciliación del día: ${detail}`)).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Turnos de hoy' })).toBeInTheDocument()
  })
})

describe('Conciliación del día: the cuadre', () => {
  it('draws the backend’s cuadre and a row per system, with the figures of the day reconciled', async () => {
    start(`/cierre-caja?fecha=${AL}`)
    expect(await filas()).toEqual([
      [
        'Sistema',
        'Registrados',
        'Anulados',
        'En tránsito',
        'Sin entregar',
        'Explicados',
        'Cobrado',
        'Anulado',
        'Neto',
        'Recibidos en el origen',
        'Aplicados en el origen',
        'Rechazados en el origen',
        'Importe aplicado',
        'Diferencia',
        '¿Cuadra?',
        'Situación'
      ],
      ['mercados', '1', '0', '0', '0', '0', 'S/ 100.00', 'S/ 0.00', 'S/ 100.00', '1', '1', '0', 'S/ 100.00', 'S/ 0.00', 'Sí', 'Cuadra'],
      [
        'rentas',
        '2',
        '1',
        '0',
        '0',
        '0',
        'S/ 150.00',
        'S/ 50.00',
        'S/ 100.00',
        `— ${NO_CONTESTO}`,
        `— ${NO_CONTESTO}`,
        `— ${NO_CONTESTO}`,
        `— ${NO_CONTESTO}`,
        `— ${NO_CONTESTO}`,
        'No',
        `No se sabe: ${NO_CONTESTO}`
      ]
    ])
    const cuadre = texto(await bloque())
    // the figures are of the day reconciled, once in the caption; the reading, of a_la_fecha
    expect(cuadre).toContain('Cifras al 02/10/2026')
    expect(cuadre).toContain('Día conciliado: 02/10/2026')
    expect(cuadre).toContain('Leído el: 03/10/2026')
    expect(cuadre).toContain('¿Cuadra el día?: No: alguna línea no cuadra.')
  })

  it('never puts a 0 in a cell of a source that did not answer, nor of one not configured: each says why', async () => {
    start(`/cierre-caja?fecha=${AL}`)
    const motivo = 'el destino mercados no está configurado: falta caja.buzon.destinos.mercados.url'
    rutaDe('GET', '/caja/conciliacion').body = {
      ...CONCILIACION,
      lineas: [
        RENTAS,
        { ...MERCADOS, recibidos: null, aplicados: null, rechazados: null, importe_aplicado: null, diferencia: null, por_que_no_se_sabe: motivo, cuadra: false }
      ]
    }
    const [, rentas, mercados] = await filas()
    for (const [fila, porQue] of [
      [rentas, NO_CONTESTO],
      [mercados, motivo]
    ] as const) {
      const delOrigen = fila.slice(9, 14)
      expect(delOrigen).toEqual(Array(5).fill(`— ${porQue}`))
      for (const celda of delOrigen) expect(celda).not.toMatch(/\b0\b|S\//)
    }
  })

  it('says why a line does not square with what the backend counts', async () => {
    start(`/cierre-caja?fecha=${AL}`)
    rutaDe('GET', '/caja/conciliacion').body = {
      ...CONCILIACION,
      lineas: [{ ...MERCADOS, en_transito: 2, muertos: 1, rechazados: 3, diferencia: cifra('-12.50'), cuadra: false }]
    }
    const [, mercados] = await filas()
    expect(mercados.at(-2)).toBe('No')
    expect(mercados.at(-1)).toBe('No cuadra: en tránsito: 2 · sin entregar: 1 · rechazados en el origen: 3 · con diferencia')
    expect(mercados[13]).toBe('-S/ 12.50')
  })

  it('takes the diferencia as the backend gives it: never the client’s subtraction', async () => {
    start(`/cierre-caja?fecha=${AL}`)
    // 100.00 − 99.99 is 0.01; the backend says 0.02 (whatever its reason): the screen says the backend's
    rutaDe('GET', '/caja/conciliacion').body = {
      ...CONCILIACION,
      lineas: [{ ...MERCADOS, importe_aplicado: cifra('99.99'), diferencia: cifra('0.02'), cuadra: false }]
    }
    const [, mercados] = await filas()
    expect(mercados[12]).toBe('S/ 99.99')
    expect(mercados[13]).toBe('S/ 0.02')
  })

  it('says a day with no cobros, which squares', async () => {
    start(`/cierre-caja?fecha=${AL}`)
    rutaDe('GET', '/caja/conciliacion').body = { fecha: AL, a_la_fecha: AL, cuadra: true, lineas: [] }
    expect(await (await enElBloque()).findByText('Ese día no tiene ningún cobro registrado.')).toBeInTheDocument()
    expect(texto(await bloque())).toContain('¿Cuadra el día?: Sí: todas las líneas cuadran.')
  })
})
