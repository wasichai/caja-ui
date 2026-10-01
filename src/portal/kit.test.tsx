import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordForm } from '../kit/forms/RecordForm'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// the kit inside the portal: PortalApp wraps every screen in KitDelPortal, so the kit's forms write caja's options
// with their labels (forms/etiquetas.ts) and say a form's error in the portal's Alerta
const registradas = vi.hoisted(() => ({}) as Record<string, ComponentType>)
vi.mock('./pantallas', () => ({ PANTALLAS: registradas }))

function Pago() {
  return (
    <RecordForm
      sections={[{ id: 'pago', title: 'Pago', fields: [{ name: 'forma_pago', label: 'Forma de pago', kind: 'enum', required: true }] }]}
      options={{ forma_pago: ['EFECTIVO', 'DEPOSITO'] }}
      initial={{ forma_pago: 'DEPOSITO' }}
      submitLabel="Registrar"
      onSubmit={async () => {
        throw new Error('El backend no contesta')
      }}
    />
  )
}

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  registradas['duplicado-recibo'] = Pago
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('KitDelPortal', () => {
  it("gives the kit's forms caja's labels and the portal's error box", async () => {
    abrirSesion(CAJERA)
    window.history.pushState({}, '', '/duplicado-recibo')
    fetch = mockFetch(rutasDeSesion(CAJERA, { admin: true, objects: {} }))
    render(<PortalApp />)

    const forma = await screen.findByRole('combobox', { name: /^Forma de pago/ })
    expect(
      within(forma)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['SELECCIONAR', 'Efectivo', 'Depósito'])

    await userEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('El backend no contesta')
    expect(alerta).toHaveAttribute('data-ui', 'alerta')
    expect(alerta).toHaveAttribute('data-tono', 'error')
  })
})
