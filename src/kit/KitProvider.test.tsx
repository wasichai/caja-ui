// copiado de srtm-ui@a1df33a (src/kit/KitProvider.test.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { KitProvider, useKit } from './KitProvider'
import { DEFAULT_TEXTS } from './texts'

describe('KitProvider', () => {
  it('returns DEFAULT_TEXTS and identity enumLabel when no provider', () => {
    const { result } = renderHook(() => useKit())
    expect(result.current.texts).toEqual(DEFAULT_TEXTS)
    expect(result.current.enumLabel('any', 'value')).toBe('value')
  })

  it('merges partial texts and keeps defaults', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <KitProvider texts={{ select: 'ELEGIR' }}>{children}</KitProvider>
    const { result } = renderHook(() => useKit(), { wrapper })
    expect(result.current.texts.select).toBe('ELEGIR')
    expect(result.current.texts.required).toBe(DEFAULT_TEXTS.required)
    expect(result.current.texts.cancel).toBe(DEFAULT_TEXTS.cancel)
  })

  it('applies custom enumLabel', () => {
    const customLabel = (_f: string, v: string) => v + '!'
    const wrapper = ({ children }: { children: ReactNode }) => <KitProvider enumLabel={customLabel}>{children}</KitProvider>
    const { result } = renderHook(() => useKit(), { wrapper })
    expect(result.current.enumLabel('x', 'A')).toBe('A!')
  })

  it('draws the form-level error as a red alert paragraph by default', () => {
    const { result } = renderHook(() => useKit())
    render(<>{result.current.renderAlert('Could not save')}</>)
    const alert = screen.getByRole('alert')
    expect(alert.tagName).toBe('P')
    expect(alert).toHaveClass('text-sm', 'text-danger')
    expect(alert).toHaveTextContent('Could not save')
  })

  it('draws the form-level error with the renderAlert it is given', () => {
    const box = (message: string) => <div role="status">Error: {message}</div>
    const wrapper = ({ children }: { children: ReactNode }) => <KitProvider renderAlert={box}>{children}</KitProvider>
    const { result } = renderHook(() => useKit(), { wrapper })
    render(<>{result.current.renderAlert('Could not save')}</>)
    expect(screen.getByRole('status')).toHaveTextContent('Error: Could not save')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
