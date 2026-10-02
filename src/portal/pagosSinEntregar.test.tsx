import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, CAJERA, rutasDeSesion, volverAEntrar } from '../test/portal'
import { PortalApp } from './PortalApp'

// «Pagos sin entregar», in the leaf «Cierre y arqueo de caja»: the payments that ran out of retries (MUERTO), and the
// act that explains one (MUERTO → EXPLICADO) so that its turno closes. the real PANTALLAS. caja-backend is mocked with
// its contract (PR #18). today is 2026-10-02 in Lima

const AL = '2026-10-02'
const cifra = (importe: string) => ({ importe, actualizado_a: AL })

const T1 = '0b0a6c1e-3f2d-4c7a-9d4e-2a1b3c4d5e6f'
const EN_C01 = {
  turno_id: T1,
  caja: 'C-01',
  caja_nombre: 'VENTANILLA 1',
  cajero: CAJERA.email,
  fecha: AL,
  abierto_en: '2026-10-02T08:01:12.345678-05:00',
  estado_del_turno: 'ABIERTO'
}
const DEL_DIA = { cajero: CAJERA.email, fecha: AL, situacion: 'ABIERTO', turnos: [EN_C01] }

const PAGO = '3e6da681-2467-48e6-acc7-281903b9b578'
const OTRO = '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e'
const ERROR = '«rentas» contestó 503 al publicar el pago: se reintenta. Contestó con el cuerpo vacío'

// a row of GET /pagos/sin-entregar, as the backend gives it
const pago = (otros: Record<string, unknown> = {}) => ({
  pago_id: PAGO,
  tipo: 'PAGO_REGISTRADO',
  destino: 'rentas',
  recibo: '001-0000001',
  turno_id: T1,
  estado: 'MUERTO',
  intentos: 8,
  ultimo_error: ERROR,
  creado_en: '2026-10-02T10:15:30.123456-05:00',
  entregado_en: null,
  explicacion: null,
  ...otros
})
// a turno that is not one of the clerk's today (another cashier's, another day): the screen only knows its id
const T_AJENO = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const OTRO_PAGO = pago({
  pago_id: OTRO,
  turno_id: T_AJENO,
  tipo: 'PAGO_ANULADO',
  destino: 'licencias',
  recibo: null,
  intentos: 12,
  ultimo_error: null,
  creado_en: '2026-10-02T11:40:00.000001-05:00'
})

const EXPLICACION = 'rentas borró la orden; el pago se registró a mano con el memo 12-2026'
const OBSERVACION = 'conciliado con rentas por teléfono'

// the live arqueo of the turno: the MUERTO payment keeps it from closing until it is explained
const arqueo = (impiden: { pago_id: string; tipo: string; estado: string }[]) => ({
  turno_id: T1,
  estado_del_turno: 'ABIERTO',
  puede_cerrar: impiden.length === 0,
  arqueo: {
    lineas: [
      {
        forma_pago: 'EFECTIVO',
        cobrado: cifra('187.40'),
        anulado: cifra('0.00'),
        neto: cifra('187.40'),
        declarado: null,
        diferencia: null
      }
    ],
    recibos_emitidos: 4,
    recibos_anulados: 0,
    total_cobrado: cifra('187.40'),
    total_anulado: cifra('0.00'),
    neto: cifra('187.40'),
    total_declarado: null,
    diferencia: null,
    cuadra: null
  },
  cobrado_con_evento: cifra('150.50'),
  cobrado_sin_evento: cifra('37.60'),
  lo_que_impide_cerrar: impiden
})
const IMPIDE = [{ pago_id: PAGO, tipo: 'PAGO_REGISTRADO', estado: 'MUERTO' }]

// what GET /turnos/** and /pagos/sin-entregar read
const LECTURAS = ['turno', 'caja', 'recibo', 'anulacion_recibo', 'pago_evento', 'cierre_turno', 'reversion_cierre']
const lee = Object.fromEntries(LECTURAS.map((objeto) => [objeto, ['READ']]))
// a cashier: reads and closes, and cannot explain
const CAJERO: CallerPermissions = { admin: false, objects: { ...lee, cierre_turno: ['READ', 'CREATE'], cierre_turno_linea: ['READ', 'CREATE'] } }
// a supervisor of the caja: UPDATE on pago_evento explains
const SUPERVISOR: CallerPermissions = {
  admin: false,
  objects: { ...CAJERO.objects, reversion_cierre: ['READ', 'CREATE'], pago_evento: ['READ', 'UPDATE'] }
}
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
  permisos = SUPERVISOR,
  user = SUPERVISORA,
  sinEntregar = [pago()] as unknown[],
  impiden = IMPIDE
}: { permisos?: CallerPermissions; user?: AuthUser; sinEntregar?: unknown[]; impiden?: typeof IMPIDE } = {}) {
  abrirSesion(user)
  rutas = [
    { method: 'GET', path: '/caja/turnos/del-dia', body: DEL_DIA },
    { method: 'GET', path: `/caja/turnos/${T1}/arqueo`, body: arqueo(impiden) },
    { method: 'GET', path: '/caja/pagos/sin-entregar', body: sinEntregar },
    { method: 'POST', path: `/caja/pagos/${PAGO}/explicacion`, body: pago({ estado: 'EXPLICADO', explicacion: EXPLICACION }) },
    { method: 'POST', path: '/caja/turnos/cierre', status: 409, body: problema(409, 'Hay pagos sin entregar') },
    ...rutasDeSesion(user, permisos)
  ]
  window.history.pushState({}, '', '/cierre-caja')
  fetch = mockFetch(rutas)
  render(<PortalApp />)
}

const main = () => within(screen.getByRole('main'))
const texto = (element: Element | null) => (element?.textContent ?? '').replace(/\s/g, ' ').replace(/ +/g, ' ').trim()
const llamadas = (method: string, path: string) => fetch!.calls.filter((c) => c.method === method && c.path.split('?')[0] === path)
const celdas = (tr: Element) => [...tr.querySelectorAll('th, td')].map((celda) => texto(celda))
const elBloque = async () => within(await screen.findByRole('region', { name: 'Pagos sin entregar' }))
const tabla = () => main().findByRole('table', { name: 'Pagos sin entregar' })
const filas = async () =>
  within(await tabla())
    .getAllByRole('row')
    .map((tr) => celdas(tr))
const botonExplicar = (id = PAGO) => main().findByRole('button', { name: `Explicar el pago ${id}` })
const elActo = (id = PAGO) => within(screen.getByRole('region', { name: `Explicar el pago ${id}` }))

async function escribir(campo: HTMLElement, valor: string) {
  await userEvent.clear(campo)
  if (valor) await userEvent.type(campo, valor)
}

async function abrirYLlenar({ explicacion = EXPLICACION, observacion = OBSERVACION } = {}) {
  await waitFor(async () => expect(await botonExplicar()).toBeEnabled())
  await userEvent.click(await botonExplicar())
  await escribir(elActo().getByRole('textbox', { name: 'Explicación' }), explicacion)
  await escribir(elActo().getByRole('textbox', { name: 'Observación' }), observacion)
  await userEvent.click(elActo().getByRole('button', { name: 'Registrar la explicación' }))
}

async function confirmar() {
  const dialogo = await screen.findByRole('dialog', { name: 'Confirmar la explicación' })
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Explicar' }))
}

describe('Pagos sin entregar: the list', () => {
  it('lists each payment with its kind, destination, recibo, attempts, last error, when it was charged (in Lima) and its state', async () => {
    start({ sinEntregar: [pago(), OTRO_PAGO] })
    expect(await filas()).toEqual([
      ['Pago', 'Turno', 'Tipo', 'Destino', 'Recibo', 'Intentos', 'Último error', 'Creado', 'Estado', 'Explicar'],
      [
        PAGO,
        'C-01 del 02/10/2026 (el que va a cerrar)',
        'Pago registrado',
        'rentas',
        '001-0000001',
        '8',
        ERROR,
        '02/10/2026 10:15 (hora de Lima)',
        'No se pudo entregar',
        'Explicar'
      ],
      [
        OTRO,
        T_AJENO,
        'Pago anulado',
        'licencias',
        '— el recibo no se pudo leer',
        '12',
        '— el backend no registró ningún error',
        '02/10/2026 11:40 (hora de Lima)',
        'No se pudo entregar',
        'Explicar'
      ]
    ])
    expect(llamadas('GET', '/caja/pagos/sin-entregar').map((c) => c.path)).toEqual(['/caja/pagos/sin-entregar'])
  })

  it('puts the payments of the turno being closed first, and keeps the backend’s order otherwise', async () => {
    const TERCERO = '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918'
    // the backend gives them oldest first: the turno's own payment is the last one
    start({ sinEntregar: [OTRO_PAGO, pago({ pago_id: TERCERO, turno_id: null }), pago()] })
    const enOrden = (await filas()).slice(1).map(([id, turno]) => [id, turno])
    expect(enOrden).toEqual([
      [PAGO, 'C-01 del 02/10/2026 (el que va a cerrar)'],
      [OTRO, T_AJENO],
      [TERCERO, '— el backend no mandó su turno']
    ])
  })

  it('says it when there are none', async () => {
    start({ sinEntregar: [], impiden: [] })
    expect(await (await elBloque()).findByText('No hay pagos sin entregar')).toBeInTheDocument()
    expect(main().queryByRole('table', { name: 'Pagos sin entregar' })).not.toBeInTheDocument()
  })

  it('says a 403 in its slot, and the rest of the leaf stays', async () => {
    start({ permisos: CAJERO, user: CAJERA })
    const detail = 'Ver los pagos sin entregar exige permiso de lectura sobre pago_evento: la lista dice qué pagos y de qué recibos'
    Object.assign(rutaDe('GET', '/caja/pagos/sin-entregar'), { status: 403, body: problema(403, detail) })
    expect(await (await elBloque()).findByRole('alert')).toHaveTextContent(`No se pudieron leer los pagos sin entregar: ${detail}`)
    expect(await main().findByRole('table', { name: 'Arqueo' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cerrar el turno' })).toBeInTheDocument()
  })
})

describe('Pagos sin entregar: explicar', () => {
  it('asks for the explanation and the observation, confirms, sends them, and reads the payments and the arqueo again', async () => {
    start()
    await abrirYLlenar()

    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar la explicación' })
    expect(texto(dialogo)).toContain(`Se explica el pago ${PAGO}: Pago registrado a rentas, del recibo 001-0000001.`)
    expect(texto(dialogo)).toContain(`Explicación: ${EXPLICACION}`)
    expect(texto(dialogo)).toContain('No se deshace')
    expect(llamadas('POST', `/caja/pagos/${PAGO}/explicacion`)).toHaveLength(0)

    // what the backend says once it is explained: the payment is no longer listed, and the turno may close
    rutaDe('GET', '/caja/pagos/sin-entregar').body = []
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo([])
    await confirmar()

    expect(await (await elBloque()).findByText(`Se explicó el pago ${PAGO}: el backend lo dejó «Explicado».`)).toBeInTheDocument()
    expect(llamadas('POST', `/caja/pagos/${PAGO}/explicacion`)[0].body).toEqual({ explicacion: EXPLICACION, observacion: OBSERVACION })
    await waitFor(() => expect(llamadas('GET', '/caja/pagos/sin-entregar')).toHaveLength(2))
    await waitFor(() => expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(2))
    expect(await (await elBloque()).findByText('No hay pagos sin entregar')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: `Explicar el pago ${PAGO}` })).not.toBeInTheDocument()
    // the cierre goes because the arqueo read again says so
    await waitFor(async () => expect(await main().findByRole('button', { name: 'Cerrar el turno' })).toBeEnabled())
  })

  it('never changes the state here: if the backend still lists it when read again, so does the screen', async () => {
    start()
    await abrirYLlenar()
    await confirmar()
    await (await elBloque()).findByText(`Se explicó el pago ${PAGO}: el backend lo dejó «Explicado».`)
    await waitFor(() => expect(llamadas('GET', '/caja/pagos/sin-entregar')).toHaveLength(2))
    await waitFor(() => expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(2))
    expect((await filas())[1]).toContain('No se pudo entregar')
    expect(await main().findByRole('button', { name: 'Cerrar el turno' })).toBeDisabled()
  })

  it('asks for an explanation and an observation of 5 to 500 characters, and sends nothing', async () => {
    start()
    await abrirYLlenar({ explicacion: '   no ', observacion: 'no' })
    expect(await elActo().findByText('Diga qué pasó con el pago y qué se hizo: de 5 a 500 caracteres.')).toBeInTheDocument()
    expect(elActo().getByRole('textbox', { name: 'Explicación' })).toHaveAccessibleDescription(
      'Diga qué pasó con el pago y qué se hizo: de 5 a 500 caracteres.'
    )
    expect(elActo().getByRole('textbox', { name: 'Observación' })).toHaveAccessibleDescription('Explique por qué se registra: de 5 a 500 caracteres.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(llamadas('POST', `/caja/pagos/${PAGO}/explicacion`)).toHaveLength(0)
  })

  it('says a 400 under its field, and one of another field above the button', async () => {
    start()
    Object.assign(rutaDe('POST', `/caja/pagos/${PAGO}/explicacion`), {
      status: 400,
      body: problema(400, 'La explicación no es válida', [
        { field: 'explicacion', message: 'qué pasó con el pago y qué se hizo: al menos 5 caracteres que no sean espacios' },
        { field: 'observacion', message: 'a lo sumo 500 caracteres' },
        { field: 'pago_id', message: 'el pago_id de GET /api/caja/pagos/sin-entregar' }
      ])
    })
    await abrirYLlenar()
    await confirmar()
    expect(await elActo().findByText('qué pasó con el pago y qué se hizo: al menos 5 caracteres que no sean espacios')).toBeInTheDocument()
    expect(elActo().getByRole('textbox', { name: 'Explicación' })).toHaveAccessibleDescription(
      'qué pasó con el pago y qué se hizo: al menos 5 caracteres que no sean espacios'
    )
    expect(elActo().getByRole('textbox', { name: 'Observación' })).toHaveAccessibleDescription('a lo sumo 500 caracteres')
    expect(elActo().getByRole('alert')).toHaveTextContent('Pago: el pago_id de GET /api/caja/pagos/sin-entregar')
  })

  it('says a 409 with its detail, and reads the payments and the arqueo again', async () => {
    start()
    const detail = `Solo se explica un pago MUERTO, y el ${PAGO} está EXPLICADO: alguien ya se hizo cargo de él`
    Object.assign(rutaDe('POST', `/caja/pagos/${PAGO}/explicacion`), { status: 409, body: problema(409, detail) })
    await abrirYLlenar()
    // someone else explained it meanwhile: read again, the payment is no longer listed
    rutaDe('GET', '/caja/pagos/sin-entregar').body = []
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo([])
    await confirmar()
    await waitFor(() => expect(llamadas('GET', '/caja/pagos/sin-entregar')).toHaveLength(2))
    await waitFor(() => expect(llamadas('GET', `/caja/turnos/${T1}/arqueo`)).toHaveLength(2))
    const bloque = await elBloque()
    expect(await bloque.findByText('No hay pagos sin entregar')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: `Explicar el pago ${PAGO}` })).not.toBeInTheDocument()
    // the refusal survives the re-read that took the payment away
    expect(bloque.getByRole('alert')).toHaveTextContent(`No se explicó el pago ${PAGO}: ${detail}`)
  })

  it.each([
    [403, 'Explicar un pago sin entregar exige permiso de edición sobre pago_evento: lo pasa de MUERTO a EXPLICADO, y eso deja cerrar su turno'],
    [404, `No hay ningún pago ${PAGO}`]
  ])('says a %i with its detail', async (status, detail) => {
    start()
    Object.assign(rutaDe('POST', `/caja/pagos/${PAGO}/explicacion`), { status, body: problema(status, detail) })
    await abrirYLlenar()
    await confirmar()
    expect(await elActo().findByRole('alert')).toHaveTextContent(detail)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('never cuts a longer explanation: it counts it, and says why it cannot be sent over 500', async () => {
    start()
    await waitFor(async () => expect(await botonExplicar()).toBeEnabled())
    await userEvent.click(await botonExplicar())
    const campo = elActo().getByRole('textbox', { name: 'Explicación' })
    expect(campo).not.toHaveAttribute('maxLength')
    expect(elActo().getByText('0 de 500 caracteres')).toBeInTheDocument()
    await userEvent.click(campo)
    await userEvent.paste('x'.repeat(501))
    expect(campo).toHaveValue('x'.repeat(501))
    expect(elActo().getByText('501 de 500 caracteres')).toBeInTheDocument()
    await escribir(elActo().getByRole('textbox', { name: 'Observación' }), OBSERVACION)
    await userEvent.click(elActo().getByRole('button', { name: 'Registrar la explicación' }))
    const mensaje = 'La explicación tiene 501 caracteres y el máximo es 500: acórtela para poder enviarla.'
    expect(await elActo().findByText(mensaje)).toBeInTheDocument()
    expect(campo).toHaveAccessibleDescription(mensaje)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(llamadas('POST', `/caja/pagos/${PAGO}/explicacion`)).toHaveLength(0)
  })

  it('cancelling closes the act and forgets what was typed', async () => {
    start()
    await waitFor(async () => expect(await botonExplicar()).toBeEnabled())
    await userEvent.click(await botonExplicar())
    await escribir(elActo().getByRole('textbox', { name: 'Explicación' }), EXPLICACION)
    await userEvent.click(elActo().getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('region', { name: `Explicar el pago ${PAGO}` })).not.toBeInTheDocument()
    await userEvent.click(await botonExplicar())
    expect(elActo().getByRole('textbox', { name: 'Explicación' })).toHaveValue('')
  })

  it('keeps the draft of a 401 by the payment, and gives it back to that payment and not another', async () => {
    start({ sinEntregar: [pago(), OTRO_PAGO] })
    Object.assign(rutaDe('POST', `/caja/pagos/${PAGO}/explicacion`), { status: 401, body: { title: 'Unauthorized', status: 401 } })
    await abrirYLlenar()
    await confirmar()

    await screen.findByLabelText('Contraseña')
    expect(JSON.parse(sessionStorage.getItem(`caja.borrador.explicacion.${PAGO}`) ?? 'null')).toEqual({
      cuenta: SUPERVISORA.id,
      campos: { explicacion: EXPLICACION, observacion: OBSERVACION }
    })

    rutas.unshift({ method: 'POST', path: '/auth/login', body: { token: 'nuevo', expiresAt: '2026-12-31T00:00:00Z', user: SUPERVISORA } })
    await volverAEntrar(SUPERVISORA)

    // the act of that payment opens filled in
    await waitFor(() => expect(elActo().getByRole('textbox', { name: 'Explicación' })).toHaveValue(EXPLICACION))
    expect(elActo().getByRole('textbox', { name: 'Observación' })).toHaveValue(OBSERVACION)
    expect(elActo().getByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).toBeInTheDocument()

    // the other payment's act is its own, empty
    await userEvent.click(await botonExplicar(OTRO))
    expect(elActo(OTRO).getByRole('textbox', { name: 'Explicación' })).toHaveValue('')
    expect(elActo(OTRO).queryByText('Se recuperó lo que escribiste antes de que caducara la sesión.')).not.toBeInTheDocument()
    expect(sessionStorage.getItem(`caja.borrador.explicacion.${PAGO}`)).not.toBeNull()
  })
})

describe('Pagos sin entregar: no mute button, each impediment says why', () => {
  it('«Explicar» without UPDATE on pago_evento (a cashier)', async () => {
    start({ permisos: CAJERO, user: CAJERA })
    const boton = await botonExplicar()
    expect(boton).toBeDisabled()
    expect(boton).toHaveAccessibleDescription(
      'Su cuenta no puede explicar pagos sin entregar: le falta modificación de pago_evento. Lo explica una cuenta con ese permiso, que tiene el rol SUPERVISOR_CAJA.'
    )
  })

  it('«Explicar» without READ on recibo', async () => {
    start({ permisos: { admin: false, objects: { ...SUPERVISOR.objects, recibo: [] } } })
    const boton = await botonExplicar()
    expect(boton).toBeDisabled()
    expect(boton).toHaveAccessibleDescription(
      'Su cuenta no puede explicar pagos sin entregar: le falta lectura de recibo. Lo explica una cuenta con ese permiso, que tiene el rol SUPERVISOR_CAJA.'
    )
  })

  it('«Explicar» on a payment that is not MUERTO', async () => {
    start({ sinEntregar: [pago({ estado: 'PENDIENTE' })] })
    const boton = await botonExplicar()
    expect(boton).toBeDisabled()
    expect(boton).toHaveAccessibleDescription(
      'Solo se explica un pago que no se pudo entregar, y este está «Pendiente de entrega»: todavía se está intentando entregar.'
    )
  })
})

describe('Pagos sin entregar: from the cierre', () => {
  it('a 409 «Hay pagos sin entregar» of the cierre leads to the block', async () => {
    // the arqueo did not list it yet when the screen read it: the 409 comes, and the arqueo read again does
    start({ permisos: { admin: false, objects: { ...SUPERVISOR.objects } }, impiden: [] })
    await waitFor(async () => expect(await main().findByRole('button', { name: 'Cerrar el turno' })).toBeEnabled())
    // the cierre is mounted again per turno: it is looked for once the turno is chosen
    const cierre = within(screen.getByRole('region', { name: 'Cerrar el turno' }))
    await escribir(cierre.getByRole('textbox', { name: 'Declarado en Efectivo' }), '187.40')
    await escribir(cierre.getByRole('textbox', { name: 'Observación' }), 'cierre del turno de la mañana')
    rutaDe('GET', `/caja/turnos/${T1}/arqueo`).body = arqueo(IMPIDE)
    await userEvent.click(await main().findByRole('button', { name: 'Cerrar el turno' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar el cierre' })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar el turno' }))

    const alerta = await cierre.findByRole('alert')
    expect(alerta).toHaveTextContent('Hay pagos sin entregar')
    const enlace = await within(alerta).findByRole('link', { name: 'Ir a los pagos sin entregar' })
    expect(enlace).toHaveAttribute('href', '#pagos-sin-entregar')
    await userEvent.click(enlace)
    expect(screen.getByRole('heading', { name: 'Pagos sin entregar' })).toHaveFocus()
  })
})
