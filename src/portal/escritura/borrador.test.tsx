import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { useState, type ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordForm } from '../../kit/forms/RecordForm'
import { abrirSesion, CAJERA, rutasDeSesion } from '../../test/portal'
import { client } from '../api'
import { PortalApp } from '../PortalApp'
import { borrarBorrador, guardarBorrador, leerBorrador, olvidarLosBorradores } from './borrador'
import { AvisoDeBorrador, useEscritura } from './useEscritura'

// a 401 on a write asks to sign in again and keeps what the clerk typed (caja ADR-0044 §Decisión·4): in this browser
// tab only, with the account that typed it, never the token nor what the backend answered

const OTRA: AuthUser = { id: 'u-otra', email: 'otra@caja.test', displayName: 'Otra cajera', organizationId: 'o1', roles: ['CAJERO'] }
const TOKEN = 'token-secreto-de-la-cajera'
const ESCRITURA = '/caja/cobros/001-000123/anulacion'
const RECHAZO = 'Unauthorized: el token venció'

// --- the storage, alone ---

describe('borrador', () => {
  beforeEach(() => sessionStorage.clear())

  it('keeps the fields under caja.borrador.<acto>, with the account', () => {
    guardarBorrador('anulacion', 'u1', { motivo: 'ERROR DE DIGITACION' })
    expect(JSON.parse(sessionStorage.getItem('caja.borrador.anulacion') ?? 'null')).toEqual({ cuenta: 'u1', campos: { motivo: 'ERROR DE DIGITACION' } })
    expect(leerBorrador('anulacion', 'u1')).toEqual({ motivo: 'ERROR DE DIGITACION' })
  })

  it("gives another account nothing, and drops the first one's", () => {
    guardarBorrador('anulacion', 'u1', { motivo: 'X' })
    expect(leerBorrador('anulacion', 'u2')).toBeNull()
    expect(sessionStorage.getItem('caja.borrador.anulacion')).toBeNull()
    expect(leerBorrador('anulacion', 'u1')).toBeNull()
  })

  it('reads nothing from what does not look like a draft, and keeps only text fields', () => {
    sessionStorage.setItem('caja.borrador.anulacion', '{no es json')
    expect(leerBorrador('anulacion', 'u1')).toBeNull()
    sessionStorage.setItem('caja.borrador.anulacion', JSON.stringify({ cuenta: 'u1', campos: 'x' }))
    expect(leerBorrador('anulacion', 'u1')).toBeNull()
    sessionStorage.setItem('caja.borrador.anulacion', JSON.stringify({ cuenta: 'u1', campos: { motivo: 'X', total: 5, token: { a: 1 } } }))
    expect(leerBorrador('anulacion', 'u1')).toEqual({ motivo: 'X' })
  })

  it('forgets one act, or every draft and nothing else of the tab', () => {
    guardarBorrador('anulacion', 'u1', { motivo: 'X' })
    guardarBorrador('cierre', 'u1', { nota: 'Y' })
    sessionStorage.setItem('caja.tabs', '[]')
    borrarBorrador('anulacion')
    expect(sessionStorage.getItem('caja.borrador.anulacion')).toBeNull()
    expect(sessionStorage.getItem('caja.borrador.cierre')).not.toBeNull()
    olvidarLosBorradores()
    expect(sessionStorage.getItem('caja.borrador.cierre')).toBeNull()
    expect(sessionStorage.getItem('caja.tabs')).toBe('[]')
  })

  // a private window or a blocked storage throws: then there is no draft, and the act goes on
  it('never throws when the browser will not store', () => {
    const roto = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const leer = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => guardarBorrador('anulacion', 'u1', { motivo: 'X' })).not.toThrow()
    expect(leerBorrador('anulacion', 'u1')).toBeNull()
    roto.mockRestore()
    leer.mockRestore()
  })
})

// --- an act of the portal that writes ---

const registradas = vi.hoisted(() => ({}) as Record<string, ComponentType>)
vi.mock('../pantallas', () => ({ PANTALLAS: registradas }))

// the act of the test: the backend's receipt around what the clerk types (motivo, observacion)
function Anular() {
  const { borrador, escribir, cancelar } = useEscritura('anulacion', ['motivo', 'observacion'])
  const [hecho, setHecho] = useState(false)
  if (hecho) return <p>Anulado</p>
  return (
    <>
      {borrador && <AvisoDeBorrador />}
      <RecordForm
        sections={[
          {
            id: 'acto',
            title: 'Anulación',
            fields: [
              { name: 'motivo', label: 'Motivo', required: true },
              { name: 'observacion', label: 'Observación', kind: 'longtext' }
            ]
          }
        ]}
        // what the backend sent of the receipt rides in the values too: it must not reach the draft
        initial={{ numero: '001-000123', total: '50.00', detalle: RECHAZO, motivo: '', observacion: '', ...borrador }}
        submitLabel="Anular"
        onSubmit={(valores) =>
          escribir(valores, async () => {
            await client.request(ESCRITURA, { method: 'POST', body: JSON.stringify(valores) })
            setHecho(true)
          })
        }
        onCancel={cancelar}
      />
    </>
  )
}

let fetch: FetchMock | null = null
let rutas: MockRoute[] = []
const escritura: MockRoute = { method: 'POST', path: ESCRITURA }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  registradas['duplicado-recibo'] = Anular
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const login = (user: AuthUser): MockRoute => ({ method: 'POST', path: '/auth/login', body: { token: 'nuevo', expiresAt: '2026-12-31T00:00:00Z', user } })

function start(path = '/duplicado-recibo?desde=lista') {
  abrirSesion(CAJERA)
  localStorage.setItem('caja.token', TOKEN)
  escritura.status = 401
  escritura.body = { title: 'Unauthorized', status: 401, detail: RECHAZO }
  rutas = [escritura, ...rutasDeSesion(CAJERA, { admin: true, objects: {} })]
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  render(<PortalApp />)
}

async function teclearYAnular() {
  await userEvent.type(await screen.findByRole('textbox', { name: /^Motivo/ }), 'ERROR DE DIGITACION')
  await userEvent.type(screen.getByRole('textbox', { name: 'Observación' }), 'Lo pidió la persona')
  await userEvent.click(screen.getByRole('button', { name: 'Anular' }))
}

// signs in again as `user`, the write now answering 200
async function volverAEntrar(user: AuthUser) {
  rutas.unshift(login(user), ...rutasDeSesion(user, { admin: true, objects: {} }))
  escritura.status = 200
  await userEvent.type(screen.getByLabelText('Correo'), user.email)
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta')
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

const guardado = () => sessionStorage.getItem('caja.borrador.anulacion')

describe('useEscritura: a 401 on a write', () => {
  it('keeps only what was typed, with the account, and never the token nor what the backend answered', async () => {
    start()
    await teclearYAnular()
    await screen.findByLabelText('Contraseña')

    expect(JSON.parse(guardado() ?? 'null')).toEqual({
      cuenta: CAJERA.id,
      campos: { motivo: 'ERROR DE DIGITACION', observacion: 'Lo pidió la persona' }
    })
    const todo = JSON.stringify({ ...sessionStorage })
    expect(todo).not.toContain(TOKEN)
    expect(todo).not.toContain(RECHAZO)
    expect(todo).not.toContain('001-000123')
    expect(todo).not.toContain('50.00')
  })

  it('says the session expired and leads to the login, with next back to where the clerk was', async () => {
    start()
    await teclearYAnular()
    expect(await screen.findByRole('status')).toHaveTextContent('La sesión caducó: vuelve a entrar. Lo que escribiste quedó guardado.')
    expect(window.location.pathname).toBe('/login')
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/duplicado-recibo?desde=lista')
  })

  it('offers the draft to the same account, filling the act in', async () => {
    start()
    await teclearYAnular()
    await screen.findByLabelText('Contraseña')
    await volverAEntrar(CAJERA)

    expect(await screen.findByRole('textbox', { name: /^Motivo/ })).toHaveValue('ERROR DE DIGITACION')
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveValue('Lo pidió la persona')
    expect(window.location.pathname + window.location.search).toBe('/duplicado-recibo?desde=lista')
    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent('Se recuperó lo que escribiste antes de que caducara la sesión.')
  })

  it('drops it for another account', async () => {
    start()
    await teclearYAnular()
    await screen.findByLabelText('Contraseña')
    await volverAEntrar(OTRA)

    expect(await screen.findByRole('textbox', { name: /^Motivo/ })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveValue('')
    expect(screen.queryByText(/Se recuperó/)).not.toBeInTheDocument()
    expect(guardado()).toBeNull()
  })

  it('forgets it once the write goes through', async () => {
    start()
    await teclearYAnular()
    await screen.findByLabelText('Contraseña')
    await volverAEntrar(CAJERA)
    await userEvent.click(await screen.findByRole('button', { name: 'Anular' }))

    expect(await screen.findByText('Anulado')).toBeInTheDocument()
    expect(guardado()).toBeNull()
    const post = fetch!.calls.filter((call) => call.method === 'POST' && call.path === ESCRITURA).at(-1)
    expect(post?.body).toEqual(expect.objectContaining({ motivo: 'ERROR DE DIGITACION', observacion: 'Lo pidió la persona' }))
  })

  it('forgets it when the act is cancelled', async () => {
    guardarBorrador('anulacion', CAJERA.id, { motivo: 'X' })
    start()
    expect(await screen.findByRole('textbox', { name: /^Motivo/ })).toHaveValue('X')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(guardado()).toBeNull()
  })

  it('forgets every draft when the session is closed', async () => {
    guardarBorrador('anulacion', CAJERA.id, { motivo: 'X' })
    guardarBorrador('cierre', CAJERA.id, { nota: 'Y' })
    localStorage.setItem('caja.theme', 'portal-tributario')
    start()
    await userEvent.click(await within(await screen.findByRole('banner')).findByRole('button', { name: /menú de sesión/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument()
    expect(guardado()).toBeNull()
    expect(sessionStorage.getItem('caja.borrador.cierre')).toBeNull()
    // nothing kept, so the login does not say anything was
    expect(screen.queryByText(/La sesión caducó/)).not.toBeInTheDocument()
  })

  it('leaves any other failure to the act, keeping no draft', async () => {
    start()
    escritura.status = 503
    escritura.body = { title: 'Service Unavailable', status: 503, detail: 'El backend no contesta' }
    await teclearYAnular()
    expect(await screen.findByRole('alert')).toHaveTextContent('El backend no contesta')
    expect(guardado()).toBeNull()
    expect(window.location.pathname).toBe('/duplicado-recibo')
  })
})
