// copiado de srtm-ui@a1df33a (src/portal/components/Alerta.test.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Alerta } from './Alerta'

describe('Alerta', () => {
  it('is an alert when it is an error, a status otherwise', () => {
    render(
      <>
        <Alerta tono="error">No se pudo guardar</Alerta>
        <Alerta tono="exito">Guardado</Alerta>
        <Alerta tono="atencion">Revise los datos</Alerta>
        <Alerta tono="aviso">Recuerde cerrar el día</Alerta>
      </>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar')
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual(['Guardado', 'Revise los datos', 'Recuerde cerrar el día'])
  })

  it('carries the hooks a theme paints its box by', () => {
    render(<Alerta tono="atencion">Revise los datos</Alerta>)
    const alerta = screen.getByRole('status')
    expect(alerta).toHaveAttribute('data-ui', 'alerta')
    expect(alerta).toHaveAttribute('data-tono', 'atencion')
  })

  it('opens with its title in bold', () => {
    render(
      <Alerta tono="atencion" titulo="Atención.">
        Revise los datos
      </Alerta>
    )
    expect(screen.getByRole('status')).toHaveTextContent('Atención. Revise los datos')
    expect(screen.getByText('Atención.').tagName).toBe('STRONG')
  })

  it('closes from its accessible button', async () => {
    const onCerrar = vi.fn()
    render(
      <Alerta tono="aviso" titulo="Atención," onCerrar={onCerrar}>
        recuerde cerrar el día
      </Alerta>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Entendido, cerrar el aviso' }))
    expect(onCerrar).toHaveBeenCalledOnce()
  })

  it('has no close button unless it can close', () => {
    render(<Alerta tono="error">No se pudo guardar</Alerta>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  // light and dark: the text in the tone's colour, and whatever look the place gives it (a box, a margin)
  it('keeps the classic look: text in the tone, plus the classes the place passes', () => {
    render(
      <Alerta tono="error" className="rounded-md bg-danger/10 px-3 py-2">
        No se pudo guardar
      </Alerta>
    )
    expect(screen.getByRole('alert')).toHaveClass('text-sm', 'text-danger', 'rounded-md', 'bg-danger/10', 'px-3', 'py-2')
  })
})
