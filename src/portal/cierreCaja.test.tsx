import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion, volverAEntrar } from '../test/portal'
import { guardarBorrador } from './escritura/borrador'
import { PortalApp } from './PortalApp'

// «Cierre y arqueo de caja» (cierre-caja): the clerk's turno of today and its situation in words, the arqueo by forma de
// pago (the backend's: the client adds nothing), the cierre with what was counted (typed text, sent as the exact
// string) and its reversal. the real PANTALLAS: the leaf is registered. caja-backend is mocked with its contract (PR
// #16). today is 2026-10-02 in Lima

const AL = '2026-10-02'
const cifra = (importe: string, actualizado_a = AL) => ({ importe, actualizado_a })

const T1 = '0b0a6c1e-3f2d-4c7a-9d4e-2a1b3c4d5e6f'
const T2 = '5d1e2f3a-4b5c-4d6e-8f70-1a2b3c4d5e6f'

const turno = (turno_id: string, caja: string | null, caja_nombre: string | null, abierto_en: string, estado_del_turno = 'ABIERTO') => ({
  turno_id,
  caja,
  caja_nombre,
  cajero: CAJERA.email,
  fecha: AL,
  abierto_en,
  estado_del_turno
})
const EN_C01 = turno(T1, 'C-01', 'VENTANILLA 1', '2026-10-02T08:01:12.345678-05:00')
const EN_C02 = turno(T2, 'C-02', 'VENTANILLA 2', '2026-10-02T09:30:00.000001-05:00')

const delDia = (situacion: string, turnos: ReturnType<typeof turno>[]) => ({ cajero: CAJERA.email, fecha: AL, situacion, turnos })

const linea = (forma_pago: string, cobrado: string, anulado: string, neto: string, declarado: string | null = null, diferencia: string | null = null) => ({
  forma_pago,
  cobrado: cifra(cobrado),
  anulado: cifra(anulado),
  neto: cifra(neto),
  declarado: declarado === null ? null : cifra(declarado),
  diferencia: diferencia === null ? null : cifra(diferencia)
})

// the live arqueo: nobody has counted, so declarado, diferencia, total_declarado and cuadra are null, never 0
const EN_VIVO = {
  lineas: [linea('EFECTIVO', '187.40', '0.00', '187.40'), linea('TARJETA', '80.25', '80.25', '0.00')],
  recibos_emitidos: 4,
  recibos_anulados: 1,
  total_cobrado: cifra('268.35'),
  total_anulado: cifra('80.25'),
  neto: cifra('188.10'),
  total_declarado: null,
  diferencia: null,
  cuadra: null
}

const arqueo = (turno_id: string, otros: Record<string, unknown> = {}) => ({
  turno_id,
  estado_del_turno: 'ABIERTO',
  puede_cerrar: true,
  arqueo: EN_VIVO,
  cobrado_con_evento: cifra('150.50'),
  cobrado_sin_evento: cifra('37.60'),
  lo_que_impide_cerrar: [],
  cierre_vigente: null,
  ...otros
})

const PAGO = '3e6da681-2467-48e6-acc7-281903b9b578'
const SIN_ENTREGAR = { puede_cerrar: false, lo_que_impide_cerrar: [{ pago_id: PAGO, tipo: 'PAGO_REGISTRADO', estado: 'PENDIENTE' }] }

// the acta: its diferencia is the backend's (0.05 on 187.40 declared over 187.40 of neto: no subtraction of the client's
// would give it), and so is cuadra
const CIERRE = {
  cierre_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  turno_id: T1,
  caja: 'C-01',
  cajero: CAJERA.email,
  fecha: AL,
  secuencia: 1,
  registrado_en: '2026-10-02T18:30:05.123456-05:00',
  usuario: CAJERA.email,
  observacion: 'cierre del turno de la mañana',
  estado_del_turno: 'CERRADO',
  arqueo: {
    ...EN_VIVO,
    lineas: [linea('EFECTIVO', '187.40', '0.00', '187.40', '187.40', '0.05'), linea('CHEQUE', '0.00', '0.00', '0.00', '20.00', '20.00')],
    total_declarado: cifra('207.40'),
    diferencia: cifra('19.30'),
    cuadra: false
  },
  cobrado_con_evento: cifra('150.50'),
  cobrado_sin_evento: cifra('37.60')
}

const REVERSION = {
  reversion_id: '9b2f0d4e-1c3a-4e5f-8a7b-6c5d4e3f2a1b',
  turno_id: T1,
  caja: 'C-01',
  cajero: CAJERA.email,
  fecha: AL,
  secuencia: 2,
  cierre_revertido: CIERRE.cierre_id,
  motivo: 'ARQUEO MAL CONTADO',
  registrado_en: '2026-10-02T18:45:00.123456-05:00',
  usuario: 'supervisora@caja.test',
  observacion: 'se contó mal el cajón',
  estado_del_turno: 'ABIERTO'
}

// what GET /turnos/del-dia and /arqueo read (caja-backend's 403 names them)
const LECTURAS = ['turno', 'caja', 'recibo', 'anulacion_recibo', 'pago_evento', 'cierre_turno', 'reversion_cierre']
const lee = Object.fromEntries(LECTURAS.map((objeto) => [objeto, ['READ']]))
// a cashier: reads and closes (the acta and its lines)
const CAJERO: CallerPermissions = { admin: false, objects: { ...lee, cierre_turno: ['READ', 'CREATE'], cierre_turno_linea: ['READ', 'CREATE'] } }
// a supervisor of the caja: reverses too
const SUPERVISOR: CallerPermissions = { admin: false, objects: { ...CAJERO.objects, reversion_cierre: ['READ', 'CREATE'] } }
const SUPERVISORA: AuthUser = { ...CAJERA, id: 'u-supervisora', email: 'supervisora@caja.test', roles: ['SUPERVISOR_CAJA'] }

let fetch: FetchMock | null = null
let rutas: MockRoute[] = []

const rutaDe = (method: string, path: string) => rutas.find((r) => (r.method ?? 'GET') === method && r.path === path)!
const problema = (status: number, detail: string, errors?: { field: string; message: string }[]) => ({
  title: 'Error',
  status,
  detail,
  ...(errors ? { errors } : {})
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // only the date: 12:00 of 2026-10-02 in Lima. the timers stay real, for user-event
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-02T17:00:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
  fetch?.restore()
  fetch = null
})

function start({
  path = '/cierre-caja',
  permisos = CAJERO,
  user = CAJERA,
  delDelDia = delDia('ABIERTO', [EN_C01])
}: { path?: string; permisos?: CallerPermissions; user?: AuthUser; delDelDia?: unknown } = {}) {
  abrirSesion(user)
  rutas = [
    { method: 'GET', path: '/caja/turnos/del-dia', body: delDelDia },
    { method: 'GET', path: `/caja/turnos/${T1}/arqueo`, body: arqueo(T1) },
    { method: 'GET', path: `/caja/turnos/${T2}/arqueo`, body: arqueo(T2, { arqueo: { ...EN_VIVO, lineas: [linea('EFECTIVO', '12.00', '0.00', '12.00')] } }) },
    { method: 'POST', path: '/caja/turnos/cierre', status: 201, body: CIERRE },
    { method: 'POST', path: '/caja/turnos/reversion', status: 201, body: REVERSION },
    { method: 'GET', path: '/caja/pagos/sin-entregar', body: [] },
    ...rutasDeSesion(user, permisos)
  ]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  render(<PortalApp />)
}

const main = () => within(screen.getByRole('main'))
const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ').replace(/ +/g, ' ').trim()
const llamadas = (method: string, path: string) => fetch!.calls.filter((c) => c.method === method && c.path.split('?')[0] === path)
const enLaRuta = () => window.location.pathname + window.location.search
const situacion = async () => texto(await main().findByTestId('situacion'))
// the cells of a row, headers or data, as they read
const celdas = (tr: Element) => [...tr.querySelectorAll('th, td')].map((celda) => texto(celda))
const tablaDeArqueo = (nombre = 'Arqueo') => main().findByRole('table', { name: nombre })
const filas = async (nombre = 'Arqueo') =>
  within(await tablaDeArqueo(nombre))
    .getAllByRole('row')
    .map((tr) => celdas(tr))
const botonCerrar = () => main().findByRole('button', { name: 'Cerrar el turno' })
const botonReversar = () => main().findByRole('button', { name: 'Reversar el cierre' })
const elCierre = () => within(screen.getByRole('region', { name: 'Cerrar el turno' }))
const laReversion = () => within(screen.getByRole('region', { name: 'Reversar el cierre' }))
const declarado = (forma: string) => elCierre().getByRole('textbox', { name: `Declarado en ${forma}` })

async function escribir(campo: HTMLElement, valor: string) {
  await userEvent.clear(campo)
  if (valor) await userEvent.type(campo, valor)
}

// the arqueo of the turno chosen is on screen, and the cierre may go
async function listoParaCerrar() {
  await tablaDeArqueo()
  await waitFor(async () => expect(await botonCerrar()).toBeEnabled())
}

// the live arqueo (EN_VIVO) has movement in Efectivo and Tarjeta: both ask for an explicit value
async function llenarYCerrar({
  declarados = { Efectivo: '187.40', Tarjeta: '0' } as Record<string, string>,
  observacion = 'cierre del turno de la mañana'
} = {}) {
  await listoParaCerrar()
  for (const [forma, valor] of Object.entries(declarados)) await escribir(declarado(forma), valor)
  await escribir(elCierre().getByRole('textbox', { name: 'Observación' }), observacion)
  await userEvent.click(await botonCerrar())
}

async function confirmarElCierre() {
  const dialogo = await screen.findByRole('dialog', { name: 'Confirmar el cierre' })
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar el turno' }))
}

async function llenarYReversar({ motivo = 'ARQUEO MAL CONTADO', observacion = 'se contó mal el cajón' } = {}) {
  await waitFor(async () => expect(await botonReversar()).toBeEnabled())
  await escribir(laReversion().getByRole('textbox', { name: 'Motivo' }), motivo)
  await escribir(laReversion().getByRole('textbox', { name: 'Observación' }), observacion)
  await userEvent.click(await botonReversar())
}

async function confirmarLaReversion() {
  const dialogo = await screen.findByRole('dialog', { name: 'Confirmar la reversión' })
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Reversar' }))
}

// a closed turno, as a supervisor sees it
function cerrado({ permisos = SUPERVISOR, user = SUPERVISORA }: { permisos?: CallerPermissions; user?: AuthUser } = {}) {
  start({ permisos, user, delDelDia: delDia('CERRADO', [{ ...EN_C01, estado_del_turno: 'CERRADO' }]) })
  rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, { estado_del_turno: 'CERRADO', puede_cerrar: false })
}

describe('Cierre y arqueo de caja: the leaf', () => {
  it('is offered with READ on turno, and its screen reads today’s turno', async () => {
    start()
    expect(await main().findByRole('heading', { name: 'Cierre y arqueo de caja', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Cierre y arqueo de caja' }).length).toBeGreaterThan(0)
    await situacion()
    expect(llamadas('GET', '/caja/turnos/del-dia').map((c) => c.path)).toEqual(['/caja/turnos/del-dia'])
  })

  it('is kept by the same pair: without READ on turno its url says what the account lacks', async () => {
    start({ permisos: { admin: false, objects: { caja: ['READ'] } } })
    expect(await main().findByText('Su cuenta no puede abrir «Cierre y arqueo de caja»: le falta lectura de turno.')).toBeInTheDocument()
    expect(fetch!.calls.filter((c) => c.path.startsWith('/caja/'))).toEqual([])
  })
})

describe('Cierre y arqueo de caja: today’s turno', () => {
  it.each([
    [
      'SIN_ABRIR',
      delDia('SIN_ABRIR', []),
      'Hoy todavía no abrió ningún turno: el turno se abre con el primer cobro del día. No hay nada que arquear ni que cerrar.'
    ],
    ['ABIERTO', delDia('ABIERTO', [EN_C01]), 'Tiene un turno abierto: al terminar el día, cuente el cajón y ciérrelo aquí.'],
    [
      'CERRADO',
      delDia('CERRADO', [{ ...EN_C01, estado_del_turno: 'CERRADO' }]),
      'Su turno de hoy está cerrado. Para seguir cobrando no se abre otro: se reversa su cierre. Un cierre solo se reversa desde la cuenta del cajero del turno, con el permiso de reversión.'
    ],
    ['VARIOS_ABIERTOS', delDia('VARIOS_ABIERTOS', [EN_C01, EN_C02]), 'Tiene turnos abiertos en más de una caja: elija cuál va a arquear y cerrar.']
  ])('says %s in words', async (_situacion, respuesta, frase) => {
    start({ delDelDia: respuesta })
    expect(await situacion()).toBe(frase)
  })

  it('lists its turnos with the caja, when it was opened (in Lima) and its state', async () => {
    start({ delDelDia: delDia('VARIOS_ABIERTOS', [EN_C01, { ...EN_C02, caja_nombre: null, estado_del_turno: 'CERRADO' }]) })
    const turnos = await main().findByRole('table', { name: 'Turnos de hoy' })
    expect(within(turnos).getAllByRole('row').map(celdas)).toEqual([
      ['Caja', 'Abierto el', 'Estado', 'Arquear'],
      ['C-01 — VENTANILLA 1', '02/10/2026 08:01 (hora de Lima)', 'Abierto', 'Arquear'],
      ['C-02', '02/10/2026 09:30 (hora de Lima)', 'Cerrado', 'Arquear']
    ])
    expect(texto(main().getByTestId('turno-del-dia'))).toContain(`Cajero: ${CAJERA.email} · Día: 02/10/2026`)
  })

  it('says it when today’s turno cannot be read, with the backend’s detail', async () => {
    start()
    Object.assign(rutaDe('GET', '/caja/turnos/del-dia'), {
      status: 403,
      body: problema(403, 'Leer turno exige permiso de lectura sobre cierre_turno')
    })
    expect(await main().findByText('No se pudo leer su turno de hoy: Leer turno exige permiso de lectura sobre cierre_turno')).toBeInTheDocument()
  })
})

describe('Cierre y arqueo de caja: the turno chosen lives in the route', () => {
  it('with several turnos none is chosen; the one chosen goes to ?turno=, and a reload shows the same', async () => {
    start({ delDelDia: delDia('VARIOS_ABIERTOS', [EN_C01, EN_C02]) })
    expect(await main().findByText('Elija el turno que va a arquear con «Arquear».')).toBeInTheDocument()
    expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(0)
    expect(llamadas('GET', `/caja/turnos/${T2}/arqueo`)).toHaveLength(0)

    await userEvent.click(main().getByRole('button', { name: 'Arquear el turno de C-02' }))
    await waitFor(() => expect(enLaRuta()).toBe(`/cierre-caja?turno=${T2}`))
    expect(await main().findByRole('heading', { name: 'Arqueo del turno de la caja C-02' })).toBeInTheDocument()
    expect((await filas())[1]).toEqual(['Efectivo', 'S/ 12.00', 'S/ 0.00', 'S/ 12.00', '— sin declarar', '— sin declarar'])

    cleanup()
    fetch!.restore()
    start({ path: `/cierre-caja?turno=${T2}`, delDelDia: delDia('VARIOS_ABIERTOS', [EN_C01, EN_C02]) })
    expect(await main().findByRole('heading', { name: 'Arqueo del turno de la caja C-02' })).toBeInTheDocument()
    expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(0)
  })

  it('takes the only turno of the day without asking', async () => {
    start()
    expect(await main().findByRole('heading', { name: 'Arqueo del turno de la caja C-01' })).toBeInTheDocument()
  })

  it('says a turno of the url that is not one of today’s, and chooses none', async () => {
    start({ path: '/cierre-caja?turno=otro' })
    expect(await main().findByText('El turno de la dirección no es uno de sus turnos de hoy: elija uno de la lista.')).toBeInTheDocument()
    expect(fetch!.calls.filter((c) => c.path.includes('/arqueo'))).toEqual([])
  })
})

describe('Cierre y arqueo de caja: the arqueo', () => {
  it('draws the backend’s figures by forma de pago with their date, and says «sin declarar», never 0, for what nobody counted', async () => {
    start()
    expect(await filas()).toEqual([
      ['Forma de pago', 'Cobrado', 'Anulado', 'Neto', 'Declarado', 'Diferencia'],
      ['Efectivo', 'S/ 187.40', 'S/ 0.00', 'S/ 187.40', '— sin declarar', '— sin declarar'],
      ['Tarjeta', 'S/ 80.25', 'S/ 80.25', 'S/ 0.00', '— sin declarar', '— sin declarar'],
      ['Total', 'S/ 268.35', 'S/ 80.25', 'S/ 188.10', '— sin declarar', '— sin declarar']
    ])
    // the date of the table's figures, once
    expect(texto(await tablaDeArqueo())).toContain('Cifras al 02/10/2026')
    const tabla = await tablaDeArqueo()
    for (const tr of within(tabla).getAllByRole('row').slice(1)) {
      const [, , , , dec, dif] = celdas(tr)
      expect(dec).not.toMatch(/\d/)
      expect(dif).not.toMatch(/\d/)
    }
  })

  it('shows the receipts, the two halves with and without event, the state and that the difference comes at closing', async () => {
    start()
    await tablaDeArqueo()
    const resumen = texto(main().getByTestId('resumen-del-arqueo'))
    expect(resumen).toContain('Recibos emitidos: 4')
    expect(resumen).toContain('Recibos anulados: 1')
    expect(resumen).toContain('Cobrado con evento: S/ 150.50 al 02/10/2026')
    expect(resumen).toContain('Cobrado sin evento: S/ 37.60 al 02/10/2026')
    expect(resumen).toContain('Estado del turno: Abierto')
    expect(resumen).toContain('¿Cuadra?: — sin declarar: el backend lo dice al cerrar')
    expect(main().getByText('Lo declarado y la diferencia los da el backend al cerrar, con lo que usted contó.')).toBeInTheDocument()
  })

  it('on a closed turno, says the live arqueo does not keep what was declared — the cierre did — and promises nothing «al cerrar»', async () => {
    cerrado()
    const enVivo = 'el arqueo en vivo no guarda lo declarado: lo guardó el cierre'
    expect(await filas()).toEqual([
      ['Forma de pago', 'Cobrado', 'Anulado', 'Neto', 'Declarado', 'Diferencia'],
      ['Efectivo', 'S/ 187.40', 'S/ 0.00', 'S/ 187.40', `— ${enVivo}`, `— ${enVivo}`],
      ['Tarjeta', 'S/ 80.25', 'S/ 80.25', 'S/ 0.00', `— ${enVivo}`, `— ${enVivo}`],
      ['Total', 'S/ 268.35', 'S/ 80.25', 'S/ 188.10', `— ${enVivo}`, `— ${enVivo}`]
    ])
    const seccion = texto(screen.getByRole('region', { name: 'Arqueo del turno de la caja C-01' }))
    expect(seccion).toContain('Este turno está cerrado: el arqueo en vivo no guarda lo declarado ni la diferencia, que quedaron en el acta del cierre.')
    expect(texto(main().getByTestId('resumen-del-arqueo'))).toContain('¿Cuadra?: — el arqueo en vivo no lo guarda: lo dice el acta del cierre')
    expect(seccion).not.toMatch(/al cerrar/)
    expect(seccion).not.toMatch(/sin declarar/)
    expect(texto(screen.getByRole('main'))).not.toMatch(/supervisor/i)
  })

  it('lists what keeps it from closing: each payment with its id, its kind and its state', async () => {
    start()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, {
      puede_cerrar: false,
      lo_que_impide_cerrar: [
        { pago_id: PAGO, tipo: 'PAGO_REGISTRADO', estado: 'PENDIENTE' },
        { pago_id: '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e', tipo: 'PAGO_ANULADO', estado: 'MUERTO' }
      ]
    })
    const lista = await main().findByRole('list', { name: 'Pagos sin entregar' })
    expect(
      within(lista)
        .getAllByRole('listitem')
        .map((li) => texto(li))
    ).toEqual([`${PAGO} · Pago registrado · Pendiente de entrega`, '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e · Pago anulado · No se pudo entregar'])
  })

  it('has no line to show for a turno with no movement, and says so', async () => {
    start()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, {
      arqueo: { ...EN_VIVO, lineas: [], total_cobrado: cifra('0.00'), total_anulado: cifra('0.00'), neto: cifra('0.00') }
    })
    expect(await main().findByText('Este turno no tiene movimiento.')).toBeInTheDocument()
  })

  it.each([
    [403, 'Leer el arqueo exige permiso de lectura sobre pago_evento'],
    [404, `No hay ningún turno ${T1}`]
  ])('says a %i of the arqueo with its detail', async (status, detail) => {
    start()
    Object.assign(rutaDe('GET', `/caja/turnos/${T1}/arqueo`), { status, body: problema(status, detail) })
    expect(await main().findByText(`No se pudo leer el arqueo: ${detail}`)).toBeInTheDocument()
  })
})

describe('Cierre y arqueo de caja: cerrar', () => {
  it('confirms first, sends what was declared as the exact strings typed, and shows the acta with the backend’s difference', async () => {
    start()
    await llenarYCerrar({ declarados: { Efectivo: '187.40', Cheque: '20.00', Transferencia: '120.50', Tarjeta: '0' } })

    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar el cierre' })
    expect(texto(dialogo)).toContain('Se cierra el turno de la caja C-01 del 02/10/2026 con lo que usted contó:')
    expect(texto(dialogo)).toContain('Efectivo: 187.40')
    expect(texto(dialogo)).toContain('Transferencia: 120.50')
    expect(texto(dialogo)).toContain('Tarjeta: 0')
    expect(texto(dialogo)).toContain('En blanco, el backend las cierra en cero: Depósito.')
    expect(texto(dialogo)).toContain('La diferencia la calcula el backend al cerrar')
    expect(texto(dialogo)).toContain(
      'Un cierre no se modifica: si hay que rehacerlo, se reversa desde esta misma cuenta, con el permiso de reversión, y se cierra otra vez.'
    )
    expect(texto(dialogo)).not.toMatch(/supervisor/i)
    expect(llamadas('POST', '/caja/turnos/cierre')).toHaveLength(0)

    rutaDe('GET', '/caja/turnos/del-dia').body = delDia('CERRADO', [{ ...EN_C01, estado_del_turno: 'CERRADO' }])
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, { estado_del_turno: 'CERRADO', puede_cerrar: false })
    await confirmarElCierre()

    expect(await main().findByText('El turno quedó cerrado.')).toBeInTheDocument()
    const [enviado] = llamadas('POST', '/caja/turnos/cierre')
    expect(enviado.body).toEqual({
      caja: 'C-01',
      fecha: AL,
      declarado: { EFECTIVO: '187.40', CHEQUE: '20.00', TARJETA: '0', TRANSFERENCIA: '120.50' },
      observacion: 'cierre del turno de la mañana'
    })
    for (const valor of Object.values((enviado.body as { declarado: Record<string, unknown> }).declarado)) expect(typeof valor).toBe('string')

    // the acta's figures are the backend's: 0.05 of difference is no subtraction of what was typed
    expect(await filas('Arqueo del cierre')).toEqual([
      ['Forma de pago', 'Cobrado', 'Anulado', 'Neto', 'Declarado', 'Diferencia'],
      ['Efectivo', 'S/ 187.40', 'S/ 0.00', 'S/ 187.40', 'S/ 187.40', 'S/ 0.05'],
      ['Cheque', 'S/ 0.00', 'S/ 0.00', 'S/ 0.00', 'S/ 20.00', 'S/ 20.00'],
      ['Total', 'S/ 268.35', 'S/ 80.25', 'S/ 188.10', 'S/ 207.40', 'S/ 19.30']
    ])
    const acta = texto(main().getByTestId('acta-del-cierre'))
    expect(acta).toContain('Secuencia: 1')
    expect(acta).toContain('Registrado el: 02/10/2026 18:30 (hora de Lima)')
    expect(acta).toContain(`Por: ${CAJERA.email}`)
    expect(acta).toContain('¿Cuadra?: No: el descuadre quedó registrado en el acta.')

    // the state is the one read again, never set here
    await waitFor(() => expect(llamadas('GET', '/caja/turnos/del-dia')).toHaveLength(2))
    await waitFor(() => expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(2))
    expect(await situacion()).toBe(
      'Su turno de hoy está cerrado. Para seguir cobrando no se abre otro: se reversa su cierre. Un cierre solo se reversa desde la cuenta del cajero del turno, con el permiso de reversión.'
    )
    expect(await botonCerrar()).toHaveAccessibleDescription(
      'Este turno ya está cerrado: un cierre no se modifica. Para rehacerlo, se reversa (más abajo) y se cierra otra vez.'
    )
  })

  it('sends no declarado that was not typed', async () => {
    start()
    await llenarYCerrar()
    expect(texto(await screen.findByRole('dialog', { name: 'Confirmar el cierre' }))).toContain(
      'En blanco, el backend las cierra en cero: Cheque, Depósito, Transferencia.'
    )
    await confirmarElCierre()
    await main().findByText('El turno quedó cerrado.')
    expect(llamadas('POST', '/caja/turnos/cierre')[0].body).toEqual({
      caja: 'C-01',
      fecha: AL,
      declarado: { EFECTIVO: '187.40', TARJETA: '0' },
      observacion: 'cierre del turno de la mañana'
    })
  })

  it('says a blank declarado closes in zero, never «sin declarar», where nothing moved', async () => {
    start()
    await listoParaCerrar()
    for (const forma of ['Cheque', 'Depósito', 'Transferencia']) {
      expect(declarado(forma)).toHaveAttribute('placeholder', 'en blanco: cero')
      expect(declarado(forma)).toHaveValue('')
    }
    for (const forma of ['Efectivo', 'Cheque', 'Depósito', 'Tarjeta', 'Transferencia'])
      expect(declarado(forma).getAttribute('placeholder')).not.toMatch(/sin declarar/)
    expect(texto(elCierre().getByRole('group', { name: 'Lo declarado' }))).toContain(
      'Las formas de pago con movimiento en el arqueo piden lo que contó, aunque sea 0; las demás, en blanco, el backend las cierra en cero.'
    )
  })

  it('asks an explicit value, even 0, for each forma de pago with movement in the live arqueo, and sends nothing', async () => {
    start()
    await llenarYCerrar({ declarados: { Efectivo: '', Tarjeta: '' } })
    const mensaje = 'Este turno tuvo movimiento en esta forma de pago: escriba lo que contó, aunque sea 0.'
    expect(declarado('Efectivo')).toHaveAttribute('placeholder', 'lo que contó, aunque sea 0')
    await waitFor(() => expect(declarado('Efectivo')).toHaveAccessibleDescription(mensaje))
    expect(declarado('Tarjeta')).toHaveAccessibleDescription(mensaje)
    expect(declarado('Cheque')).not.toHaveAccessibleDescription(mensaje)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(llamadas('POST', '/caja/turnos/cierre')).toHaveLength(0)

    // a 0 typed is an explicit value: it goes as typed
    await escribir(declarado('Efectivo'), '0')
    await escribir(declarado('Tarjeta'), '0.00')
    await userEvent.click(await botonCerrar())
    await confirmarElCierre()
    await main().findByText('El turno quedó cerrado.')
    expect(llamadas('POST', '/caja/turnos/cierre')[0].body).toMatchObject({ declarado: { EFECTIVO: '0', TARJETA: '0.00' } })
  })

  it.each([['120,50'], ['-5.00'], ['1.234'], ['12a'], ['12345678901234']])(
    'refuses %s as a declared amount, under its field, and sends nothing',
    async (tecleado) => {
      start()
      await llenarYCerrar({ declarados: { Efectivo: tecleado } })
      const mensaje = 'Escriba el importe sin signo, con punto decimal y a lo sumo 2 decimales (por ejemplo 120.50).'
      expect(await elCierre().findByText(mensaje)).toBeInTheDocument()
      expect(declarado('Efectivo')).toHaveAccessibleDescription(mensaje)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(llamadas('POST', '/caja/turnos/cierre')).toHaveLength(0)
    }
  )

  it('asks for an observation of 5 to 500 characters', async () => {
    start()
    await llenarYCerrar({ observacion: 'no' })
    expect(await elCierre().findByText('Explique el cierre: de 5 a 500 caracteres.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says a 400 under declarado and under the observation, and one of another field above the button', async () => {
    start()
    Object.assign(rutaDe('POST', '/caja/turnos/cierre'), {
      status: 400,
      body: problema(400, 'El cierre no es válido', [
        { field: 'declarado', message: 'YAPE no es una forma de pago' },
        { field: 'observacion', message: 'a lo sumo 500 caracteres' },
        { field: 'fecha', message: 'no puede ser futura' }
      ])
    })
    await llenarYCerrar()
    await confirmarElCierre()
    expect(await elCierre().findByText('YAPE no es una forma de pago')).toBeInTheDocument()
    expect(elCierre().getByRole('group', { name: 'Lo declarado' })).toHaveAccessibleDescription('YAPE no es una forma de pago')
    expect(elCierre().getByRole('textbox', { name: 'Observación' })).toHaveAccessibleDescription('a lo sumo 500 caracteres')
    expect(elCierre().getByRole('alert')).toHaveTextContent('Fecha: no puede ser futura')
  })

  it('says a 409 «ya está cerrado» with its detail, and reads the turno again', async () => {
    start()
    const detail = `El turno de ${CAJERA.email} en la caja C-01 del 2026-10-02 ya está cerrado. Un cierre no se modifica: si hay que rehacerlo, se reversa`
    Object.assign(rutaDe('POST', '/caja/turnos/cierre'), { status: 409, body: problema(409, detail) })
    await llenarYCerrar()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, { estado_del_turno: 'CERRADO', puede_cerrar: false })
    await confirmarElCierre()
    expect(await elCierre().findByRole('alert')).toHaveTextContent(detail)
    await waitFor(() => expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(2))
    expect(await botonCerrar()).toBeDisabled()
  })

  it('says a 409 «Hay pagos sin entregar» and lists the payments the backend returns', async () => {
    start()
    const detail = `Hay pagos sin entregar a su sistema de origen: ${PAGO} (PAGO_REGISTRADO, PENDIENTE). El turno no se cierra hasta entregarlos`
    Object.assign(rutaDe('POST', '/caja/turnos/cierre'), { status: 409, body: problema(409, detail) })
    await llenarYCerrar()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, SIN_ENTREGAR)
    await confirmarElCierre()
    expect(await elCierre().findByRole('alert')).toHaveTextContent(detail)
    const lista = await main().findByRole('list', { name: 'Pagos sin entregar' })
    expect(texto(lista)).toBe(`${PAGO} · Pago registrado · Pendiente de entrega`)
  })

  it.each([
    [403, 'Cerrar un turno exige permiso de creación sobre cierre_turno_linea'],
    [404, `El cajero ${CAJERA.email} no abrió turno en la caja C-01 el 2026-10-02: no hay nada que arquear`]
  ])('says a %i with its detail', async (status, detail) => {
    start()
    Object.assign(rutaDe('POST', '/caja/turnos/cierre'), { status, body: problema(status, detail) })
    await llenarYCerrar()
    await confirmarElCierre()
    expect(await elCierre().findByRole('alert')).toHaveTextContent(detail)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the draft of a 401 by the turno, and gives it back to that turno and not another', async () => {
    start({ delDelDia: delDia('VARIOS_ABIERTOS', [EN_C01, EN_C02]), path: `/cierre-caja?turno=${T1}` })
    Object.assign(rutaDe('POST', '/caja/turnos/cierre'), { status: 401, body: { title: 'Unauthorized', status: 401 } })
    await llenarYCerrar({ declarados: { Efectivo: '187.40', Tarjeta: '0.70' } })
    await confirmarElCierre()

    await screen.findByLabelText('Contraseña')
    expect(JSON.parse(sessionStorage.getItem(`caja.borrador.cierre.${T1}`) ?? 'null')).toEqual({
      cuenta: CAJERA.id,
      campos: {
        'declarado.EFECTIVO': '187.40',
        'declarado.CHEQUE': '',
        'declarado.DEPOSITO': '',
        'declarado.TARJETA': '0.70',
        'declarado.TRANSFERENCIA': '',
        observacion: 'cierre del turno de la mañana'
      }
    })

    rutas.unshift({ method: 'POST', path: '/auth/login', body: { token: 'nuevo', expiresAt: '2026-12-31T00:00:00Z', user: CAJERA } })
    await volverAEntrar(CAJERA)

    expect(await main().findByRole('heading', { name: 'Arqueo del turno de la caja C-01' })).toBeInTheDocument()
    expect(enLaRuta()).toBe(`/cierre-caja?turno=${T1}`)
    await waitFor(() => expect(declarado('Efectivo')).toHaveValue('187.40'))
    expect(declarado('Tarjeta')).toHaveValue('0.70')
    expect(elCierre().getByRole('textbox', { name: 'Observación' })).toHaveValue('cierre del turno de la mañana')
    expect(elCierre().getByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).toBeInTheDocument()

    // the other turno: its cierre is its own, empty
    await userEvent.click(main().getByRole('button', { name: 'Arquear el turno de C-02' }))
    await main().findByRole('heading', { name: 'Arqueo del turno de la caja C-02' })
    await waitFor(() => expect(declarado('Efectivo')).toHaveValue(''))
    expect(elCierre().queryByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).not.toBeInTheDocument()
    expect(sessionStorage.getItem(`caja.borrador.cierre.${T1}`)).not.toBeNull()
  })

  it('does not hand a turno the draft of another one', async () => {
    guardarBorrador(`cierre.${T2}`, CAJERA.id, { 'declarado.EFECTIVO': '99.99', observacion: 'el de otro turno' })
    start()
    await listoParaCerrar()
    expect(declarado('Efectivo')).toHaveValue('')
  })
})

describe('Cierre y arqueo de caja: reversar', () => {
  it('confirms first, sends the motive and the observation, and the turno is open again because it is read again', async () => {
    cerrado()
    await llenarYReversar()
    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar la reversión' })
    expect(texto(dialogo)).toContain('Se reversa el cierre del turno de la caja C-01 del 02/10/2026.')
    expect(texto(dialogo)).toContain('Motivo: ARQUEO MAL CONTADO')
    // the section, behind the modal dialog
    expect(texto(screen.getByRole('region', { name: 'Reversar el cierre', hidden: true }))).toContain(
      'Solo se reversa el cierre del propio turno, desde la cuenta del cajero que lo cerró, y hace falta el permiso de reversión.'
    )
    expect(llamadas('POST', '/caja/turnos/reversion')).toHaveLength(0)

    rutaDe('GET', '/caja/turnos/del-dia').body = delDia('ABIERTO', [EN_C01])
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1)
    await confirmarLaReversion()

    expect(await main().findByText('Se reversó el cierre del turno de la caja C-01.')).toBeInTheDocument()
    expect(llamadas('POST', '/caja/turnos/reversion')[0].body).toEqual({
      caja: 'C-01',
      fecha: AL,
      motivo: 'ARQUEO MAL CONTADO',
      observacion: 'se contó mal el cajón'
    })
    await waitFor(async () => expect(await situacion()).toBe('Tiene un turno abierto: al terminar el día, cuente el cajón y ciérrelo aquí.'))
    const turnos = await main().findByRole('table', { name: 'Turnos de hoy' })
    expect(texto(within(turnos).getAllByRole('row')[1])).toContain('Abierto')
    expect(await botonReversar()).toHaveAccessibleDescription('Este turno está abierto: no hay ningún cierre que reversar.')
    expect(await botonCerrar()).toBeEnabled()
  })

  it('never changes the state here: if the backend still says CERRADO when read again, so does the screen', async () => {
    cerrado()
    await llenarYReversar()
    await confirmarLaReversion()
    await main().findByText('Se reversó el cierre del turno de la caja C-01.')
    await waitFor(() => expect(llamadas('GET', '/caja/turnos/del-dia')).toHaveLength(2))
    const turnos = await main().findByRole('table', { name: 'Turnos de hoy' })
    expect(texto(within(turnos).getAllByRole('row')[1])).toContain('Cerrado')
  })

  it('asks for the motive (up to 80) and the observation (5 to 500)', async () => {
    cerrado()
    await llenarYReversar({ motivo: '', observacion: 'no' })
    expect(await laReversion().findByText('Escriba el motivo de la reversión.')).toBeInTheDocument()
    expect(laReversion().getByText('Explique la reversión: de 5 a 500 caracteres.')).toBeInTheDocument()
    await llenarYReversar({ motivo: 'M'.repeat(81) })
    expect(await laReversion().findByText('A lo sumo 80 caracteres.')).toBeInTheDocument()
    expect(laReversion().getByRole('textbox', { name: 'Motivo' })).toHaveAccessibleDescription('A lo sumo 80 caracteres.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(llamadas('POST', '/caja/turnos/reversion')).toHaveLength(0)
  })

  it('says a 400 under its field', async () => {
    cerrado()
    Object.assign(rutaDe('POST', '/caja/turnos/reversion'), {
      status: 400,
      body: problema(400, 'La reversión no es válida', [{ field: 'motivo', message: 'no puede estar en blanco' }])
    })
    await llenarYReversar()
    await confirmarLaReversion()
    expect(await laReversion().findByText('no puede estar en blanco')).toBeInTheDocument()
    expect(laReversion().getByRole('textbox', { name: 'Motivo' })).toHaveAccessibleDescription('no puede estar en blanco')
  })

  it.each([
    [403, 'Reversar un cierre exige permiso de creación sobre reversion_cierre'],
    [404, 'No hay ninguna caja con el código C-01'],
    [409, `Nada que reversar: el turno de ${CAJERA.email} en la caja C-01 del 2026-10-02 no está cerrado`]
  ])('says a %i with its detail', async (status, detail) => {
    cerrado()
    Object.assign(rutaDe('POST', '/caja/turnos/reversion'), { status, body: problema(status, detail) })
    await llenarYReversar()
    await confirmarLaReversion()
    expect(await laReversion().findByRole('alert')).toHaveTextContent(detail)
  })

  it('keeps the draft of a 401 by the turno', async () => {
    cerrado()
    Object.assign(rutaDe('POST', '/caja/turnos/reversion'), { status: 401, body: { title: 'Unauthorized', status: 401 } })
    await llenarYReversar()
    await confirmarLaReversion()
    await screen.findByLabelText('Contraseña')
    expect(JSON.parse(sessionStorage.getItem(`caja.borrador.reversion.${T1}`) ?? 'null')).toEqual({
      cuenta: SUPERVISORA.id,
      campos: { motivo: 'ARQUEO MAL CONTADO', observacion: 'se contó mal el cajón' }
    })
  })
})

// the acta of the cierre in force, as caja-backend's arqueo of a closed turno carries it (cierre_vigente, PR #22): the
// arqueo as it was declared, its date the turno's. its diferencia is the backend's (-6.90 of 30.00 declared over 36.90)
const CIERRE_VIGENTE = {
  cierre_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  secuencia: 1,
  fecha: AL,
  registrado_en: '2026-10-02T18:30:05.123456-05:00',
  usuario: 'ana@muni.gob.pe',
  observacion: 'cierre del turno de la mañana',
  arqueo: {
    lineas: [linea('EFECTIVO', '36.90', '0.00', '36.90', '30.00', '-6.90'), linea('TARJETA', '12.30', '0.00', '12.30', '12.30', '0.00')],
    recibos_emitidos: 2,
    recibos_anulados: 0,
    total_cobrado: cifra('49.20'),
    total_anulado: cifra('0.00'),
    neto: cifra('49.20'),
    total_declarado: cifra('42.30'),
    diferencia: cifra('-6.90'),
    cuadra: false
  },
  cobrado_con_evento: cifra('0.00'),
  cobrado_sin_evento: cifra('49.20')
}

describe('Cierre y arqueo de caja: the acta of the cierre in force', () => {
  it('shows the acta of a closed turno after a reload, as the backend kept it, with nothing recomputed', async () => {
    cerrado()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, { estado_del_turno: 'CERRADO', puede_cerrar: false, cierre_vigente: CIERRE_VIGENTE })

    expect(await filas('Arqueo del cierre')).toEqual([
      ['Forma de pago', 'Cobrado', 'Anulado', 'Neto', 'Declarado', 'Diferencia'],
      ['Efectivo', 'S/ 36.90', 'S/ 0.00', 'S/ 36.90', 'S/ 30.00', '-S/ 6.90'],
      ['Tarjeta', 'S/ 12.30', 'S/ 0.00', 'S/ 12.30', 'S/ 12.30', 'S/ 0.00'],
      ['Total', 'S/ 49.20', 'S/ 0.00', 'S/ 49.20', 'S/ 42.30', '-S/ 6.90']
    ])
    expect(texto(await tablaDeArqueo('Arqueo del cierre'))).toContain('Cifras al 02/10/2026')
    expect(main().getByRole('heading', { name: 'Acta del cierre vigente del 02/10/2026' })).toBeInTheDocument()
    const acta = texto(main().getByTestId('acta-del-cierre'))
    expect(acta).toContain('Secuencia: 1')
    expect(acta).toContain('Registrado el: 02/10/2026 18:30 (hora de Lima)')
    expect(acta).toContain('Por: ana@muni.gob.pe')
    expect(acta).toContain('Observación: cierre del turno de la mañana')
    expect(acta).toContain('Cobrado con evento: S/ 0.00 al 02/10/2026')
    expect(acta).toContain('Cobrado sin evento: S/ 49.20 al 02/10/2026')
    expect(acta).toContain('¿Cuadra?: No: el descuadre quedó registrado en el acta.')
    expect(texto(screen.getByRole('region', { name: 'Acta del cierre vigente del 02/10/2026' }))).not.toMatch(/sin declarar/)
    // read, never written: the reload closed nothing
    expect(llamadas('POST', '/caja/turnos/cierre')).toHaveLength(0)
  })

  it('says whether it squares as the backend does', async () => {
    cerrado()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, {
      estado_del_turno: 'CERRADO',
      puede_cerrar: false,
      cierre_vigente: { ...CIERRE_VIGENTE, arqueo: { ...CIERRE_VIGENTE.arqueo, cuadra: true } }
    })
    expect(texto(await main().findByTestId('acta-del-cierre'))).toContain('¿Cuadra?: Sí: lo declarado coincide con el neto.')
  })

  it('has no acta for an open turno (cierre_vigente null)', async () => {
    start()
    await tablaDeArqueo()
    expect(main().queryByTestId('acta-del-cierre')).not.toBeInTheDocument()
    expect(main().queryByRole('table', { name: 'Arqueo del cierre' })).not.toBeInTheDocument()
  })

  it('after closing here, shows the acta once: the one the arqueo read again carries', async () => {
    start()
    await llenarYCerrar()
    rutaDe('GET', '/caja/turnos/del-dia').body = delDia('CERRADO', [{ ...EN_C01, estado_del_turno: 'CERRADO' }])
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, { estado_del_turno: 'CERRADO', puede_cerrar: false, cierre_vigente: CIERRE_VIGENTE })
    await confirmarElCierre()
    expect(await main().findByText('El turno quedó cerrado.')).toBeInTheDocument()
    await waitFor(() => expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(2))
    await waitFor(async () => expect((await filas('Arqueo del cierre'))[1]).toEqual(['Efectivo', 'S/ 36.90', 'S/ 0.00', 'S/ 36.90', 'S/ 30.00', '-S/ 6.90']))
    expect(main().getAllByRole('table', { name: 'Arqueo del cierre' })).toHaveLength(1)
    expect(main().getAllByTestId('acta-del-cierre')).toHaveLength(1)
  })

  it('after a reversal, never shows the acta of the cierre reversed, not even while the arqueo is read again', async () => {
    cerrado()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, { estado_del_turno: 'CERRADO', puede_cerrar: false, cierre_vigente: CIERRE_VIGENTE })
    await main().findByTestId('acta-del-cierre')
    await llenarYReversar()
    rutaDe('GET', '/caja/turnos/del-dia').body = delDia('ABIERTO', [EN_C01])
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1)
    // the arqueo read again is held: the screen still has the old one, with the cierre that was just reversed
    const delMock = globalThis.fetch
    let soltar = () => {}
    const retenida = new Promise<void>((resolve) => (soltar = resolve))
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.includes(`/caja/turnos/${T1}/arqueo`)) await retenida
      return delMock(input, init)
    }) as typeof globalThis.fetch
    await confirmarLaReversion()

    expect(await main().findByText('Se reversó el cierre del turno de la caja C-01.')).toBeInTheDocument()
    expect(main().queryByTestId('acta-del-cierre')).not.toBeInTheDocument()
    expect(main().queryByRole('table', { name: 'Arqueo del cierre' })).not.toBeInTheDocument()

    soltar()
    await waitFor(() => expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(2))
    await waitFor(async () => expect(await situacion()).toBe('Tiene un turno abierto: al terminar el día, cuente el cajón y ciérrelo aquí.'))
    expect(main().queryByTestId('acta-del-cierre')).not.toBeInTheDocument()
  })

  it('after a reversal, the turno open again has no acta', async () => {
    cerrado()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, { estado_del_turno: 'CERRADO', puede_cerrar: false, cierre_vigente: CIERRE_VIGENTE })
    await main().findByTestId('acta-del-cierre')
    await llenarYReversar()
    rutaDe('GET', '/caja/turnos/del-dia').body = delDia('ABIERTO', [EN_C01])
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1)
    await confirmarLaReversion()
    await main().findByText('Se reversó el cierre del turno de la caja C-01.')
    await waitFor(() => expect(main().queryByTestId('acta-del-cierre')).not.toBeInTheDocument())
  })
})

describe('Cierre y arqueo de caja: no mute button, each impediment says why', () => {
  it('«Cerrar el turno» without CREATE on cierre_turno and its lines', async () => {
    start({ permisos: { admin: false, objects: lee } })
    await tablaDeArqueo()
    expect(await botonCerrar()).toBeDisabled()
    expect(await botonCerrar()).toHaveAccessibleDescription(
      'Su cuenta no puede cerrar turnos: le falta creación de cierre_turno y creación de cierre_turno_linea.'
    )
  })

  it('«Cerrar el turno» when today’s turno cannot be read', async () => {
    start()
    Object.assign(rutaDe('GET', '/caja/turnos/del-dia'), { status: 403, body: problema(403, 'Leer turno exige permiso de lectura sobre turno') })
    await waitFor(async () =>
      expect(await botonCerrar()).toHaveAccessibleDescription('Sin su turno de hoy no se cierra: Leer turno exige permiso de lectura sobre turno')
    )
    expect(await botonCerrar()).toBeDisabled()
  })

  it('«Cerrar el turno» with no turno today', async () => {
    start({ delDelDia: delDia('SIN_ABRIR', []) })
    await situacion()
    expect(await botonCerrar()).toBeDisabled()
    expect(await botonCerrar()).toHaveAccessibleDescription('Hoy no tiene ningún turno: no hay nada que cerrar.')
  })

  it('«Cerrar el turno» with no turno chosen', async () => {
    start({ delDelDia: delDia('VARIOS_ABIERTOS', [EN_C01, EN_C02]) })
    await situacion()
    expect(await botonCerrar()).toBeDisabled()
    expect(await botonCerrar()).toHaveAccessibleDescription('Elija primero el turno que va a cerrar.')
  })

  it('«Cerrar el turno» when the arqueo cannot be read', async () => {
    start()
    Object.assign(rutaDe('GET', `/caja/turnos/${T1}/arqueo`), { status: 403, body: problema(403, 'Leer el arqueo exige permiso de lectura sobre pago_evento') })
    await main().findByText(/No se pudo leer el arqueo/)
    expect(await botonCerrar()).toBeDisabled()
    expect(await botonCerrar()).toHaveAccessibleDescription('Sin el arqueo no se cierra: Leer el arqueo exige permiso de lectura sobre pago_evento')
  })

  it('«Cerrar el turno» on a turno already closed', async () => {
    cerrado()
    await tablaDeArqueo()
    expect(await botonCerrar()).toBeDisabled()
    expect(await botonCerrar()).toHaveAccessibleDescription(
      'Este turno ya está cerrado: un cierre no se modifica. Para rehacerlo, se reversa (más abajo) y se cierra otra vez.'
    )
  })

  it('«Cerrar el turno» with payments not delivered', async () => {
    start()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, SIN_ENTREGAR)
    await tablaDeArqueo()
    expect(await botonCerrar()).toBeDisabled()
    expect(await botonCerrar()).toHaveAccessibleDescription(
      'Hay pagos sin entregar a su sistema de origen (vea la lista del arqueo): hasta que se entreguen, o se expliquen los que no se pudieron entregar, el turno no se cierra.'
    )
  })

  it('«Cerrar el turno» when the backend says it cannot close, for no reason listed', async () => {
    start()
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(T1, { puede_cerrar: false })
    await tablaDeArqueo()
    expect(await botonCerrar()).toBeDisabled()
    expect(await botonCerrar()).toHaveAccessibleDescription('El backend dice que este turno no se puede cerrar todavía.')
  })

  it('«Cerrar el turno» on a turno whose caja the backend did not send', async () => {
    start({ delDelDia: delDia('ABIERTO', [{ ...EN_C01, caja: null }]) })
    await situacion()
    expect(await botonCerrar()).toBeDisabled()
    expect(await botonCerrar()).toHaveAccessibleDescription('El backend no mandó la caja de este turno: sin ella no se cierra.')
  })

  it('«Reversar el cierre» on a turno whose caja the backend did not send', async () => {
    start({ permisos: SUPERVISOR, user: SUPERVISORA, delDelDia: delDia('CERRADO', [{ ...EN_C01, caja: null, estado_del_turno: 'CERRADO' }]) })
    await situacion()
    expect(await botonReversar()).toBeDisabled()
    expect(await botonReversar()).toHaveAccessibleDescription('El backend no mandó la caja de este turno: sin ella no se reversa.')
  })

  it('«Reversar el cierre» without CREATE on reversion_cierre (a cashier)', async () => {
    cerrado({ permisos: CAJERO, user: CAJERA })
    await tablaDeArqueo()
    expect(await botonReversar()).toBeDisabled()
    expect(await botonReversar()).toHaveAccessibleDescription(
      'Su cuenta no puede reversar un cierre: le falta creación de reversion_cierre. Un cierre solo se reversa desde la cuenta del cajero del turno: otra cuenta no puede reversarlo por usted, aunque tenga ese permiso.'
    )
  })

  it('«Reversar el cierre» when today’s turno cannot be read', async () => {
    start({ permisos: SUPERVISOR, user: SUPERVISORA })
    Object.assign(rutaDe('GET', '/caja/turnos/del-dia'), { status: 403, body: problema(403, 'Leer turno exige permiso de lectura sobre turno') })
    await waitFor(async () =>
      expect(await botonReversar()).toHaveAccessibleDescription('Sin su turno de hoy no se reversa: Leer turno exige permiso de lectura sobre turno')
    )
  })

  it('«Reversar el cierre» with no turno today', async () => {
    start({ permisos: SUPERVISOR, user: SUPERVISORA, delDelDia: delDia('SIN_ABRIR', []) })
    await situacion()
    expect(await botonReversar()).toBeDisabled()
    expect(await botonReversar()).toHaveAccessibleDescription('Hoy no tiene ningún turno: no hay cierre que reversar.')
  })

  it('«Reversar el cierre» with no turno chosen', async () => {
    start({ permisos: SUPERVISOR, user: SUPERVISORA, delDelDia: delDia('VARIOS_ABIERTOS', [EN_C01, EN_C02]) })
    await situacion()
    expect(await botonReversar()).toHaveAccessibleDescription('Elija primero el turno cuyo cierre va a reversar.')
  })

  it('«Reversar el cierre» on an open turno', async () => {
    start({ permisos: SUPERVISOR, user: SUPERVISORA })
    await tablaDeArqueo()
    expect(await botonReversar()).toBeDisabled()
    expect(await botonReversar()).toHaveAccessibleDescription('Este turno está abierto: no hay ningún cierre que reversar.')
  })
})
