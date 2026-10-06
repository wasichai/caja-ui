import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldGrid } from '../kit/forms/FieldGrid'
import { RecordForm } from '../kit/forms/RecordForm'
import { abrirSesion, CAJERA, rutasDeSesion } from '../test/portal'
import { PortalApp } from './PortalApp'

// the kit inside the portal: PortalApp wraps every screen in KitDelPortal, so the kit's forms write caja's options
// with their labels (forms/etiquetas.ts) and say a form's error in the portal's Alert
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
    expect(alerta).toHaveAttribute('data-slot', 'alert')
    expect(alerta).toHaveAttribute('data-tone', 'danger')
  })
})

// a ficha's amounts are Importe's (forms/importe.tsx): KitDelPortal gives the kit the kind importe, which draws the
// backend's figure with its date, and a missing one with its reason, never the kit's Number-based money
function Recibo() {
  return (
    <FieldGrid
      sections={[
        {
          id: 'recibo',
          title: 'Recibo',
          fields: [
            { name: 'total', label: 'Total', kind: 'importe' },
            { name: 'saldo', label: 'Saldo', kind: 'importe', placeholder: () => 'El turno no tiene arqueo declarado' },
            { name: 'vuelto', label: 'Vuelto', kind: 'importe' }
          ]
        }
      ]}
      values={{ total: { importe: '12345678901234567.89', actualizado_a: '2026-10-02' }, saldo: null, vuelto: null }}
    />
  )
}

describe('the kind importe of the portal', () => {
  it("draws a ficha's amount with Importe: its date, and the reason of a missing one", async () => {
    registradas['duplicado-recibo'] = Recibo
    abrirSesion(CAJERA)
    window.history.pushState({}, '', '/duplicado-recibo')
    fetch = mockFetch(rutasDeSesion(CAJERA, { admin: true, objects: {} }))
    render(<PortalApp />)

    const valor = async (rotulo: string) => ((await screen.findByText(rotulo)).nextElementSibling?.textContent ?? '').replace(/\s/g, ' ')
    expect(await valor('Total')).toBe('S/ 12,345,678,901,234,567.89 al 02/10/2026')
    expect(await valor('Saldo')).toBe('— El turno no tiene arqueo declarado')
    expect(await valor('Vuelto')).toBe('— El backend no mandó el importe')
  })
})
