import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { KitProvider, type DisplayProps } from '../KitProvider'
import { FieldGrid } from './FieldGrid'

// the read-only side of a ficha draws an app's own kind with what the app gives the kit (displayKinds): a value the
// kit cannot format itself (an object, a figure with its date) is the app's to draw

function Pair({ field, value, values }: DisplayProps) {
  const pair = value as { amount: string; asOf: string } | null
  return <span data-testid={field.name}>{pair ? `${pair.amount} as of ${pair.asOf} (${values.code})` : 'none'}</span>
}
const DISPLAYS = { pair: Pair }

const wrapper = ({ children }: { children: ReactNode }) => <KitProvider displayKinds={DISPLAYS}>{children}</KitProvider>

const SECTIONS = [
  {
    id: 's',
    title: 'Record',
    fields: [
      { name: 'code', label: 'Code' },
      { name: 'price', label: 'Price', kind: 'pair' },
      { name: 'missing', label: 'Missing', kind: 'pair' }
    ]
  }
]

describe('FieldGrid', () => {
  it("draws a kind the app registered with the app's renderer, with the field, its value and the values", () => {
    render(<FieldGrid sections={SECTIONS} values={{ code: 'A-1', price: { amount: '12.30', asOf: '2026-10-02' }, missing: null }} />, { wrapper })
    expect(screen.getByTestId('price')).toHaveTextContent('12.30 as of 2026-10-02 (A-1)')
    expect(screen.getByTestId('missing')).toHaveTextContent('none')
    expect(screen.getByText('A-1')).toBeInTheDocument()
  })

  it('draws the core kinds as before when the app registers none', () => {
    render(<FieldGrid sections={[{ id: 's', title: 'Record', fields: [{ name: 'when', label: 'When', kind: 'date' }] }]} values={{ when: '2026-10-02' }} />)
    expect(screen.getByText('02/10/2026')).toBeInTheDocument()
  })
})
