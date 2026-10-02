import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// «Caja tributaria» (caja-tributaria): the pending orders of a payer, the total the backend previews, the cobro and
// the recibo in PDF. the real PANTALLAS: the leaf is registered. caja-backend is mocked with its contract (PR #8, #10
// and #12): every amount a string with its date, and no total the client works out

const CAJAS = {
  content: [
    { codigo: 'C-01', nombre: 'VENTANILLA 1', serie: '001', area_codigo: 'A-10', area_nombre: 'TRAMITE DOCUMENTARIO', activa: true },
    { codigo: 'C-02', nombre: 'VENTANILLA 2', serie: '002', area_codigo: 'A-10', area_nombre: 'TRAMITE DOCUMENTARIO', activa: false },
    { codigo: 'C-03', nombre: 'CAJA RENTAS', serie: '003', area_codigo: null, area_nombre: null, activa: true }
  ],
  page: 0,
  size: 200,
  totalElements: 3,
  totalPages: 1
}

const DOCUMENTO = '12345678'
const O1 = '8f0c2a8e-1f0e-4d0b-9a8e-3c1d2b4a5e01'
const O2 = '8f0c2a8e-1f0e-4d0b-9a8e-3c1d2b4a5e02'
const O3 = '8f0c2a8e-1f0e-4d0b-9a8e-3c1d2b4a5e03'
const O4 = '8f0c2a8e-1f0e-4d0b-9a8e-3c1d2b4a5e04'

const orden = (id: string, sistema: string, referencia: string, concepto: string, detalle: string | null, importe: string, al: string, exigible: string) => ({
  orden_id: id,
  sistema_origen: sistema,
  referencia_externa: referencia,
  concepto,
  detalle,
  importe: { importe, actualizado_a: al },
  fecha_exigibilidad: exigible,
  pagador_documento: DOCUMENTO,
  pagador_nombre: 'FLORES OTINIANO JUNIOR',
  pagador_externo_id: 1234,
  estado: 'PENDIENTE',
  observacion: null
})

// two of rentas whose amounts a Number would add as 0.30000000000000004, one of another system, and one not yet due
function ordenes(primera = '0.10', segunda = '0.20') {
  const content = [
    orden(O1, 'rentas', 'PREDIAL-2026-0001', 'IMPUESTO PREDIAL 2026 - CUOTA 1', 'predio U-0001', primera, '2026-03-15', '2026-02-28'),
    orden(O2, 'rentas', 'PREDIAL-2026-0002', 'IMPUESTO PREDIAL 2026 - CUOTA 2', 'predio U-0001', segunda, '2026-03-16', '2026-05-31'),
    orden(O3, 'mercados', 'MERC-2026-0007', 'ALQUILER DE PUESTO', 'puesto 14', '35.00', '2026-09-01', '2026-09-01'),
    orden(O4, 'rentas', 'PREDIAL-2099-0001', 'IMPUESTO PREDIAL 2099', null, '99.00', '2026-10-01', '2099-02-28')
  ]
  return { content, page: 0, size: 200, totalElements: content.length, totalPages: 1 }
}

const linea = (id: string, concepto: string, referencia: string, importe: string) => ({
  orden_id: id,
  sistema_origen: 'rentas',
  concepto,
  detalle: 'predio U-0001',
  referencia_externa: referencia,
  monto: { importe, actualizado_a: '2026-10-02' }
})

const vistaPrevia = (lineas: ReturnType<typeof linea>[], total: string | null, motivos: string[] = []) => ({
  lineas,
  total: total === null ? null : { importe: total, actualizado_a: '2026-10-02' },
  cobrable: motivos.length === 0,
  motivos
})

const RECIBO = {
  recibo: {
    numero_impreso: '001-0000001',
    serie: '001',
    numero: 1,
    cajero: CAJERA.email,
    // the payer as caja-backend kept it (PR #16): the orders'
    pagador_documento: '12345678',
    pagador_nombre: 'FLORES OTINIANO JUNIOR',
    pagador_externo_id: 7,
    forma_pago: 'EFECTIVO',
    tipo_pago: 'NORMAL',
    emitido_en: '2026-10-02T10:15:30.123456-05:00',
    total: { importe: '0.10', actualizado_a: '2026-10-02' },
    lineas: [linea(O1, 'IMPUESTO PREDIAL 2026 - CUOTA 1', 'PREDIAL-2026-0001', '0.10')]
  },
  pago_id: '3e6da681-2467-48e6-acc7-281903b9b578',
  estado_del_pago: 'EN_TRANSITO',
  emitido: true
}

// what a cashier of tesorería may do: read the orders, cobrar them, read the cajas and their areas
const PUEDE_COBRAR: CallerPermissions = {
  admin: false,
  objects: { orden_de_cobro: ['READ', 'UPDATE'], recibo: ['READ', 'CREATE'], caja: ['READ'], area: ['READ'] }
}

let fetch: FetchMock | null = null
let rutas: MockRoute[] = []
// the headers of each POST /caja/cobros, which mockFetch does not keep
let cabeceras: Headers[] = []
// the PDF the backend gives, or its problem
let pdf: Response | null = null

const rutaDe = (method: string, path: string) => rutas.find((r) => r.method === method && r.path === path)!

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  cabeceras = []
  pdf = null
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:recibo-1'), revokeObjectURL: vi.fn() })
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start({
  path = '/caja-tributaria',
  permisos = PUEDE_COBRAR,
  user = CAJERA,
  listado = ordenes(),
  cajas = { body: CAJAS }
}: { path?: string; permisos?: CallerPermissions; user?: AuthUser; listado?: object; cajas?: Omit<MockRoute, 'path'> } = {}) {
  abrirSesion(user)
  rutas = [
    { ...cajas, method: 'GET', path: '/caja/cajas' },
    { method: 'GET', path: '/caja/ordenes-de-cobro', body: listado },
    {
      method: 'POST',
      path: '/caja/cobros/vista-previa',
      body: vistaPrevia([linea(O1, 'IMPUESTO PREDIAL 2026 - CUOTA 1', 'PREDIAL-2026-0001', '0.10')], '0.10')
    },
    { method: 'POST', path: '/caja/cobros', status: 201, body: RECIBO },
    ...rutasDeSesion(user, permisos)
  ]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  const simulado = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/pdf') && pdf) return pdf
    if (url === '/api/caja/cobros' && init?.method === 'POST') cabeceras.push(new Headers(init.headers))
    return simulado(input, init)
  }) as typeof globalThis.fetch
  render(<PortalApp />)
}

const EN_C01 = `/caja-tributaria?caja=C-01&documento=${DOCUMENTO}`
const main = () => within(screen.getByRole('main'))
const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ')
const casilla = (referencia: string) => screen.getByRole('checkbox', { name: `Cobrar ${referencia}` })
const llamadas = (method: string, path: string) => fetch!.calls.filter((c) => c.method === method && c.path.split('?')[0] === path)
const botonCobrar = () => main().getByRole('button', { name: 'Cobrar' })
// the total the preview gave, where the screen draws it
const totalACobrar = () =>
  waitFor(() => {
    const total = screen.getByRole('main').querySelector('[data-ui="total-a-cobrar"]')
    if (!total) throw new Error('la pantalla no dibuja el total a cobrar')
    return total
  })

async function marcar(referencia: string) {
  await userEvent.click(await screen.findByRole('checkbox', { name: `Cobrar ${referencia}` }))
}

async function llenarYCobrar({ forma = 'Efectivo', observacion = 'cobro en ventanilla' } = {}) {
  await userEvent.selectOptions(main().getByRole('combobox', { name: 'Forma de pago' }), forma)
  const caja = main().getByRole('textbox', { name: 'Observación' })
  await userEvent.clear(caja)
  await userEvent.type(caja, observacion)
  await userEvent.click(botonCobrar())
}

async function confirmar() {
  const dialogo = await screen.findByRole('dialog', { name: 'Confirmar el cobro' })
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Cobrar' }))
}

// the preview of what is marked has come and the button may cobrar
async function listoParaCobrar() {
  await marcar('PREDIAL-2026-0001')
  await waitFor(() => expect(botonCobrar()).toBeEnabled())
}

describe('Caja tributaria: the choice lives in the route', () => {
  it('puts the caja and the document in the url, and a reload shows the same', async () => {
    start()
    await main().findByRole('option', { name: 'C-01 — VENTANILLA 1' })
    await userEvent.selectOptions(main().getByRole('combobox', { name: 'Caja' }), 'C-01 — VENTANILLA 1')
    await userEvent.type(main().getByRole('textbox', { name: 'Documento del pagador' }), DOCUMENTO)
    await userEvent.click(main().getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByRole('checkbox', { name: 'Cobrar PREDIAL-2026-0001' })).toBeInTheDocument()
    const params = new URLSearchParams(window.location.search)
    expect([window.location.pathname, params.get('caja'), params.get('documento')]).toEqual(['/caja-tributaria', 'C-01', DOCUMENTO])
    expect(llamadas('GET', '/caja/ordenes-de-cobro').at(-1)?.path).toBe(`/caja/ordenes-de-cobro?pagador_documento=${DOCUMENTO}&estado=PENDIENTE&size=200`)

    // a reload: the same url, a new app
    const url = window.location.pathname + window.location.search
    cleanup()
    fetch?.restore()
    start({ path: url })
    expect(await screen.findByRole('checkbox', { name: 'Cobrar PREDIAL-2026-0001' })).toBeInTheDocument()
    expect(main().getByRole('combobox', { name: 'Caja' })).toHaveValue('C-01')
    expect(main().getByRole('textbox', { name: 'Documento del pagador' })).toHaveValue(DOCUMENTO)
    expect(main().getByText('FLORES OTINIANO JUNIOR')).toBeInTheDocument()
  })

  it('offers only the active cajas', async () => {
    start()
    const caja = await main().findByRole('combobox', { name: 'Caja' })
    await waitFor(() => expect(within(caja).getAllByRole('option')).toHaveLength(3))
    expect(
      within(caja)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Elija la caja', 'C-01 — VENTANILLA 1', 'C-03 — CAJA RENTAS'])
  })

  it('says a caja of the url is closed or unknown, instead of choosing it', async () => {
    start({ path: '/caja-tributaria?caja=C-02' })
    expect(await main().findByText('La caja C-02 está de baja: elija otra.')).toBeInTheDocument()
    expect(main().getByRole('combobox', { name: 'Caja' })).toHaveValue('')
    cleanup()
    fetch?.restore()
    start({ path: '/caja-tributaria?caja=C-99' })
    expect(await main().findByText('No hay ninguna caja C-99: elija otra.')).toBeInTheDocument()
  })
})

describe('Caja tributaria: the pending orders', () => {
  it('draws each amount with its date', async () => {
    start({ path: EN_C01 })
    await screen.findByRole('checkbox', { name: 'Cobrar PREDIAL-2026-0001' })
    const filas = main().getAllByRole('row').slice(1)
    expect(filas.map((fila) => texto(fila.querySelector('[data-ui="importe"]')))).toEqual([
      'S/ 0.10 al 15/03/2026',
      'S/ 0.20 al 16/03/2026',
      'S/ 35.00 al 01/09/2026',
      'S/ 99.00 al 01/10/2026'
    ])
    expect(texto(filas[0])).toContain('IMPUESTO PREDIAL 2026 - CUOTA 1')
    expect(texto(filas[0])).toContain('predio U-0001')
    expect(texto(filas[0])).toContain('rentas')
    expect(texto(filas[0])).toContain('28/02/2026')
  })

  it('does not let two systems be marked: one of another system says why', async () => {
    start({ path: EN_C01 })
    await marcar('PREDIAL-2026-0001')
    expect(casilla('MERC-2026-0007')).toBeDisabled()
    expect(casilla('MERC-2026-0007')).toHaveAccessibleDescription(
      'Es de «mercados» y lo marcado es de «rentas»: un recibo cobra órdenes de un solo sistema, porque se anula entero.'
    )
    expect(casilla('PREDIAL-2026-0002')).toBeEnabled()
    await userEvent.click(casilla('PREDIAL-2026-0001'))
    expect(casilla('MERC-2026-0007')).toBeEnabled()
  })

  it('does not let another system be marked after one with no system either', async () => {
    const listado = ordenes()
    listado.content[0] = { ...listado.content[0], sistema_origen: null as unknown as string }
    start({ path: EN_C01, listado })
    await marcar('PREDIAL-2026-0001')
    expect(casilla('PREDIAL-2026-0002')).toBeDisabled()
    expect(casilla('PREDIAL-2026-0002')).toHaveAccessibleDescription(
      'Es de «rentas» y lo marcado no tiene sistema de origen: un recibo cobra órdenes de un solo sistema, porque se anula entero.'
    )
    expect(casilla('MERC-2026-0007')).toBeDisabled()
  })

  it('forgets what was marked when the payer changes', async () => {
    start({ path: EN_C01 })
    await marcar('PREDIAL-2026-0001')
    expect(casilla('PREDIAL-2026-0001')).toBeChecked()

    // another payer: the mock answers the same orders, so only a list drawn anew forgets the mark
    const documento = main().getByRole('textbox', { name: 'Documento del pagador' })
    await userEvent.clear(documento)
    await userEvent.type(documento, '87654321')
    await userEvent.click(main().getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('documento')).toBe('87654321'))
    expect(await screen.findByRole('checkbox', { name: 'Cobrar PREDIAL-2026-0001' })).not.toBeChecked()
  })

  it('leaves an order not yet due unmarkable, with why', async () => {
    start({ path: EN_C01 })
    await screen.findByRole('checkbox', { name: 'Cobrar PREDIAL-2099-0001' })
    expect(casilla('PREDIAL-2099-0001')).toBeDisabled()
    expect(casilla('PREDIAL-2099-0001')).toHaveAccessibleDescription('Es exigible desde el 28/02/2099: todavía no se puede cobrar.')
  })

  it('says a document with no pending orders has none', async () => {
    start({ path: EN_C01, listado: { content: [], page: 0, size: 200, totalElements: 0, totalPages: 0 } })
    expect(await main().findByText('Este documento no tiene órdenes pendientes')).toBeInTheDocument()
  })
})

describe('Caja tributaria: the total is the backend’s', () => {
  it.each([
    { caso: '0.10 + 0.20', primera: '0.10', segunda: '0.20', total: '0.30', visto: 'S/ 0.30 al 02/10/2026', suma: '0.30000000000000004' },
    {
      caso: 'beyond a double',
      primera: '12345678901234567.10',
      segunda: '0.20',
      total: '12345678901234567.30',
      visto: 'S/ 12,345,678,901,234,567.30 al 02/10/2026',
      suma: '12,345,678,901,234,568'
    }
  ])('shows exactly the preview’s total ($caso)', async ({ primera, segunda, total, visto, suma }) => {
    start({ path: EN_C01, listado: ordenes(primera, segunda) })
    await screen.findByRole('checkbox', { name: 'Cobrar PREDIAL-2026-0001' })
    rutaDe('POST', '/caja/cobros/vista-previa').body = vistaPrevia(
      [linea(O1, 'IMPUESTO PREDIAL 2026 - CUOTA 1', 'PREDIAL-2026-0001', primera), linea(O2, 'IMPUESTO PREDIAL 2026 - CUOTA 2', 'PREDIAL-2026-0002', segunda)],
      total
    )
    await marcar('PREDIAL-2026-0001')
    await marcar('PREDIAL-2026-0002')

    const totalVisto = await totalACobrar()
    await waitFor(() => expect(texto(totalVisto)).toBe(visto))
    expect(llamadas('POST', '/caja/cobros/vista-previa').at(-1)?.body).toEqual({ ordenes: [O1, O2] })
    expect(texto(screen.getByRole('main'))).not.toContain(suma)
  })

  it('says the reasons of the preview as they come, and the button says it cannot', async () => {
    start({ path: EN_C01 })
    const motivo = `La orden ${O1} (rentas/PREDIAL-2026-0001) no se puede cobrar: ya se cobró con el recibo 001-0000009`
    rutaDe('POST', '/caja/cobros/vista-previa').body = vistaPrevia([linea(O1, 'IMPUESTO PREDIAL 2026 - CUOTA 1', 'PREDIAL-2026-0001', '0.10')], '0.10', [
      motivo
    ])
    await marcar('PREDIAL-2026-0001')
    expect(await main().findByText(motivo)).toBeInTheDocument()
    expect(botonCobrar()).toBeDisabled()
    expect(botonCobrar()).toHaveAccessibleDescription('El backend dice que no se puede cobrar: vea los motivos de arriba.')
  })

  it('says why the total is missing when the preview has none', async () => {
    start({ path: EN_C01 })
    rutaDe('POST', '/caja/cobros/vista-previa').body = vistaPrevia([], null, [`No hay ninguna orden de cobro ${O1}`])
    await marcar('PREDIAL-2026-0001')
    const total = await totalACobrar()
    await waitFor(() => expect(texto(total)).toBe('— Ninguna de las órdenes marcadas se pudo leer: vea los motivos.'))
  })
})

describe('Caja tributaria: cobrar', () => {
  it('confirms with the orders and the total of the preview, and sends the cobro with an Idempotency-Key', async () => {
    start({ path: EN_C01 })
    await listoParaCobrar()
    await llenarYCobrar()

    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar el cobro' })
    expect(texto(dialogo)).toContain('IMPUESTO PREDIAL 2026 - CUOTA 1')
    expect(texto(dialogo)).toContain('PREDIAL-2026-0001')
    expect(texto(dialogo)).toContain('Total: S/ 0.10 al 02/10/2026')
    expect(texto(dialogo)).toContain('Forma de pago: Efectivo')
    expect(texto(dialogo)).toContain('no se deshace')
    expect(llamadas('POST', '/caja/cobros')).toHaveLength(0)

    await confirmar()
    expect(await main().findByRole('heading', { name: 'Recibo 001-0000001' })).toBeInTheDocument()
    expect(llamadas('POST', '/caja/cobros')[0].body).toEqual({ caja: 'C-01', forma_pago: 'EFECTIVO', ordenes: [O1], observacion: 'cobro en ventanilla' })
    expect(cabeceras[0].get('Idempotency-Key')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('cancelling the confirmation sends nothing', async () => {
    start({ path: EN_C01 })
    await listoParaCobrar()
    await llenarYCobrar()
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Confirmar el cobro' })).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(llamadas('POST', '/caja/cobros')).toHaveLength(0)
  })

  it('retries the same attempt with the same key, and a changed one with a new key', async () => {
    start({ path: EN_C01 })
    const cobro = rutaDe('POST', '/caja/cobros')
    cobro.status = 409
    cobro.body = { title: 'Conflict', status: 409, detail: 'Otro cobro tocó estas órdenes a la vez: vuelva a intentarlo' }
    await listoParaCobrar()
    await llenarYCobrar()
    await confirmar()
    expect(await main().findByText('Otro cobro tocó estas órdenes a la vez: vuelva a intentarlo')).toBeInTheDocument()

    await userEvent.click(botonCobrar())
    await confirmar()
    await waitFor(() => expect(cabeceras).toHaveLength(2))
    expect(cabeceras[1].get('Idempotency-Key')).toBe(cabeceras[0].get('Idempotency-Key'))

    await llenarYCobrar({ observacion: 'cobro en ventanilla, segundo intento' })
    await confirmar()
    await waitFor(() => expect(cabeceras).toHaveLength(3))
    expect(cabeceras[2].get('Idempotency-Key')).not.toBe(cabeceras[0].get('Idempotency-Key'))
  })

  it('checks the form before asking: a forma de pago and an observación of 5 to 500 characters', async () => {
    start({ path: EN_C01 })
    await listoParaCobrar()
    await userEvent.type(main().getByRole('textbox', { name: 'Observación' }), '  ab  ')
    await userEvent.click(botonCobrar())
    expect(main().getByRole('combobox', { name: 'Forma de pago' })).toHaveAccessibleDescription('Elija la forma de pago.')
    expect(main().getByRole('textbox', { name: 'Observación' })).toHaveAccessibleDescription('Explique el cobro: de 5 a 500 caracteres.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says a 400 under its field, and one of no field of the form above the button', async () => {
    start({ path: EN_C01 })
    const cobro = rutaDe('POST', '/caja/cobros')
    cobro.status = 400
    cobro.body = {
      title: 'Bad Request',
      status: 400,
      detail: 'Falta la observación',
      errors: [
        { field: 'observacion', message: 'explique por qué: al menos 5 caracteres que no sean espacios' },
        { field: 'caja', message: 'No hay ninguna caja C-01' }
      ]
    }
    await listoParaCobrar()
    await llenarYCobrar()
    await confirmar()
    expect(await main().findByText('explique por qué: al menos 5 caracteres que no sean espacios')).toBeInTheDocument()
    expect(main().getByRole('textbox', { name: 'Observación' })).toHaveAccessibleDescription('explique por qué: al menos 5 caracteres que no sean espacios')
    expect(main().getByRole('alert')).toHaveTextContent('Caja: No hay ninguna caja C-01')
  })

  it.each([
    [403, 'Cobrar exige permiso de creación sobre recibo'],
    [404, `No hay ninguna orden de cobro ${O1}`],
    [409, 'La caja C-01 está de baja']
  ])('says a %i with its detail', async (status, detail) => {
    start({ path: EN_C01 })
    Object.assign(rutaDe('POST', '/caja/cobros'), { status, body: { title: 'Error', status, detail } })
    await listoParaCobrar()
    await llenarYCobrar()
    await confirmar()
    expect(await main().findByRole('alert')).toHaveTextContent(detail)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the draft of a 401, by caja and document, and fills the form in back with the same account', async () => {
    start({ path: EN_C01 })
    Object.assign(rutaDe('POST', '/caja/cobros'), { status: 401, body: { title: 'Unauthorized', status: 401 } })
    await listoParaCobrar()
    await llenarYCobrar({ forma: 'Cheque', observacion: 'cheque del banco' })
    await confirmar()

    await screen.findByLabelText('Contraseña')
    expect(JSON.parse(sessionStorage.getItem(`caja.borrador.caja-tributaria.C-01.${DOCUMENTO}`) ?? 'null')).toEqual({
      cuenta: CAJERA.id,
      campos: { forma_pago: 'CHEQUE', observacion: 'cheque del banco' }
    })

    rutas.unshift({ method: 'POST', path: '/auth/login', body: { token: 'nuevo', expiresAt: '2026-12-31T00:00:00Z', user: CAJERA } })
    await userEvent.type(screen.getByLabelText('Correo'), CAJERA.email)
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await main().findByRole('combobox', { name: 'Forma de pago' })).toHaveValue('CHEQUE')
    expect(main().getByRole('textbox', { name: 'Observación' })).toHaveValue('cheque del banco')
    expect(main().getByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe(EN_C01)
  })

  it('leaves the button impeded, with why, without CREATE on recibo', async () => {
    start({ path: EN_C01, permisos: { admin: false, objects: { orden_de_cobro: ['READ', 'UPDATE'], caja: ['READ'], area: ['READ'] } } })
    await marcar('PREDIAL-2026-0001')
    await totalACobrar()
    expect(botonCobrar()).toBeDisabled()
    expect(botonCobrar()).toHaveAccessibleDescription('Su cuenta no puede cobrar: le falta creación de recibo.')
  })

  it('leaves it impeded, with why, while no caja is chosen or nothing is marked', async () => {
    start({ path: `/caja-tributaria?documento=${DOCUMENTO}` })
    await screen.findByRole('checkbox', { name: 'Cobrar PREDIAL-2026-0001' })
    expect(botonCobrar()).toHaveAccessibleDescription('Elija la caja en la que cobra.')
    await userEvent.selectOptions(main().getByRole('combobox', { name: 'Caja' }), 'C-01 — VENTANILLA 1')
    expect(botonCobrar()).toBeDisabled()
    expect(botonCobrar()).toHaveAccessibleDescription('Marque las órdenes que va a cobrar.')
  })

  it('says why when the cajas cannot be read, instead of asking to choose one', async () => {
    start({ path: EN_C01, cajas: { status: 403, body: { title: 'Forbidden', status: 403, detail: 'Leer las cajas exige lectura de caja' } } })
    await marcar('PREDIAL-2026-0001')
    await totalACobrar()
    await waitFor(() =>
      expect(botonCobrar()).toHaveAccessibleDescription('Sin caja no se cobra, y las cajas no se pudieron leer: Leer las cajas exige lectura de caja')
    )
    expect(botonCobrar()).toBeDisabled()
  })

  it('without READ on orden_de_cobro, the leaf says what is missing and asks caja-backend nothing', async () => {
    start({ path: EN_C01, permisos: { admin: false, objects: { recibo: ['CREATE'], caja: ['READ'] } } })
    expect(await main().findByText('Su cuenta no puede abrir «Caja tributaria»: le falta lectura de orden_de_cobro.')).toBeInTheDocument()
    expect(fetch!.calls.filter((c) => c.path.startsWith('/caja/'))).toEqual([])
  })
})

describe('Caja tributaria: the recibo issued', () => {
  async function cobrado() {
    start({ path: EN_C01 })
    await listoParaCobrar()
    await llenarYCobrar()
    await confirmar()
    return main().findByRole('heading', { name: 'Recibo 001-0000001' })
  }

  const valor = (rotulo: string) => texto(main().getByText(rotulo, { selector: 'dt' }).nextElementSibling)

  it('shows its number, when in Lima, the forma de pago, the total with its date and the lines', async () => {
    await cobrado()
    expect(valor('Número')).toBe('001-0000001')
    expect(valor('Emitido en')).toBe('02/10/2026 10:15 (hora de Lima)')
    expect(valor('Forma de pago')).toBe('Efectivo')
    expect(valor('Total')).toBe('S/ 0.10 al 02/10/2026')
    expect(valor('Pagador')).toBe('FLORES OTINIANO JUNIOR (12345678)')
    expect(valor('Concepto')).toBe('IMPUESTO PREDIAL 2026 - CUOTA 1')
    expect(valor('Monto')).toBe('S/ 0.10 al 02/10/2026')
    // the orders are asked again: the one paid is no longer pending
    await waitFor(() => expect(llamadas('GET', '/caja/ordenes-de-cobro').length).toBeGreaterThan(1))
  })

  it('says a resent attempt did not charge again', async () => {
    start({ path: EN_C01 })
    Object.assign(rutaDe('POST', '/caja/cobros'), { status: 200, body: { ...RECIBO, emitido: false } })
    await listoParaCobrar()
    await llenarYCobrar()
    await confirmar()
    expect(await main().findByText('Este cobro ya se había registrado con este mismo intento: no se cobró otra vez.')).toBeInTheDocument()
  })

  it('opens its PDF with PdfDialog', async () => {
    await cobrado()
    pdf = new Response('%PDF-1.7', {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="recibo-001-0000001.pdf"' }
    })
    const pedidos = vi.spyOn(globalThis, 'fetch')
    await userEvent.click(main().getByRole('button', { name: 'Ver el recibo' }))
    const iframe = await screen.findByTitle('Recibo 001-0000001')
    expect(iframe).toHaveAttribute('src', 'blob:recibo-1')
    expect(pedidos.mock.calls.map(([url]) => String(url))).toContain('/api/caja/recibos/001-0000001/pdf')
    expect(await screen.findByRole('link', { name: 'Descargar' })).toHaveAttribute('download', 'recibo-001-0000001.pdf')
  })

  it('says on a 409 that the original can no longer be asked for, and that a duplicate is', async () => {
    await cobrado()
    pdf = new Response(JSON.stringify({ title: 'Conflict', status: 409, detail: 'El original solo lo pide el cajero que lo emitió, el mismo día' }), {
      status: 409,
      headers: { 'Content-Type': 'application/problem+json' }
    })
    await userEvent.click(main().getByRole('button', { name: 'Ver el recibo' }))
    const alerta = await within(await screen.findByRole('dialog', { name: 'Recibo 001-0000001' })).findByRole('alert')
    expect(alerta).toHaveTextContent('El original de este recibo ya no se puede pedir: pida un duplicado en «Duplicado de recibo».')
    expect(alerta).toHaveTextContent('El original solo lo pide el cajero que lo emitió, el mismo día')
  })

  it('starts another cobro, keeping the caja and the document', async () => {
    await cobrado()
    await userEvent.click(main().getByRole('button', { name: 'Nuevo cobro' }))
    expect(await screen.findByRole('checkbox', { name: 'Cobrar PREDIAL-2026-0001' })).not.toBeChecked()
    expect(window.location.pathname + window.location.search).toBe(EN_C01)
  })
})
