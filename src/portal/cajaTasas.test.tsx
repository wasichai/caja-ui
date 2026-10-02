import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { guardarBorrador } from './escritura/borrador'
import { hoyEnLima } from './fechas'
import { PortalApp } from './PortalApp'

// «Caja de tasas y derechos administrativos» (caja-tasas): the tasas in force, their quantities, the total the backend
// previews, the cobro and the recibo in PDF. the real PANTALLAS: the leaf is registered. caja-backend is mocked with
// its contract (PR #12): every amount a string with its date, the price from GET /tasas and every line amount and
// total from the preview, none the client works out

const AL = '2026-10-02'
const cifra = (importe: string) => ({ importe, actualizado_a: AL })

const CAJAS = {
  content: [
    { codigo: 'C-01', nombre: 'VENTANILLA 1', serie: '001', area_codigo: 'A-10', area_nombre: 'TRAMITE DOCUMENTARIO', activa: true },
    { codigo: 'C-02', nombre: 'VENTANILLA 2', serie: '002', area_codigo: 'A-10', area_nombre: 'TRAMITE DOCUMENTARIO', activa: false }
  ],
  page: 0,
  size: 200,
  totalElements: 2,
  totalPages: 1
}

// T-001 costs 0.10: three of them are 0.30, which a Number would make 0.30000000000000004. T-003 has its tarifa in zero
const TASAS = [
  { codigo: 'T-001', descripcion: 'CONSTANCIA DE NO ADEUDO', area: 'A-10', partida_presupuestal: '1.3.1.1.1.1', precio: cifra('0.10') },
  { codigo: 'T-002', descripcion: 'COPIA CERTIFICADA', area: 'A-10', partida_presupuestal: '1.3.1.1.1.2', precio: cifra('12.00') },
  { codigo: 'T-003', descripcion: 'CERTIFICADO DE NUMERACIÓN', area: null, partida_presupuestal: null, precio: cifra('0.00') }
]

const linea = (codigo: string, concepto: string, cantidad: number, precio: string, monto: string) => ({
  orden_id: null,
  sistema_origen: null,
  concepto,
  detalle: null,
  referencia_externa: null,
  monto: cifra(monto),
  codigo,
  cantidad,
  precio_unitario: cifra(precio)
})

type Linea = ReturnType<typeof linea>

const vistaPrevia = (lineas: Linea[], total: string | null, motivos: string[] = []) => ({
  lineas,
  total: total === null ? null : cifra(total),
  cobrable: motivos.length === 0,
  motivos
})

const UNA_T001 = linea('T-001', 'CONSTANCIA DE NO ADEUDO', 1, '0.10', '0.10')
const TRES_T001 = linea('T-001', 'CONSTANCIA DE NO ADEUDO', 3, '0.10', '0.30')

const RECIBO = {
  recibo: {
    numero_impreso: '001-0000002',
    serie: '001',
    numero: 2,
    cajero: CAJERA.email,
    forma_pago: 'EFECTIVO',
    tipo_pago: 'TASA',
    emitido_en: '2026-10-02T10:20:00.123456-05:00',
    total: cifra('0.30'),
    lineas: [TRES_T001]
  },
  pago_id: null,
  estado_del_pago: 'SIN_EVENTO',
  emitido: true
}

// what a cashier of the tasas may do: read the tasas, cobrar them (issue the recibo), read the cajas
const PUEDE_COBRAR: CallerPermissions = { admin: false, objects: { tasa: ['READ'], recibo: ['READ', 'CREATE'], caja: ['READ'] } }

let fetch: FetchMock | null = null
let rutas: MockRoute[] = []
// the headers of each POST /caja/cobros/tasas, which mockFetch does not keep
let cabeceras: Headers[] = []
let pdf: Response | null = null

const rutaDe = (method: string, path: string) => rutas.find((r) => r.method === method && r.path === path)!

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  cabeceras = []
  pdf = null
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:recibo-2'), revokeObjectURL: vi.fn() })
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start({ path = EN_C01, permisos = PUEDE_COBRAR, user = CAJERA }: { path?: string; permisos?: CallerPermissions; user?: AuthUser } = {}) {
  abrirSesion(user)
  rutas = [
    { method: 'GET', path: '/caja/cajas', body: CAJAS },
    { method: 'GET', path: '/caja/tasas', body: TASAS },
    { method: 'POST', path: '/caja/cobros/tasas/vista-previa', body: vistaPrevia([UNA_T001], '0.10') },
    { method: 'POST', path: '/caja/cobros/tasas', status: 201, body: RECIBO },
    ...rutasDeSesion(user, permisos)
  ]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  const simulado = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/pdf') && pdf) return pdf
    if (url === '/api/caja/cobros/tasas' && init?.method === 'POST') cabeceras.push(new Headers(init.headers))
    return simulado(input, init)
  }) as typeof globalThis.fetch
  render(<PortalApp />)
}

const EN_C01 = '/caja-tasas?caja=C-01'
const main = () => within(screen.getByRole('main'))
const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ')
const llamadas = (method: string, path: string) => fetch!.calls.filter((c) => c.method === method && c.path.split('?')[0] === path)
const previas = () => llamadas('POST', '/caja/cobros/tasas/vista-previa')
const botonCobrar = () => main().getByRole('button', { name: 'Cobrar' })
const cantidad = (codigo: string) => main().getByRole('textbox', { name: `Cantidad de ${codigo}` })
const tablaDeLineas = () => main().getByRole('table', { name: 'Tasas a cobrar' })
const filaDeLinea = (codigo: string) => within(tablaDeLineas()).getByRole('row', { name: new RegExp(codigo) })
const totalACobrar = () =>
  waitFor(() => {
    const total = screen.getByRole('main').querySelector('[data-ui="total-a-cobrar"]')
    if (!total) throw new Error('la pantalla no dibuja el total a cobrar')
    return total
  })

async function agregar(codigo: string) {
  await userEvent.click(await main().findByRole('button', { name: `Agregar ${codigo}` }))
}

async function cambiarCantidad(codigo: string, valor: string) {
  await userEvent.clear(cantidad(codigo))
  if (valor) await userEvent.type(cantidad(codigo), valor)
}

// three T-001: the preview of them has come and the button may cobrar
async function tresT001() {
  rutaDe('POST', '/caja/cobros/tasas/vista-previa').body = vistaPrevia([TRES_T001], '0.30')
  await agregar('T-001')
  await cambiarCantidad('T-001', '3')
  await waitFor(() => expect(botonCobrar()).toBeEnabled())
}

async function llenarYCobrar({ forma = 'Efectivo', observacion = 'cobro de tasas en ventanilla', documento = '', nombre = '' } = {}) {
  await userEvent.selectOptions(main().getByRole('combobox', { name: 'Forma de pago' }), forma)
  for (const [rotulo, valor] of [
    ['Documento del pagador (opcional)', documento],
    ['Nombre del pagador (opcional)', nombre],
    ['Observación', observacion]
  ]) {
    const campo = main().getByRole('textbox', { name: rotulo })
    await userEvent.clear(campo)
    if (valor) await userEvent.type(campo, valor)
  }
  await userEvent.click(botonCobrar())
}

async function confirmar() {
  const dialogo = await screen.findByRole('dialog', { name: 'Confirmar el cobro' })
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Cobrar' }))
}

describe('Caja de tasas: the leaf', () => {
  it('is offered with READ on tasa, and its screen reads the tasas in force today', async () => {
    start()
    expect(await main().findByRole('heading', { name: 'Caja de tasas y derechos administrativos', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Caja de tasas y derechos administrativos' }).length).toBeGreaterThan(0)
    await main().findByRole('button', { name: 'Agregar T-001' })
    expect(llamadas('GET', '/caja/tasas').map((c) => c.path)).toEqual([`/caja/tasas?vigentes_a=${hoyEnLima()}`])
  })

  it('without READ on tasa, says what is missing and asks caja-backend nothing', async () => {
    start({ permisos: { admin: false, objects: { recibo: ['CREATE'], caja: ['READ'] } } })
    expect(await main().findByText('Su cuenta no puede abrir «Caja de tasas y derechos administrativos»: le falta lectura de tasa.')).toBeInTheDocument()
    expect(fetch!.calls.filter((c) => c.path.startsWith('/caja/'))).toEqual([])
  })

  it('keeps the caja in the url', async () => {
    start({ path: '/caja-tasas' })
    await main().findByRole('option', { name: 'C-01 — VENTANILLA 1' })
    await userEvent.selectOptions(main().getByRole('combobox', { name: 'Caja' }), 'C-01 — VENTANILLA 1')
    expect(window.location.pathname + window.location.search).toBe(EN_C01)
  })
})

describe('Caja de tasas: choosing the tasas', () => {
  it('lists each tasa in force with its code, description, area, partida and price with its date', async () => {
    start()
    const fila = (await main().findByRole('button', { name: 'Agregar T-001' })).closest('tr')!
    expect(texto(fila)).toContain('T-001')
    expect(texto(fila)).toContain('CONSTANCIA DE NO ADEUDO')
    expect(texto(fila)).toContain('A-10')
    expect(texto(fila)).toContain('1.3.1.1.1.1')
    expect(texto(fila.querySelector('[data-ui="importe"]'))).toBe('S/ 0.10 al 02/10/2026')
  })

  it('filters the list by code or description, locally', async () => {
    start()
    await main().findByRole('button', { name: 'Agregar T-001' })
    const buscador = main().getByRole('searchbox', { name: 'Buscar tasa' })
    await userEvent.type(buscador, 'copia')
    expect(main().queryByRole('button', { name: 'Agregar T-001' })).not.toBeInTheDocument()
    expect(main().getByRole('button', { name: 'Agregar T-002' })).toBeInTheDocument()
    await userEvent.clear(buscador)
    await userEvent.type(buscador, 't-003')
    expect(main().getByRole('button', { name: 'Agregar T-003' })).toBeInTheDocument()
    expect(main().queryByRole('button', { name: 'Agregar T-002' })).not.toBeInTheDocument()
    await userEvent.clear(buscador)
    await userEvent.type(buscador, 'licencia')
    expect(main().getByText('Ninguna tasa vigente tiene «licencia» en su código o su descripción.')).toBeInTheDocument()
    // a filter, not a query: the tasas were read once
    expect(llamadas('GET', '/caja/tasas')).toHaveLength(1)
  })

  it('adds a tasa with quantity 1, once: adding it again says to change its quantity', async () => {
    start()
    await agregar('T-001')
    expect(cantidad('T-001')).toHaveValue('1')
    expect(texto(filaDeLinea('T-001'))).toContain('CONSTANCIA DE NO ADEUDO')
    expect(texto(filaDeLinea('T-001').querySelector('[data-ui="importe"]'))).toBe('S/ 0.10 al 02/10/2026')
    const otra = main().getByRole('button', { name: 'Agregar T-001' })
    expect(otra).toBeDisabled()
    expect(otra).toHaveAccessibleDescription('Ya está entre las tasas a cobrar: cambie su cantidad.')
    await waitFor(() => expect(previas().at(-1)?.body).toEqual({ conceptos: [{ codigo: 'T-001', cantidad: 1 }] }))
  })

  it('removes a line', async () => {
    start()
    await agregar('T-001')
    await agregar('T-002')
    await userEvent.click(main().getByRole('button', { name: 'Quitar T-001' }))
    expect(within(tablaDeLineas()).queryByRole('row', { name: /T-001/ })).not.toBeInTheDocument()
    expect(main().getByRole('button', { name: 'Agregar T-001' })).toBeEnabled()
    await waitFor(() => expect(previas().at(-1)?.body).toEqual({ conceptos: [{ codigo: 'T-002', cantidad: 1 }] }))
  })
})

describe('Caja de tasas: every amount is the backend’s', () => {
  it('shows exactly the preview’s line amounts and total: 0.10 × 3 is the backend’s 0.30', async () => {
    start()
    await agregar('T-001')
    await agregar('T-002')
    rutaDe('POST', '/caja/cobros/tasas/vista-previa').body = vistaPrevia([TRES_T001, linea('T-002', 'COPIA CERTIFICADA', 1, '12.00', '12.00')], '12.30')
    await cambiarCantidad('T-001', '3')

    const total = await totalACobrar()
    await waitFor(() => expect(texto(total)).toBe('S/ 12.30 al 02/10/2026'))
    const montos = () => [...tablaDeLineas().querySelectorAll('[data-ui="monto-de-linea"]')].map(texto)
    expect(montos()).toEqual(['S/ 0.30 al 02/10/2026', 'S/ 12.00 al 02/10/2026'])
    expect(previas().at(-1)?.body).toEqual({
      conceptos: [
        { codigo: 'T-001', cantidad: 3 },
        { codigo: 'T-002', cantidad: 1 }
      ]
    })
    expect(texto(screen.getByRole('main'))).not.toContain('0.30000000000000004')
    expect(texto(screen.getByRole('main'))).not.toContain('12.300000000000001')
  })

  it('shows a total beyond a double as the backend wrote it', async () => {
    start()
    await agregar('T-001')
    rutaDe('POST', '/caja/cobros/tasas/vista-previa').body = vistaPrevia(
      [linea('T-001', 'CONSTANCIA DE NO ADEUDO', 3, '0.10', '12345678901234567.30')],
      '12345678901234567.30'
    )
    await cambiarCantidad('T-001', '3')
    // 0.10 × 3 worked out by anyone but the backend would be 0.30: what is drawn is what the preview says
    const total = await totalACobrar()
    await waitFor(() => expect(texto(total)).toBe('S/ 12,345,678,901,234,567.30 al 02/10/2026'))
    expect(texto(tablaDeLineas().querySelector('[data-ui="monto-de-linea"]'))).toBe('S/ 12,345,678,901,234,567.30 al 02/10/2026')
  })

  it('asks the preview again when a quantity changes', async () => {
    start()
    await agregar('T-001')
    await waitFor(() => expect(previas()).toHaveLength(1))
    rutaDe('POST', '/caja/cobros/tasas/vista-previa').body = vistaPrevia([TRES_T001], '0.30')
    await cambiarCantidad('T-001', '3')
    await waitFor(() => expect(previas().at(-1)?.body).toEqual({ conceptos: [{ codigo: 'T-001', cantidad: 3 }] }))
    await waitFor(async () => expect(texto(await totalACobrar())).toBe('S/ 0.30 al 02/10/2026'))
  })

  it.each([
    ['0', '0'],
    ['a text', 'tres'],
    ['a decimal', '1.5'],
    ['nothing', '']
  ])('refuses a quantity of %s in its field, and it never reaches the backend', async (_caso, valor) => {
    start()
    await agregar('T-001')
    await waitFor(() => expect(previas()).toHaveLength(1))
    await cambiarCantidad('T-001', valor)

    expect(cantidad('T-001')).toBeInvalid()
    expect(cantidad('T-001')).toHaveAccessibleDescription('Escriba un entero de al menos 1 (hasta nueve cifras).')
    expect(botonCobrar()).toBeDisabled()
    expect(botonCobrar()).toHaveAccessibleDescription('Corrija las cantidades: cada una es un entero de al menos 1.')
    expect(texto(filaDeLinea('T-001'))).toContain('Corrija la cantidad para ver el monto.')
    // while typing «1.5» the field holds «1» a moment, a quantity: only that one is ever asked
    for (const { body } of previas()) expect(body).toEqual({ conceptos: [{ codigo: 'T-001', cantidad: 1 }] })
  })

  it('says the total is missing while a quantity is invalid, instead of dropping it in silence', async () => {
    start()
    await agregar('T-001')
    await waitFor(async () => expect(texto(await totalACobrar())).toBe('S/ 0.10 al 02/10/2026'))
    await cambiarCantidad('T-001', '0')
    expect(texto(await totalACobrar())).toBe('— Corrija las cantidades para ver el total.')
    expect(texto(screen.getByRole('main'))).toContain('Total a cobrar: — Corrija las cantidades para ver el total.')
  })

  it('a tarifa in zero keeps the cobro from going, with its reason', async () => {
    start()
    const motivo =
      "La tarifa vigente del concepto 'T-003' es 0.00: tarifa en cero, un dato mal cargado. Un recibo por cero no documenta un cobro; corrija la tarifa (T-003/2026)"
    rutaDe('POST', '/caja/cobros/tasas/vista-previa').body = vistaPrevia([], null, [motivo])
    await agregar('T-003')
    expect(await main().findByText(motivo)).toBeInTheDocument()
    expect(botonCobrar()).toBeDisabled()
    expect(botonCobrar()).toHaveAccessibleDescription('El backend dice que no se puede cobrar: vea los motivos de arriba.')
    expect(texto(filaDeLinea('T-003'))).toContain('El backend no la cobra: vea los motivos.')
    expect(texto(await totalACobrar())).toBe('— Ninguna de las tasas se puede cobrar: vea los motivos.')
  })
})

describe('Caja de tasas: cobrar', () => {
  it('confirms with the lines and the total of the preview, and sends the cobro with an Idempotency-Key', async () => {
    start()
    await tresT001()
    await llenarYCobrar({ documento: '12345678', nombre: 'SANTOS RIVERA, ELENA' })

    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar el cobro' })
    expect(texto(dialogo)).toContain('Se cobran estas tasas en la caja C-01')
    expect(texto(dialogo)).toContain('T-001 · CONSTANCIA DE NO ADEUDO · cantidad 3 · S/ 0.30 al 02/10/2026')
    expect(texto(dialogo)).toContain('Total: S/ 0.30 al 02/10/2026')
    expect(texto(dialogo)).toContain('Forma de pago: Efectivo')
    expect(texto(dialogo)).toContain('Pagador: SANTOS RIVERA, ELENA (12345678)')
    expect(llamadas('POST', '/caja/cobros/tasas')).toHaveLength(0)

    await confirmar()
    expect(await main().findByRole('heading', { name: 'Recibo 001-0000002' })).toBeInTheDocument()
    expect(llamadas('POST', '/caja/cobros/tasas')[0].body).toEqual({
      caja: 'C-01',
      forma_pago: 'EFECTIVO',
      conceptos: [{ codigo: 'T-001', cantidad: 3 }],
      observacion: 'cobro de tasas en ventanilla',
      pagador_documento: '12345678',
      pagador_nombre: 'SANTOS RIVERA, ELENA'
    })
    expect(cabeceras[0].get('Idempotency-Key')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('sends no payer when none was typed, and the confirmation says it was not identified', async () => {
    start()
    await tresT001()
    await llenarYCobrar()
    expect(texto(await screen.findByRole('dialog', { name: 'Confirmar el cobro' }))).toContain('Pagador: no se identificó')
    await confirmar()
    await main().findByRole('heading', { name: 'Recibo 001-0000002' })
    expect(llamadas('POST', '/caja/cobros/tasas')[0].body).toEqual({
      caja: 'C-01',
      forma_pago: 'EFECTIVO',
      conceptos: [{ codigo: 'T-001', cantidad: 3 }],
      observacion: 'cobro de tasas en ventanilla'
    })
  })

  it('retries the same attempt with the same key', async () => {
    start()
    Object.assign(rutaDe('POST', '/caja/cobros/tasas'), {
      status: 409,
      body: { title: 'Conflict', status: 409, detail: 'Otro cobro tomó el número a la vez: vuelva a intentarlo' }
    })
    await tresT001()
    await llenarYCobrar()
    await confirmar()
    expect(await main().findByText('Otro cobro tomó el número a la vez: vuelva a intentarlo')).toBeInTheDocument()

    await userEvent.click(botonCobrar())
    await confirmar()
    await waitFor(() => expect(cabeceras).toHaveLength(2))
    expect(cabeceras[1].get('Idempotency-Key')).toBe(cabeceras[0].get('Idempotency-Key'))
  })

  it.each([
    [404, "El concepto 'T-001' (conceptos) no tiene tarifa vigente al 2026-10-02: la tarifa es un dato registrado con su norma y su vigencia"],
    [409, "La tarifa vigente del concepto 'T-001' es 0.00: tarifa en cero, un dato mal cargado"],
    [403, 'Cobrar tasas exige permiso de creación sobre recibo: el cobro emite el recibo']
  ])('says a %i with its detail', async (status, detail) => {
    start()
    Object.assign(rutaDe('POST', '/caja/cobros/tasas'), { status, body: { title: 'Error', status, detail } })
    await tresT001()
    await llenarYCobrar()
    await confirmar()
    expect(await main().findByRole('alert')).toHaveTextContent(detail)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says a 400 under its field, and one of no field of the form above the button', async () => {
    start()
    Object.assign(rutaDe('POST', '/caja/cobros/tasas'), {
      status: 400,
      body: {
        title: 'Bad Request',
        status: 400,
        detail: 'El cobro de tasas no es válido',
        errors: [
          { field: 'pagador_documento', message: 'a lo sumo 20 caracteres' },
          { field: 'conceptos[0].cantidad', message: 'un entero de al menos 1' }
        ]
      }
    })
    await tresT001()
    await llenarYCobrar({ documento: '12345678' })
    await confirmar()
    expect(await main().findByText('a lo sumo 20 caracteres')).toBeInTheDocument()
    expect(main().getByRole('textbox', { name: 'Documento del pagador (opcional)' })).toHaveAccessibleDescription('a lo sumo 20 caracteres')
    expect(main().getByRole('alert')).toHaveTextContent('Cantidad de T-001: un entero de al menos 1')
  })

  it('keeps the draft of a 401 by caja, the lines as code and quantity, and fills it all in back', async () => {
    start()
    Object.assign(rutaDe('POST', '/caja/cobros/tasas'), { status: 401, body: { title: 'Unauthorized', status: 401 } })
    await agregar('T-002')
    await tresT001()
    await llenarYCobrar({ forma: 'Cheque', observacion: 'cheque del banco', documento: '12345678', nombre: 'SANTOS RIVERA, ELENA' })
    await confirmar()

    await screen.findByLabelText('Contraseña')
    const guardado = JSON.parse(sessionStorage.getItem('caja.borrador.caja-tasas.C-01') ?? 'null')
    expect(guardado.cuenta).toBe(CAJERA.id)
    expect(guardado.campos).toEqual({
      forma_pago: 'CHEQUE',
      observacion: 'cheque del banco',
      pagador_documento: '12345678',
      pagador_nombre: 'SANTOS RIVERA, ELENA',
      lineas: JSON.stringify([
        ['T-002', '1'],
        ['T-001', '3']
      ])
    })
    // only what was typed: no price, no amount
    expect(JSON.stringify(guardado)).not.toMatch(/importe|precio|monto|0\.30|12\.00/)

    rutas.unshift({ method: 'POST', path: '/auth/login', body: { token: 'nuevo', expiresAt: '2026-12-31T00:00:00Z', user: CAJERA } })
    await userEvent.type(screen.getByLabelText('Correo'), CAJERA.email)
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await main().findByRole('textbox', { name: 'Cantidad de T-001' })).toHaveValue('3')
    expect(cantidad('T-002')).toHaveValue('1')
    expect(
      within(tablaDeLineas())
        .getAllByRole('row')
        .slice(1)
        .map((fila) => fila.querySelector('td')?.textContent)
    ).toEqual(['T-002', 'T-001'])
    expect(main().getByRole('combobox', { name: 'Forma de pago' })).toHaveValue('CHEQUE')
    expect(main().getByRole('textbox', { name: 'Documento del pagador (opcional)' })).toHaveValue('12345678')
    expect(main().getByRole('textbox', { name: 'Nombre del pagador (opcional)' })).toHaveValue('SANTOS RIVERA, ELENA')
    expect(main().getByRole('textbox', { name: 'Observación' })).toHaveValue('cheque del banco')
    expect(main().getByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe(EN_C01)
  })

  it('takes the draft of the caja chosen: the cobro is mounted again when the caja changes', async () => {
    guardarBorrador('caja-tasas.C-01', CAJERA.id, {
      forma_pago: 'CHEQUE',
      observacion: 'cheque del banco',
      lineas: JSON.stringify([['T-002', '2']])
    })
    start({ path: '/caja-tasas' })
    await main().findByRole('option', { name: 'C-01 — VENTANILLA 1' })
    expect(main().getByRole('textbox', { name: 'Observación' })).toHaveValue('')
    await userEvent.selectOptions(main().getByRole('combobox', { name: 'Caja' }), 'C-01 — VENTANILLA 1')
    expect(await main().findByRole('textbox', { name: 'Cantidad de T-002' })).toHaveValue('2')
    expect(main().getByRole('combobox', { name: 'Forma de pago' })).toHaveValue('CHEQUE')
    expect(main().getByRole('textbox', { name: 'Observación' })).toHaveValue('cheque del banco')
    expect(main().getByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).toBeInTheDocument()
  })

  it('leaves the button impeded, with why, without CREATE on recibo', async () => {
    start({ permisos: { admin: false, objects: { tasa: ['READ'], caja: ['READ'] } } })
    await agregar('T-001')
    await totalACobrar()
    expect(botonCobrar()).toBeDisabled()
    expect(botonCobrar()).toHaveAccessibleDescription('Su cuenta no puede cobrar: le falta creación de recibo.')
  })

  it('leaves it impeded, with why, while no caja is chosen or no tasa is added', async () => {
    start({ path: '/caja-tasas' })
    await main().findByRole('button', { name: 'Agregar T-001' })
    await waitFor(() => expect(botonCobrar()).toHaveAccessibleDescription('Elija la caja en la que cobra.'))
    await userEvent.selectOptions(main().getByRole('combobox', { name: 'Caja' }), 'C-01 — VENTANILLA 1')
    expect(botonCobrar()).toBeDisabled()
    expect(botonCobrar()).toHaveAccessibleDescription('Agregue las tasas que va a cobrar.')
  })
})

describe('Caja de tasas: the recibo issued', () => {
  const valor = (rotulo: string) => texto(main().getByText(rotulo, { selector: 'dt' }).nextElementSibling)

  it('shows its number, the total and each line with its code, quantity, unit price and amount, all the backend’s', async () => {
    start()
    await tresT001()
    await llenarYCobrar()
    await confirmar()
    await main().findByRole('heading', { name: 'Recibo 001-0000002' })
    expect(valor('Número')).toBe('001-0000002')
    expect(valor('Emitido en')).toBe('02/10/2026 10:20 (hora de Lima)')
    expect(valor('Total')).toBe('S/ 0.30 al 02/10/2026')
    expect(valor('Pagador')).toBe('No se identificó al pagador')
    expect(valor('Concepto')).toBe('CONSTANCIA DE NO ADEUDO')
    expect(valor('Código')).toBe('T-001')
    expect(valor('Cantidad')).toBe('3')
    expect(valor('Precio unitario')).toBe('S/ 0.10 al 02/10/2026')
    expect(valor('Monto')).toBe('S/ 0.30 al 02/10/2026')
  })

  it('names the payer it was cobrado to', async () => {
    start()
    await tresT001()
    await llenarYCobrar({ documento: '12345678', nombre: 'SANTOS RIVERA, ELENA' })
    await confirmar()
    await main().findByRole('heading', { name: 'Recibo 001-0000002' })
    expect(valor('Pagador')).toBe('SANTOS RIVERA, ELENA (12345678)')
  })

  it('opens its PDF with PdfDialog', async () => {
    start()
    await tresT001()
    await llenarYCobrar()
    await confirmar()
    await main().findByRole('heading', { name: 'Recibo 001-0000002' })
    pdf = new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="recibo-001-0000002.pdf"' } })
    const pedidos = vi.spyOn(globalThis, 'fetch')
    await userEvent.click(main().getByRole('button', { name: 'Ver el recibo' }))
    expect(await screen.findByTitle('Recibo 001-0000002')).toHaveAttribute('src', 'blob:recibo-2')
    expect(pedidos.mock.calls.map(([url]) => String(url))).toContain('/api/caja/recibos/001-0000002/pdf')
  })

  it('starts a new cobro with no lines, keeping the caja', async () => {
    start()
    await tresT001()
    await llenarYCobrar()
    await confirmar()
    await main().findByRole('heading', { name: 'Recibo 001-0000002' })
    await userEvent.click(main().getByRole('button', { name: 'Nuevo cobro' }))
    expect(await main().findByText('Agregue las tasas que va a cobrar desde la lista de tasas vigentes.')).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe(EN_C01)
  })
})
