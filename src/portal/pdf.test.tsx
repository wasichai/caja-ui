import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@wasichai/core'
import { mockFetch, renderWithProviders, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blob } from './api'
import { PdfDialog } from './components/PdfDialog'

// the recibo in PDF: client.request only reads JSON, so blob fetches the file itself, with the session's token, and
// PdfDialog shows it embedded to print or download

const original = globalThis.fetch
let fetch: FetchMock | null = null

const RUTA = '/caja/recibos/001-0000001/pdf'

// a PDF answer as caja-backend gives it: inline, with its name
function pdf(filename = 'recibo-001-0000001.pdf') {
  const stub = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      // a string body: jsdom's Blob is not the one fetch's Response reads
      new Response('%PDF-1.7', {
        status: 200,
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` }
      })
  )
  globalThis.fetch = stub as typeof globalThis.fetch
  return stub
}

// jsdom has no object urls
const createObjectURL = vi.fn((_blob: Blob) => 'blob:pdf-1')
const revokeObjectURL = vi.fn((_url: string) => undefined)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('caja.token', 'jwt-1')
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  globalThis.fetch = original
})

describe('blob', () => {
  it("sends the session's token and takes the file name from Content-Disposition", async () => {
    const stub = pdf()
    const archivo = await blob(RUTA)
    expect(stub).toHaveBeenCalledTimes(1)
    const [url, init] = stub.mock.calls[0]
    expect(url).toBe('/api/caja/recibos/001-0000001/pdf')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt-1')
    expect(archivo.filename).toBe('recibo-001-0000001.pdf')
    expect(await archivo.blob.text()).toBe('%PDF-1.7')
  })

  it('reads an RFC 5987 file name too, and names it by its path without one', async () => {
    globalThis.fetch = (async () =>
      new Response('%PDF', { headers: { 'Content-Disposition': "inline; filename*=UTF-8''recibo-001-0000002.pdf" } })) as typeof globalThis.fetch
    expect((await blob('/caja/recibos/001-0000002/pdf')).filename).toBe('recibo-001-0000002.pdf')
    globalThis.fetch = (async () => new Response('%PDF')) as typeof globalThis.fetch
    expect((await blob('/caja/recibos/001-0000002/pdf')).filename).toBe('caja-recibos-001-0000002-pdf')
  })

  it('turns a problem+json into an ApiError with its detail', async () => {
    fetch = mockFetch([{ path: RUTA, status: 409, body: { title: 'Conflict', detail: 'Pida un duplicado' } }])
    const error = await blob(RUTA).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, message: 'Pida un duplicado' })
  })

  it('signs out on a 401, as the client does', async () => {
    fetch = mockFetch([{ path: RUTA, status: 401, body: { title: 'Unauthorized' } }])
    const error = await blob(RUTA).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 401 })
    expect(localStorage.getItem('caja.token')).toBeNull()
  })
})

describe('PdfDialog', () => {
  const titulo = 'Recibo 001-0000001'

  it('embeds the PDF from a blob url, to download with its name', async () => {
    pdf()
    renderWithProviders(<PdfDialog path={RUTA} titulo={titulo} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: titulo })).toBeInTheDocument()
    const iframe = await screen.findByTitle(titulo)
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe).toHaveAttribute('src', 'blob:pdf-1')
    expect(await screen.findByRole('link', { name: 'Descargar' })).toHaveAttribute('download', 'recibo-001-0000001.pdf')
  })

  it('revokes the url when it is closed', async () => {
    pdf()
    const onClose = vi.fn()
    renderWithProviders(<PdfDialog path={RUTA} titulo={titulo} onClose={onClose} />)
    await screen.findByTitle(titulo)
    await userEvent.click(screen.getByText('Cerrar', { selector: 'button' }))
    expect(onClose).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1')
  })

  it("shows the error's detail, and what the screen says of its status", async () => {
    fetch = mockFetch([{ path: RUTA, status: 409, body: { title: 'Conflict', detail: 'Solo el cajero que lo emitió, el mismo día' } }])
    renderWithProviders(
      <PdfDialog path={RUTA} titulo={titulo} onClose={() => undefined} explicar={(e) => (e.status === 409 ? 'El original ya no se puede pedir' : null)} />
    )
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('El original ya no se puede pedir')
    expect(alerta).toHaveTextContent('Solo el cajero que lo emitió, el mismo día')
    expect(screen.queryByTitle(titulo)).not.toBeInTheDocument()
  })
})
