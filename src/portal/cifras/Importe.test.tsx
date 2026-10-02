import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as cifras from './Importe'
import { FechaDeLasCifras, Importe, SinDato, type Cifra } from './Importe'

// every figure goes with its date, the client formats and never computes, and a missing one says why (never a 0).
// caja-backend sends each amount as { importe: '<decimal string>', actualizado_a: '<ISO date>' }

// what a reader sees: the spaces Intl puts (no-break ones) read as spaces
const texto = (element: Element) => (element.textContent ?? '').replace(/\s/g, ' ')
const importe = (cifra: Cifra) => {
  const { container } = render(<Importe cifra={cifra} />)
  return texto(container)
}

describe('Importe', () => {
  it('formats the amount in soles, as es-PE writes it, with its date', () => {
    expect(importe({ importe: '1234.5', actualizado_a: '2026-10-01' })).toBe('S/ 1,234.50 al 01/10/2026')
  })

  it('says the date the backend gave, as DD/MM/AAAA', () => {
    render(<Importe cifra={{ importe: '10', actualizado_a: '2026-10-01' }} />)
    expect(screen.getByText('al 01/10/2026')).toBeInTheDocument()
  })

  // a Number would round it: 12345678901234567.89 is not a double
  it('formats the string itself, so no cent is lost', () => {
    expect(importe({ importe: '12345678901234567.89', actualizado_a: '2026-10-01' })).toBe('S/ 12,345,678,901,234,567.89 al 01/10/2026')
  })

  it('formats a negative amount and keeps every digit the backend sent', () => {
    expect(importe({ importe: '-0.10', actualizado_a: '2026-10-01' })).toBe('-S/ 0.10 al 01/10/2026')
    expect(importe({ importe: '0.125', actualizado_a: '2026-10-01' })).toBe('S/ 0.13 al 01/10/2026')
  })

  // '0.10' + '0.20' is the backend's to add: the client has nothing to do it with
  it('has no way to add two amounts: it only draws each one', () => {
    expect(Object.keys(cifras).sort()).toEqual(['FechaDeLasCifras', 'Importe', 'SinDato'])
    render(
      <>
        <Importe cifra={{ importe: '0.10', actualizado_a: '2026-10-01' }} />
        <Importe cifra={{ importe: '0.20', actualizado_a: '2026-10-01' }} />
      </>
    )
    expect(screen.getAllByText(/^S\/\s0\.\d0$/).map(texto)).toEqual(['S/ 0.10', 'S/ 0.20'])
    expect(screen.queryByText(/0\.30/)).not.toBeInTheDocument()
  })

  it('says why, and draws no 0, when the amount is missing', () => {
    const { container } = render(<Importe cifra={{ importe: null, actualizado_a: null }} motivo="El turno no tiene arqueo declarado" />)
    expect(texto(container)).toBe('— El turno no tiene arqueo declarado')
    expect(container).not.toHaveTextContent(/\b0\b|S\//)
  })

  // the types demand the reason, but a null the backend sent where the types promised an amount comes without one:
  // then the generic reason, never a bare dash
  it('says the generic reason when a missing amount comes without one', () => {
    const sinMotivo = { importe: null, actualizado_a: null } as unknown as Cifra
    const { container, rerender } = render(<Importe cifra={sinMotivo} />)
    expect(texto(container)).toBe('— El backend no mandó el importe')
    rerender(<Importe cifra={{ importe: null, actualizado_a: null }} motivo="  " />)
    expect(texto(container)).toBe('— El backend no mandó el importe')
    expect(container).not.toHaveTextContent(/\b0\b|S\//)
  })

  it('says why when what the backend sent is no amount, instead of NaN or a 0', () => {
    const { container } = render(<Importe cifra={{ importe: 'doce', actualizado_a: '2026-10-01' }} />)
    expect(texto(container)).toBe('— El importe que mandó el backend no se entiende')
    expect(container).not.toHaveTextContent(/NaN|\b0\b|S\//)
  })

  it('demands the reason of a missing amount, by its types', () => {
    // @ts-expect-error a missing amount without a reason does not compile
    const sinMotivo = <Importe cifra={{ importe: null, actualizado_a: null }} />
    // one that may be missing (the backend's union) needs it too
    const quizas = { importe: null, actualizado_a: null } as Cifra | { importe: null; actualizado_a: string | null }
    // @ts-expect-error
    const quizasSinMotivo = <Importe cifra={quizas} />
    const conMotivo = <Importe cifra={quizas} motivo="Sin dato" />
    expect([sinMotivo, quizasSinMotivo, conMotivo]).toHaveLength(3)
  })
})

describe('SinDato', () => {
  it('draws a dash and the reason', () => {
    const { container } = render(<SinDato motivo="Nadie contó la caja" />)
    expect(texto(container)).toBe('— Nadie contó la caja')
    expect(container.firstElementChild).toHaveAttribute('data-ui', 'sin-dato')
  })
})

// in a table the date goes once, in the heading: a figure of that date drops its own, one of another date keeps it
describe('FechaDeLasCifras and the table variant', () => {
  it('says the date once in the heading, and the figures of that date go without it', () => {
    render(
      <table>
        <thead>
          <tr>
            <th>
              Importe <FechaDeLasCifras fecha="2026-10-01" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Importe cifra={{ importe: '0.10', actualizado_a: '2026-10-01' }} fechaDeLaTabla="2026-10-01" />
            </td>
          </tr>
          <tr>
            <td>
              <Importe cifra={{ importe: '0.20', actualizado_a: '2026-10-01' }} fechaDeLaTabla="2026-10-01" />
            </td>
          </tr>
        </tbody>
      </table>
    )
    expect(screen.getAllByText(/al \d\d\/\d\d\/\d{4}/).map(texto)).toEqual(['al 01/10/2026'])
    expect(texto(screen.getByRole('columnheader'))).toBe('Importe al 01/10/2026')
    expect(screen.getAllByRole('cell').map(texto)).toEqual(['S/ 0.10', 'S/ 0.20'])
  })

  it('keeps the date of a figure that is not of the table', () => {
    const { container } = render(<Importe cifra={{ importe: '5', actualizado_a: '2026-09-30' }} fechaDeLaTabla="2026-10-01" />)
    expect(texto(container)).toBe('S/ 5.00 al 30/09/2026')
  })
})
