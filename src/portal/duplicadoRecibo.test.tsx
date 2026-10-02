import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion, volverAEntrar } from '../test/portal'
import { guardarBorrador } from './escritura/borrador'
import { PortalApp } from './PortalApp'

// «Duplicado de recibo» (duplicado-recibo): the list with its filters, the recibo chosen in the route, the duplicate in
// PDF (it writes: each one is registered) and «Anular», where the recibo is (caja ADR-0044). the real PANTALLAS: the
// leaf is registered. caja-backend is mocked with its contract (PR #14): every amount a string with its date, none
// the client works out. today is 2026-10-02 in Lima: a recibo is annulled the same day it was cobrado

const AL = '2026-10-02'
const cifra = (importe: string, actualizado_a = AL) => ({ importe, actualizado_a })

const enLista = (numero: string, otros: Record<string, unknown> = {}) => ({
  numero_impreso: numero,
  emitido_en: '2026-10-02T10:15:30.123456-05:00',
  pagador_documento: '12345678',
  pagador_nombre: 'FLORES OTINIANO JUNIOR',
  total: cifra('150.50'),
  forma_pago: 'EFECTIVO',
  duplicados: 0,
  estado: 'EMITIDO',
  ...otros
})

const LISTA = {
  content: [
    enLista('001-0000003', {
      emitido_en: '2026-10-02T11:00:00.000001-05:00',
      pagador_documento: '87654321',
      pagador_nombre: 'QUISPE MAMANI ROSA',
      total: cifra('0.30'),
      forma_pago: 'TARJETA'
    }),
    enLista('001-0000002', { emitido_en: '2026-10-02T10:20:00.123456-05:00', duplicados: 1, estado: 'ANULADO' }),
    enLista('001-0000001')
  ],
  page: 0,
  size: 25,
  totalElements: 3,
  totalPages: 1
}

const lineaDeOrden = {
  orden_id: '8f0c2a8e-1f0e-4d0b-9a8e-3c1d2b4a5e6f',
  sistema_origen: 'rentas',
  concepto: 'IMPUESTO PREDIAL 2026 - CUOTA 1',
  detalle: 'predio U-0001',
  referencia_externa: 'PREDIAL-2026-0001',
  monto: cifra('150.50')
}

const ficha = (numero: string, otros: Record<string, unknown> = {}) => ({
  numero_impreso: numero,
  serie: '001',
  numero: Number.parseInt(numero.slice(4), 10),
  caja: 'C-01',
  cajero: CAJERA.email,
  emitido_en: '2026-10-02T10:15:30.123456-05:00',
  pagador_documento: '12345678',
  pagador_nombre: 'FLORES OTINIANO JUNIOR',
  forma_pago: 'EFECTIVO',
  tipo_pago: 'NORMAL',
  total: cifra('150.50'),
  observacion: 'cobro en ventanilla',
  lineas: [lineaDeOrden],
  estado: 'EMITIDO',
  duplicados: 0,
  anulacion: null,
  ...otros
})

const ANULACION = {
  fecha: AL,
  motivo: 'COBRO EN DEMASÍA',
  autorizado_por: 'JEFE DE CAJA',
  documento_autorizacion: 'MEMO 12-2026',
  usuario: 'jefe@muni.gob.pe'
}

const FICHA_1 = ficha('001-0000001')
const FICHA_2 = ficha('001-0000002', { emitido_en: '2026-10-02T10:20:00.123456-05:00', estado: 'ANULADO', duplicados: 1, anulacion: ANULACION })
// a recibo of tasas: its line has a code, a quantity and a unit price, and no order
const FICHA_3 = ficha('001-0000003', {
  emitido_en: '2026-10-02T11:00:00.000001-05:00',
  pagador_documento: '87654321',
  pagador_nombre: 'QUISPE MAMANI ROSA',
  forma_pago: 'TARJETA',
  tipo_pago: 'TASA',
  total: cifra('0.30'),
  lineas: [
    {
      orden_id: null,
      sistema_origen: null,
      concepto: 'CONSTANCIA DE NO ADEUDO',
      detalle: null,
      referencia_externa: null,
      monto: cifra('0.30'),
      codigo: 'T-001',
      cantidad: 3,
      precio_unitario: cifra('0.10')
    }
  ]
})

// 001-0000001 once another clerk annulled it
const FICHA_2_COMO_1 = { ...FICHA_1, estado: 'ANULADO', anulacion: ANULACION }

const ACTA = {
  numero_impreso: '001-0000001',
  estado: 'ANULADO',
  fecha: AL,
  motivo: 'COBRO EN DEMASÍA',
  autorizado_por: 'JEFE DE CAJA',
  documento_autorizacion: 'MEMO 12-2026',
  usuario: CAJERA.email,
  importe: cifra('150.50'),
  pago_anulado_id: '3e6da681-2467-48e6-acc7-281903b9b578'
}

// what a recibo's ficha reads (caja-backend's 403 names them): the list reads the first, the annulments and the reprints
const LECTURAS = ['recibo', 'linea_recibo', 'caja', 'tasa', 'anulacion_recibo', 'reimpresion_recibo']
const lee = Object.fromEntries(LECTURAS.map((objeto) => [objeto, ['READ']]))

// the four rows of ADR-0044's table «Lo que ve quien sólo puede anular», in caja-backend's permissions
// 1. reads and annuls, with no duplicate of its own
const LEE_Y_ANULA: CallerPermissions = { admin: false, objects: { ...lee, anulacion_recibo: ['READ', 'CREATE'] } }
// 2. only annuls
const SOLO_ANULA: CallerPermissions = { admin: false, objects: { anulacion_recibo: ['CREATE'] } }
// 3. only reads
const SOLO_LEE: CallerPermissions = { admin: false, objects: lee }
// 4. neither
const NINGUNO: CallerPermissions = { admin: false, objects: {} }
// everything: reads, annuls and asks for duplicates
const TODO: CallerPermissions = { admin: false, objects: { ...lee, anulacion_recibo: ['READ', 'CREATE'], reimpresion_recibo: ['READ', 'CREATE'] } }

const SUPERVISORA: AuthUser = { ...CAJERA, id: 'u-supervisora', email: 'supervisora@caja.test', roles: ['SUPERVISOR_CAJA'] }
const OTRA_CAJERA: AuthUser = { ...CAJERA, id: 'u-otra', email: 'otra@caja.test' }

let fetch: FetchMock | null = null
let rutas: MockRoute[] = []
// POST …/duplicados: its body (mockFetch reads JSON answers only, so the PDF is answered here) and its answer
let duplicados: { url: string; body: unknown }[] = []
let respuestaDelDuplicado: () => Response = () => pdf()

const pdf = () =>
  new Response('%PDF-1.7', {
    status: 201,
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="recibo-001-0000001-duplicado-1.pdf"' }
  })
const problema = (status: number, detail: string, errors?: { field: string; message: string }[]) =>
  new Response(JSON.stringify({ title: 'Error', status, detail, ...(errors ? { errors } : {}) }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' }
  })

const rutaDe = (method: string, path: string) => rutas.find((r) => (r.method ?? 'GET') === method && r.path === path)!

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  duplicados = []
  respuestaDelDuplicado = () => pdf()
  // only the date: 12:00 of 2026-10-02 in Lima. the timers stay real, for user-event
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-02T17:00:00Z') })
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:duplicado-1'), revokeObjectURL: vi.fn() })
})
afterEach(() => {
  vi.useRealTimers()
  fetch?.restore()
  fetch = null
})

function start({ path = '/duplicado-recibo', permisos = TODO, user = CAJERA }: { path?: string; permisos?: CallerPermissions; user?: AuthUser } = {}) {
  abrirSesion(user)
  rutas = [
    { method: 'GET', path: '/caja/recibos', body: LISTA },
    { method: 'GET', path: '/caja/recibos/001-0000001', body: FICHA_1 },
    { method: 'GET', path: '/caja/recibos/001-0000002', body: FICHA_2 },
    { method: 'GET', path: '/caja/recibos/001-0000003', body: FICHA_3 },
    { method: 'POST', path: '/caja/recibos/001-0000001/anulacion', status: 201, body: ACTA },
    ...rutasDeSesion(user, permisos)
  ]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  const simulado = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/duplicados') && init?.method === 'POST') {
      duplicados.push({ url, body: JSON.parse(String(init.body)) })
      return respuestaDelDuplicado()
    }
    return simulado(input, init)
  }) as typeof globalThis.fetch
  render(<PortalApp />)
}

const main = () => within(screen.getByRole('main'))
const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ')
const llamadas = (method: string, path: string) => fetch!.calls.filter((c) => c.method === method && c.path.split('?')[0] === path)
const enLaRuta = () => window.location.pathname + window.location.search
const tabla = () => main().findByRole('table', { name: 'Recibos' })
const fila = async (numero: string) => (await main().findByRole('button', { name: `Ver ${numero}` })).closest('tr')!
const valor = (rotulo: string) => texto(main().getByText(rotulo, { selector: 'dt' }).nextElementSibling)
const botonAnular = () => main().findByRole('button', { name: 'Anular' })
const botonDuplicado = () => main().findByRole('button', { name: 'Duplicado en PDF' })
const elActo = () => within(screen.getByRole('region', { name: 'Anular el recibo 001-0000001' }))
const elDuplicado = () => within(screen.getByRole('region', { name: 'Pedir un duplicado' }))

// the ficha of 001-0000001 is on screen
async function enLaFicha(path = '/duplicado-recibo/001-0000001', opciones: { permisos?: CallerPermissions; user?: AuthUser } = {}) {
  start({ path, ...opciones })
  await main().findByRole('heading', { name: `Recibo ${path.split('/')[2]}` })
}

async function escribir(campo: HTMLElement, valor: string) {
  await userEvent.clear(campo)
  if (valor) await userEvent.type(campo, valor)
}

async function llenarLaAnulacion({
  motivo = 'COBRO EN DEMASÍA',
  autorizado = 'JEFE DE CAJA',
  memorando = 'MEMO 12-2026',
  observacion = 'el pagador pagó dos veces en ventanilla'
} = {}) {
  await userEvent.click(await botonAnular())
  await escribir(elActo().getByRole('textbox', { name: /^Motivo/ }), motivo)
  await escribir(elActo().getByRole('textbox', { name: /^Autorizado por/ }), autorizado)
  await escribir(elActo().getByRole('textbox', { name: /^N\.° de memorando/ }), memorando)
  await escribir(elActo().getByRole('textbox', { name: /^Observación/ }), observacion)
  await userEvent.click(elActo().getByRole('button', { name: 'Anular el recibo' }))
}

async function confirmarLaAnulacion() {
  const dialogo = await screen.findByRole('dialog', { name: 'Confirmar la anulación' })
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular' }))
}

async function pedirElDuplicado(observacion = 'reimpresión pedida por el pagador') {
  await userEvent.click(await botonDuplicado())
  await escribir(elDuplicado().getByRole('textbox', { name: 'Observación' }), observacion)
  await userEvent.click(elDuplicado().getByRole('button', { name: 'Pedir el duplicado' }))
}

describe('Duplicado de recibo: the leaf and its list', () => {
  it('is offered in the tree and lists the recibos, every amount with its date', async () => {
    start()
    expect(await main().findByRole('heading', { name: 'Duplicado de recibo', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Duplicado de recibo' }).length).toBeGreaterThan(0)
    const recibos = await tabla()
    const cabeceras = within(recibos)
      .getAllByRole('columnheader')
      .map((th) => texto(th).trim())
    expect(cabeceras).toEqual(['Número', 'Emitido', 'Documento', 'Pagador', 'Importe al 02/10/2026', 'Medio de pago', 'Duplicados', 'Estado', 'Ver'])
    const primera = await fila('001-0000002')
    expect(
      within(primera)
        .getAllByRole('cell')
        .map((td) => texto(td).trim())
    ).toEqual(['001-0000002', '02/10/2026 10:20 (hora de Lima)', '12345678', 'FLORES OTINIANO JUNIOR', 'S/ 150.50', 'Efectivo', '1', 'Anulado', 'Ver'])
    expect(texto(await fila('001-0000003'))).toContain('Tarjeta')
    expect(llamadas('GET', '/caja/recibos').map((c) => c.path)).toEqual(['/caja/recibos?page=0&size=25'])
  })

  it('keeps on its own date a figure of another date than the heading’s', async () => {
    start()
    rutaDe('GET', '/caja/recibos').body = { ...LISTA, content: [LISTA.content[0], { ...LISTA.content[2], total: cifra('150.50', '2026-10-01') }] }
    expect(texto(await fila('001-0000001'))).toContain('S/ 150.50 al 01/10/2026')
    expect(texto(await fila('001-0000003'))).toContain('S/ 0.30 al 02/10/2026')
    // no single date for the heading: each figure keeps its own
    const importe = within(await tabla())
      .getAllByRole('columnheader')
      .find((th) => texto(th).startsWith('Importe'))
    expect(texto(importe!).trim()).toBe('Importe')
  })

  it('says so when nothing matches', async () => {
    start()
    rutaDe('GET', '/caja/recibos').body = { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 }
    expect(await main().findByText('Ningún recibo coincide con la búsqueda.')).toBeInTheDocument()
  })

  it('asks the list again when «Buscar» is pressed with the same filters', async () => {
    start({ path: '/duplicado-recibo?documento=12345678' })
    await tabla()
    expect(llamadas('GET', '/caja/recibos')).toHaveLength(1)

    rutaDe('GET', '/caja/recibos').body = { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 }
    await userEvent.click(main().getByRole('button', { name: 'Buscar' }))
    expect(await main().findByText('Ningún recibo coincide con la búsqueda.')).toBeInTheDocument()
    expect(llamadas('GET', '/caja/recibos').map((c) => c.path)).toEqual([
      '/caja/recibos?documento=12345678&page=0&size=25',
      '/caja/recibos?documento=12345678&page=0&size=25'
    ])
    expect(enLaRuta()).toBe('/duplicado-recibo?documento=12345678')
  })

  it('keeps the filters and the recibo chosen in the route, and a reload shows the same', async () => {
    start()
    await tabla()
    await userEvent.type(main().getByRole('textbox', { name: 'Documento del pagador' }), '12345678')
    await userEvent.type(main().getByRole('textbox', { name: 'Caja' }), 'C-01')
    await userEvent.type(main().getByRole('textbox', { name: 'Cajero (correo)' }), CAJERA.email)
    await userEvent.type(main().getByLabelText('Desde'), '2026-10-01')
    await userEvent.type(main().getByLabelText('Hasta'), '2026-10-02')
    await userEvent.selectOptions(main().getByRole('combobox', { name: 'Estado' }), 'Emitido')
    await userEvent.click(main().getByRole('button', { name: 'Buscar' }))

    const filtros = `documento=12345678&caja=C-01&cajero=${encodeURIComponent(CAJERA.email)}&desde=2026-10-01&hasta=2026-10-02&estado=EMITIDO`
    await waitFor(() => expect(enLaRuta()).toBe(`/duplicado-recibo?${filtros}`))
    await waitFor(() => expect(llamadas('GET', '/caja/recibos').at(-1)?.path).toBe(`/caja/recibos?${filtros}&page=0&size=25`))

    await userEvent.click(await main().findByRole('button', { name: 'Ver 001-0000001' }))
    expect(await main().findByRole('heading', { name: 'Recibo 001-0000001' })).toBeInTheDocument()
    expect(enLaRuta()).toBe(`/duplicado-recibo/001-0000001?${filtros}`)

    // a reload, or the link passed on: the same recibo and the same filters
    cleanup()
    fetch!.restore()
    start({ path: `/duplicado-recibo/001-0000001?${filtros}` })
    expect(await main().findByRole('heading', { name: 'Recibo 001-0000001' })).toBeInTheDocument()
    expect(main().getByRole('textbox', { name: 'Documento del pagador' })).toHaveValue('12345678')
    expect(main().getByRole('combobox', { name: 'Estado' })).toHaveValue('EMITIDO')
    await waitFor(() => expect(llamadas('GET', '/caja/recibos').at(-1)?.path).toBe(`/caja/recibos?${filtros}&page=0&size=25`))
    expect(llamadas('GET', '/caja/recibos/001-0000001')).toHaveLength(1)
  })

  it('pages with PageSizePagination, in the route', async () => {
    start()
    rutaDe('GET', '/caja/recibos').body = { ...LISTA, totalElements: 60, totalPages: 3 }
    await tabla()
    await userEvent.click(await main().findByRole('button', { name: /siguiente/i }))
    await waitFor(() => expect(enLaRuta()).toBe('/duplicado-recibo?page=1'))
    await waitFor(() => expect(llamadas('GET', '/caja/recibos').at(-1)?.path).toBe('/caja/recibos?page=1&size=25'))
    await userEvent.selectOptions(main().getByRole('combobox', { name: /filas/i }), '50')
    await waitFor(() => expect(enLaRuta()).toBe('/duplicado-recibo?size=50'))
    await waitFor(() => expect(llamadas('GET', '/caja/recibos').at(-1)?.path).toBe('/caja/recibos?page=0&size=50'))
  })

  it('says a 400 of the list under its filter', async () => {
    start({ path: '/duplicado-recibo?desde=2026-10-05&hasta=2026-10-01' })
    Object.assign(rutaDe('GET', '/caja/recibos'), {
      status: 400,
      body: {
        title: 'Bad Request',
        status: 400,
        detail: 'La consulta de recibos no es válida',
        errors: [{ field: 'hasta', message: 'el rango de fechas está al revés: desde 2026-10-05 hasta 2026-10-01' }]
      }
    })
    expect(await main().findByText('el rango de fechas está al revés: desde 2026-10-05 hasta 2026-10-01')).toBeInTheDocument()
    expect(main().getByLabelText('Hasta')).toHaveAccessibleDescription('el rango de fechas está al revés: desde 2026-10-05 hasta 2026-10-01')
  })

  it('a 403 on the list is said in its place, and the ficha stays', async () => {
    start({ path: '/duplicado-recibo/001-0000001' })
    Object.assign(rutaDe('GET', '/caja/recibos'), {
      status: 403,
      body: { title: 'Forbidden', status: 403, detail: 'Leer recibo exige permiso de lectura sobre recibo' }
    })
    expect(await main().findByText(/No se pudo leer la lista de recibos: Leer recibo exige permiso de lectura sobre recibo/)).toBeInTheDocument()
    expect(await main().findByRole('heading', { name: 'Recibo 001-0000001' })).toBeInTheDocument()
    expect(valor('Total')).toBe('S/ 150.50 al 02/10/2026')
  })
})

describe('Duplicado de recibo: the recibo chosen', () => {
  it('shows its ficha and its lines, every amount the backend’s with its date', async () => {
    await enLaFicha()
    expect(valor('Número')).toBe('001-0000001')
    expect(valor('Estado')).toBe('Emitido')
    expect(valor('Caja')).toBe('C-01')
    expect(valor('Cajero')).toBe(CAJERA.email)
    expect(valor('Emitido en')).toBe('02/10/2026 10:15 (hora de Lima)')
    expect(valor('Forma de pago')).toBe('Efectivo')
    expect(valor('Tipo de pago')).toBe('Orden de cobro')
    expect(valor('Pagador')).toBe('FLORES OTINIANO JUNIOR (12345678)')
    expect(valor('Duplicados emitidos')).toBe('0')
    expect(valor('Total')).toBe('S/ 150.50 al 02/10/2026')
    expect(valor('Observación del cobro')).toBe('cobro en ventanilla')
    expect(valor('Concepto')).toBe('IMPUESTO PREDIAL 2026 - CUOTA 1')
    expect(valor('Referencia')).toBe('PREDIAL-2026-0001')
    expect(valor('Sistema de origen')).toBe('rentas')
    expect(valor('Monto')).toBe('S/ 150.50 al 02/10/2026')
    expect(main().queryByText('Anulado el', { selector: 'dt' })).not.toBeInTheDocument()
  })

  it('shows the lines of a recibo of tasas with their code, quantity and unit price', async () => {
    await enLaFicha('/duplicado-recibo/001-0000003')
    expect(valor('Tipo de pago')).toBe('Tasa')
    expect(valor('Concepto')).toBe('CONSTANCIA DE NO ADEUDO')
    expect(valor('Código')).toBe('T-001')
    expect(valor('Cantidad')).toBe('3')
    expect(valor('Precio unitario')).toBe('S/ 0.10 al 02/10/2026')
    expect(valor('Monto')).toBe('S/ 0.30 al 02/10/2026')
  })

  it('shows the annulment of an annulled recibo: when, why, who authorized it, the memorandum and who did it', async () => {
    await enLaFicha('/duplicado-recibo/001-0000002')
    expect(valor('Estado')).toBe('Anulado')
    expect(main().getByText('Este recibo está anulado: no acredita pago.')).toBeInTheDocument()
    expect(valor('Anulado el')).toBe('02/10/2026')
    expect(valor('Motivo de la anulación')).toBe('COBRO EN DEMASÍA')
    expect(valor('Autorizado por')).toBe('JEFE DE CAJA')
    expect(valor('N.° de memorando')).toBe('MEMO 12-2026')
    expect(valor('Anulado por')).toBe('jefe@muni.gob.pe')
  })

  it('says why a recibo cannot be read', async () => {
    start({ path: '/duplicado-recibo/001-0000009' })
    expect(await main().findByText(/No se pudo leer el recibo 001-0000009/)).toBeInTheDocument()
  })
})

describe('Duplicado de recibo: what whoever may only annul sees (caja ADR-0044)', () => {
  it('1 · reads and annuls: the leaf, its list, the ficha and «Anular» pressable; no duplicate of its own', async () => {
    await enLaFicha('/duplicado-recibo/001-0000001', { permisos: LEE_Y_ANULA })
    expect(screen.getAllByRole('link', { name: 'Duplicado de recibo' }).length).toBeGreaterThan(0)
    expect(await fila('001-0000002')).toBeInTheDocument()
    expect(await botonAnular()).toBeEnabled()
    expect(await botonDuplicado()).toBeDisabled()
    expect(await botonDuplicado()).toHaveAccessibleDescription('Su cuenta no puede pedir duplicados: le falta creación de reimpresion_recibo.')
  })

  it('2 · only annuls: the same leaf, the 403 of the list in its place, and «Anular» impeded naming what to ask for', async () => {
    start({ path: '/duplicado-recibo/001-0000001', permisos: SOLO_ANULA })
    Object.assign(rutaDe('GET', '/caja/recibos'), {
      status: 403,
      body: { title: 'Forbidden', status: 403, detail: 'Leer recibo exige permiso de lectura sobre recibo' }
    })
    Object.assign(rutaDe('GET', '/caja/recibos/001-0000001'), {
      status: 403,
      body: { title: 'Forbidden', status: 403, detail: 'Leer recibo exige permiso de lectura sobre recibo' }
    })
    expect(await main().findByRole('heading', { name: 'Duplicado de recibo', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Duplicado de recibo' }).length).toBeGreaterThan(0)
    expect(await main().findByText(/No se pudo leer la lista de recibos: Leer recibo exige permiso de lectura sobre recibo/)).toBeInTheDocument()
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription(
      'Su cuenta puede anular, pero no puede ver el recibo, y un recibo no se anula sin verlo: le falta lectura de recibo y lectura de linea_recibo y lectura de caja y lectura de tasa y lectura de anulacion_recibo y lectura de reimpresion_recibo.'
    )
  })

  it('3 · only reads: the whole leaf, and «Anular» impeded naming the permission it lacks', async () => {
    await enLaFicha('/duplicado-recibo/001-0000001', { permisos: SOLO_LEE })
    expect(await fila('001-0000002')).toBeInTheDocument()
    expect(valor('Total')).toBe('S/ 150.50 al 02/10/2026')
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription('Su cuenta no puede anular: le falta creación de anulacion_recibo.')
  })

  it('4 · neither: the leaf is not offered, and its url says what the account lacks', async () => {
    start({ permisos: NINGUNO })
    expect(
      await main().findByText('Su cuenta no puede abrir «Duplicado de recibo»: le falta lectura de recibo, o creación de anulacion_recibo.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Duplicado de recibo' })).not.toBeInTheDocument()
    expect(fetch!.calls.filter((c) => c.path.startsWith('/caja/'))).toEqual([])
  })
})

describe('Duplicado de recibo: no mute button, each impediment says why', () => {
  it('«Anular» without CREATE on anulacion_recibo', async () => {
    await enLaFicha('/duplicado-recibo/001-0000001', { permisos: { admin: false, objects: { ...lee, reimpresion_recibo: ['READ', 'CREATE'] } } })
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription('Su cuenta no puede anular: le falta creación de anulacion_recibo.')
  })

  it('«Anular» when the account cannot read the recibo', async () => {
    await enLaFicha('/duplicado-recibo/001-0000001', {
      permisos: { admin: false, objects: { ...lee, linea_recibo: [], anulacion_recibo: ['READ', 'CREATE'] } }
    })
    expect(await botonAnular()).toHaveAccessibleDescription(
      'Su cuenta puede anular, pero no puede ver el recibo, y un recibo no se anula sin verlo: le falta lectura de linea_recibo.'
    )
  })

  it('both, with no recibo chosen', async () => {
    start()
    await tabla()
    expect(main().getByText('Elija un recibo de la lista con «Ver».')).toBeInTheDocument()
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription('Elija primero un recibo de la lista: aquí no se anula un número tecleado a ciegas.')
    expect(await botonDuplicado()).toBeDisabled()
    expect(await botonDuplicado()).toHaveAccessibleDescription('Elija primero un recibo de la lista.')
  })

  it('both, when the recibo cannot be read', async () => {
    start({ path: '/duplicado-recibo/001-0000009' })
    await main().findByText(/No se pudo leer el recibo 001-0000009/)
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription('Sin ver el recibo no se anula: no mock for GET /caja/recibos/001-0000009')
    expect(await botonDuplicado()).toBeDisabled()
    expect(await botonDuplicado()).toHaveAccessibleDescription('Sin ver el recibo no se pide su duplicado: no mock for GET /caja/recibos/001-0000009')
  })

  it('«Anular» on a recibo already annulled', async () => {
    await enLaFicha('/duplicado-recibo/001-0000002')
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription('Este recibo ya se anuló el 02/10/2026: un recibo no se anula dos veces.')
    // its duplicate may still be asked for: it says it is annulled
    expect(await botonDuplicado()).toBeEnabled()
  })

  it('«Anular» on a recibo of another day', async () => {
    start({ path: '/duplicado-recibo/001-0000001' })
    rutaDe('GET', '/caja/recibos/001-0000001').body = { ...FICHA_1, emitido_en: '2026-10-01T18:30:00.000001-05:00' }
    await main().findByRole('heading', { name: 'Recibo 001-0000001' })
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription(
      'Este recibo se emitió el 01/10/2026 y hoy es 02/10/2026: un recibo solo se anula el mismo día del pago. Lo que corresponde es una devolución.'
    )
  })

  it('«Anular» on another cashier’s recibo without the role SUPERVISOR_CAJA (ESPECIAL)', async () => {
    await enLaFicha('/duplicado-recibo/001-0000001', { user: OTRA_CAJERA })
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription(
      `Este recibo lo cobró otro cajero (${CAJERA.email}): anularlo exige el rol SUPERVISOR_CAJA, y su cuenta no lo tiene.`
    )
  })

  it('«Anular» on another cashier’s recibo is pressable with the role SUPERVISOR_CAJA, as wasichai says it', async () => {
    await enLaFicha('/duplicado-recibo/001-0000001', { user: SUPERVISORA })
    expect(await botonAnular()).toBeEnabled()
    expect(await botonAnular()).not.toHaveAccessibleDescription()
  })

  it('«Duplicado en PDF» without CREATE on reimpresion_recibo', async () => {
    await enLaFicha('/duplicado-recibo/001-0000001', { permisos: LEE_Y_ANULA })
    expect(await botonDuplicado()).toBeDisabled()
    expect(await botonDuplicado()).toHaveAccessibleDescription('Su cuenta no puede pedir duplicados: le falta creación de reimpresion_recibo.')
  })
})

describe('Duplicado de recibo: anular', () => {
  it('confirms before sending, sends the four fields, and the ficha then shows it annulled, as the backend reads it again', async () => {
    await enLaFicha()
    await llenarLaAnulacion()

    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar la anulación' })
    expect(texto(dialogo)).toContain('Se anula el recibo 001-0000001, de FLORES OTINIANO JUNIOR (12345678), por S/ 150.50 al 02/10/2026.')
    expect(texto(dialogo)).toContain('Motivo: COBRO EN DEMASÍA')
    expect(texto(dialogo)).toContain('no se deshace')
    expect(llamadas('POST', '/caja/recibos/001-0000001/anulacion')).toHaveLength(0)

    rutaDe('GET', '/caja/recibos/001-0000001').body = { ...FICHA_1, estado: 'ANULADO', anulacion: { ...ANULACION, usuario: CAJERA.email } }
    await confirmarLaAnulacion()

    expect(await main().findByText('El recibo 001-0000001 quedó anulado.')).toBeInTheDocument()
    expect(llamadas('POST', '/caja/recibos/001-0000001/anulacion')[0].body).toEqual({
      motivo: 'COBRO EN DEMASÍA',
      autorizado_por: 'JEFE DE CAJA',
      documento_autorizacion: 'MEMO 12-2026',
      observacion: 'el pagador pagó dos veces en ventanilla'
    })
    await waitFor(() => expect(valor('Estado')).toBe('Anulado'))
    expect(valor('Motivo de la anulación')).toBe('COBRO EN DEMASÍA')
    expect(valor('Anulado por')).toBe(CAJERA.email)
    expect(llamadas('GET', '/caja/recibos/001-0000001')).toHaveLength(2)
    expect(await botonAnular()).toHaveAccessibleDescription('Este recibo ya se anuló el 02/10/2026: un recibo no se anula dos veces.')
  })

  it('sends no authorizer nor memorandum when none was typed', async () => {
    await enLaFicha()
    await llenarLaAnulacion({ autorizado: '', memorando: '' })
    await confirmarLaAnulacion()
    await main().findByText('El recibo 001-0000001 quedó anulado.')
    expect(llamadas('POST', '/caja/recibos/001-0000001/anulacion')[0].body).toEqual({
      motivo: 'COBRO EN DEMASÍA',
      observacion: 'el pagador pagó dos veces en ventanilla'
    })
  })

  it('checks the motive and the observation before confirming', async () => {
    await enLaFicha()
    await llenarLaAnulacion({ motivo: '', observacion: 'no' })
    expect(await elActo().findByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(elActo().getByText('Explique la anulación: de 5 a 500 caracteres.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await escribir(elActo().getByRole('textbox', { name: /^Motivo/ }), 'M'.repeat(81))
    await userEvent.click(elActo().getByRole('button', { name: 'Anular el recibo' }))
    expect(await elActo().findByText('A lo sumo 80 caracteres.')).toBeInTheDocument()
    expect(llamadas('POST', '/caja/recibos/001-0000001/anulacion')).toHaveLength(0)
  })

  it('says a 400 under its field', async () => {
    await enLaFicha()
    Object.assign(rutaDe('POST', '/caja/recibos/001-0000001/anulacion'), {
      status: 400,
      body: {
        title: 'Bad Request',
        status: 400,
        detail: 'Dato demasiado largo',
        errors: [{ field: 'documento_autorizacion', message: 'a lo sumo 40 caracteres' }]
      }
    })
    await llenarLaAnulacion()
    await confirmarLaAnulacion()
    expect(await elActo().findByText('a lo sumo 40 caracteres')).toBeInTheDocument()
    expect(elActo().getByRole('textbox', { name: /^N\.° de memorando/ })).toHaveAccessibleDescription('a lo sumo 40 caracteres')
  })

  it.each([
    [403, 'El recibo 001-0000001 lo cobró otro cajero (ana@muni.gob.pe): anularlo exige el rol SUPERVISOR_CAJA, porque toca el arqueo de su turno'],
    [409, 'El recibo 001-0000001 ya se anuló el 2026-10-02: las órdenes que cobró ya volvieron a PENDIENTE'],
    [
      422,
      'El recibo 001-0000001 se cobró el 2026-10-01 y hoy es 2026-10-02: un recibo solo se anula el mismo día del pago. Lo que corresponde es una devolución'
    ]
  ])('says a %i with its detail', async (status, detail) => {
    await enLaFicha()
    Object.assign(rutaDe('POST', '/caja/recibos/001-0000001/anulacion'), { status, body: { title: 'Error', status, detail } })
    await llenarLaAnulacion()
    await confirmarLaAnulacion()
    expect(await elActo().findByRole('alert')).toHaveTextContent(detail)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reads the ficha again on a 409, so «Anular» says why instead of staying pressable on an old ficha', async () => {
    await enLaFicha()
    const detail = 'El recibo 001-0000001 ya se anuló el 2026-10-02: las órdenes que cobró ya volvieron a PENDIENTE'
    Object.assign(rutaDe('POST', '/caja/recibos/001-0000001/anulacion'), { status: 409, body: { title: 'Conflict', status: 409, detail } })
    await llenarLaAnulacion()
    // another clerk annulled it meanwhile: the backend says so when the ficha is read again
    rutaDe('GET', '/caja/recibos/001-0000001').body = FICHA_2_COMO_1
    await confirmarLaAnulacion()
    await waitFor(() => expect(llamadas('GET', '/caja/recibos/001-0000001')).toHaveLength(2))
    await waitFor(() => expect(valor('Estado')).toBe('Anulado'))
    expect(await botonAnular()).toBeDisabled()
    expect(await botonAnular()).toHaveAccessibleDescription('Este recibo ya se anuló el 02/10/2026: un recibo no se anula dos veces.')
  })

  it('keeps the draft of a 401 by the recibo’s number, and gives it back to that recibo and not another', async () => {
    await enLaFicha()
    Object.assign(rutaDe('POST', '/caja/recibos/001-0000001/anulacion'), { status: 401, body: { title: 'Unauthorized', status: 401 } })
    await llenarLaAnulacion()
    await confirmarLaAnulacion()

    await screen.findByLabelText('Contraseña')
    const guardado = JSON.parse(sessionStorage.getItem('caja.borrador.anulacion.001-0000001') ?? 'null')
    expect(guardado).toEqual({
      cuenta: CAJERA.id,
      campos: {
        motivo: 'COBRO EN DEMASÍA',
        autorizado_por: 'JEFE DE CAJA',
        documento_autorizacion: 'MEMO 12-2026',
        observacion: 'el pagador pagó dos veces en ventanilla'
      }
    })

    rutas.unshift({ method: 'POST', path: '/auth/login', body: { token: 'nuevo', expiresAt: '2026-12-31T00:00:00Z', user: CAJERA } })
    await volverAEntrar(CAJERA)

    // back on that recibo: the act is open, filled in
    expect(await main().findByRole('heading', { name: 'Recibo 001-0000001' })).toBeInTheDocument()
    expect(enLaRuta()).toBe('/duplicado-recibo/001-0000001')
    await waitFor(() => expect(elActo().getByRole('textbox', { name: /^Motivo/ })).toHaveValue('COBRO EN DEMASÍA'))
    expect(elActo().getByRole('textbox', { name: /^Autorizado por/ })).toHaveValue('JEFE DE CAJA')
    expect(elActo().getByRole('textbox', { name: /^N\.° de memorando/ })).toHaveValue('MEMO 12-2026')
    expect(elActo().getByRole('textbox', { name: /^Observación/ })).toHaveValue('el pagador pagó dos veces en ventanilla')
    expect(elActo().getByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).toBeInTheDocument()

    // another recibo: its act is its own, empty
    await userEvent.click(await main().findByRole('button', { name: 'Ver 001-0000003' }))
    await main().findByRole('heading', { name: 'Recibo 001-0000003' })
    expect(screen.queryByRole('region', { name: /^Anular el recibo/ })).not.toBeInTheDocument()
    await userEvent.click(await botonAnular())
    const otro = within(screen.getByRole('region', { name: 'Anular el recibo 001-0000003' }))
    expect(otro.getByRole('textbox', { name: /^Motivo/ })).toHaveValue('')
    expect(otro.getByRole('textbox', { name: /^Observación/ })).toHaveValue('')
    expect(otro.queryByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('caja.borrador.anulacion.001-0000001')).not.toBeNull()
  })

  it('does not hand a recibo the draft of another one', async () => {
    guardarBorrador('anulacion.001-0000003', CAJERA.id, { motivo: 'OTRO', observacion: 'la de otro recibo' })
    await enLaFicha()
    expect(screen.queryByRole('region', { name: /^Anular el recibo/ })).not.toBeInTheDocument()
    await userEvent.click(await botonAnular())
    expect(elActo().getByRole('textbox', { name: /^Motivo/ })).toHaveValue('')
  })

  it('forgets the draft when the act is cancelled', async () => {
    guardarBorrador('anulacion.001-0000001', CAJERA.id, { motivo: 'COBRO EN DEMASÍA', observacion: 'el pagador pagó dos veces' })
    await enLaFicha()
    await waitFor(() => expect(elActo().getByRole('textbox', { name: /^Motivo/ })).toHaveValue('COBRO EN DEMASÍA'))
    await userEvent.click(elActo().getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('region', { name: /^Anular el recibo/ })).not.toBeInTheDocument()
    expect(sessionStorage.getItem('caja.borrador.anulacion.001-0000001')).toBeNull()
  })
})

describe('Duplicado de recibo: the duplicate in PDF', () => {
  it('asks for an observation, registers the reprint and opens the PDF; it is never asked for on opening the ficha', async () => {
    await enLaFicha()
    expect(duplicados).toEqual([])
    rutaDe('GET', '/caja/recibos/001-0000001').body = { ...FICHA_1, duplicados: 1 }
    await pedirElDuplicado()

    expect(await screen.findByTitle('Duplicado del recibo 001-0000001')).toHaveAttribute('src', 'blob:duplicado-1')
    expect(duplicados).toEqual([{ url: '/api/caja/recibos/001-0000001/duplicados', body: { observacion: 'reimpresión pedida por el pagador' } }])
    // registered: the ficha is read again, with its count
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(valor('Duplicados emitidos')).toBe('1'))
    expect(duplicados).toHaveLength(1)
  })

  it('checks the observation before asking', async () => {
    await enLaFicha()
    await pedirElDuplicado('no')
    expect(await elDuplicado().findByText('Explique la reimpresión: de 5 a 500 caracteres.')).toBeInTheDocument()
    expect(elDuplicado().getByRole('textbox', { name: 'Observación' })).toHaveAccessibleDescription('Explique la reimpresión: de 5 a 500 caracteres.')
    expect(duplicados).toEqual([])
  })

  it('says a 409: the recibo is no longer drawn the same, and nothing was handed out nor registered', async () => {
    await enLaFicha()
    const detail =
      'El recibo 001-0000001 ya no se dibuja igual que en su reimpresión del 2026-10-01: el resumen era 3f2a… y ahora es 9c1b…. Entregarlo sería dar un papel distinto al original con el mismo número'
    respuestaDelDuplicado = () => problema(409, detail)
    await pedirElDuplicado()
    const alerta = await elDuplicado().findByRole('alert')
    expect(alerta).toHaveTextContent('Este recibo ya no se dibuja igual que en su reimpresión anterior: no se entregó ni se registró este duplicado.')
    expect(alerta).toHaveTextContent(detail)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says a 400 under the observation, and a 403 with its detail', async () => {
    await enLaFicha()
    respuestaDelDuplicado = () => problema(400, 'El duplicado no es válido', [{ field: 'observacion', message: 'de 5 a 500 caracteres' }])
    await pedirElDuplicado()
    expect(await elDuplicado().findByText('de 5 a 500 caracteres')).toBeInTheDocument()
    expect(elDuplicado().getByRole('textbox', { name: 'Observación' })).toHaveAccessibleDescription('de 5 a 500 caracteres')

    const detail = 'Reimprimir un recibo exige permiso de creación sobre reimpresion_recibo: cada duplicado queda registrado'
    respuestaDelDuplicado = () => problema(403, detail)
    await userEvent.click(elDuplicado().getByRole('button', { name: 'Pedir el duplicado' }))
    expect(await elDuplicado().findByRole('alert')).toHaveTextContent(detail)
  })

  it('keeps the observation of a 401 by the recibo’s number', async () => {
    await enLaFicha()
    respuestaDelDuplicado = () => problema(401, 'La sesión caducó')
    await pedirElDuplicado()
    await screen.findByLabelText('Contraseña')
    expect(JSON.parse(sessionStorage.getItem('caja.borrador.duplicado.001-0000001') ?? 'null')).toEqual({
      cuenta: CAJERA.id,
      campos: { observacion: 'reimpresión pedida por el pagador' }
    })
  })
})
