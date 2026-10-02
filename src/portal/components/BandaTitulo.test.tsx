// copiado de srtm-ui@a1df33a (src/portal/components/BandaTitulo.test.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BandaTitulo, CabeceraBanda } from './BandaTitulo'

// the title band of the portal-tributario theme: the form's h1 on the brand, its kind before it on the same
// line, and an optional help button. no favourites: there is no backend for them

const banda = () => screen.getByRole('heading', { level: 1 }).closest('[data-ui="banda-titulo"]') as HTMLElement

describe('BandaTitulo', () => {
  it('draws the kind and the h1 on one line, on-brand over brand, the title in 18px bold', () => {
    render(<BandaTitulo kind="Recibo Nº 001-000123" title="DUPLICADO DE RECIBO" />)
    const h1 = screen.getByRole('heading', { level: 1, name: 'DUPLICADO DE RECIBO' })
    expect(banda()).toHaveClass('bg-brand', 'text-on-brand')
    expect(h1).toHaveClass('text-[18px]', 'font-bold')
    // one flex line: the kind first, then the title
    const linea = h1.parentElement!
    expect(linea).toHaveClass('flex')
    expect(linea.firstElementChild).toHaveTextContent('Recibo Nº 001-000123')
    expect(linea.firstElementChild?.nextElementSibling).toBe(h1)
  })

  it('shows a detail after the title', () => {
    render(<BandaTitulo title="Anulación" detalle="Anular recibo" />)
    expect(banda()).toHaveTextContent(/^AnulaciónAnular recibo$/)
  })

  it('has no button unless given a help: no favourites either', () => {
    render(<BandaTitulo kind="Recibo" title="001-000123" />)
    expect(within(banda()).queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers "?" as the help of the form, and calls it', async () => {
    const ayuda = vi.fn()
    render(<BandaTitulo kind="Recibo" title="001-000123" ayuda={ayuda} />)
    const boton = within(banda()).getByRole('button', { name: 'Ayuda de este formulario' })
    expect(boton).toHaveTextContent('?')
    expect(boton).toHaveAttribute('type', 'button')
    await userEvent.click(boton)
    expect(ayuda).toHaveBeenCalledOnce()
    expect(within(banda()).getAllByRole('button')).toHaveLength(1)
  })
})

describe('CabeceraBanda', () => {
  it('puts the badges on the left and the actions on the right, in a row under the band', () => {
    render(<CabeceraBanda kind="Recibo" title="001-000123" badges={<span>PAGADA</span>} aside={<button type="button">Anular</button>} />)
    const cabecera = banda().parentElement!
    expect(cabecera).toHaveAttribute('data-ui', 'cabecera-banda')
    const fila = banda().nextElementSibling as HTMLElement
    expect(fila).toHaveAttribute('data-ui', 'cabecera-fila')
    expect(fila.firstElementChild).toHaveTextContent('PAGADA')
    expect(fila.lastElementChild).toContainElement(within(fila).getByRole('button', { name: 'Anular' }))
    expect(within(banda()).queryByText('PAGADA')).not.toBeInTheDocument()
  })

  it('keeps the actions on the right without badges', () => {
    render(<CabeceraBanda title="Cierre del día" aside={<button type="button">Siguiente</button>} />)
    const fila = banda().nextElementSibling as HTMLElement
    expect(fila.lastElementChild).toHaveClass('ml-auto')
    expect(fila.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Siguiente' }))
  })

  it('draws the band alone when it has neither', () => {
    render(<CabeceraBanda kind="Tesorería" title="Conciliación" />)
    expect(banda().nextElementSibling).toBeNull()
  })
})
