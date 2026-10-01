// copiado de srtm-ui@a1df33a (src/kit/ui/UnsavedChanges.test.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@wasichai/testing'
import { describe, expect, it, vi } from 'vitest'
import { KitProvider } from '../KitProvider'
import { ConfirmDiscard } from './UnsavedChanges'

describe('ConfirmDiscard', () => {
  it('names what is pending, in the default words', async () => {
    const onKeep = vi.fn()
    const onConfirm = vi.fn()
    renderWithProviders(
      <ConfirmDiscard title="Discard?" pending={['A', 'B']} consequence="Gone." confirmLabel="Discard" onConfirm={onConfirm} onKeep={onKeep} />
    )
    const dialog = screen.getByRole('dialog', { name: 'Discard?' })
    expect(dialog).toHaveTextContent('Hay cambios sin guardar en A, B. Gone.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
    expect(onKeep).toHaveBeenCalledTimes(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('takes the words the app gives', () => {
    renderWithProviders(
      <KitProvider texts={{ keepEditing: 'Keep editing', pendingIn: (list) => `Unsaved: ${list}.` }}>
        <ConfirmDiscard title="Discard?" pending={['A']} consequence="Gone." confirmLabel="Discard" onConfirm={() => {}} onKeep={() => {}} />
      </KitProvider>
    )
    const dialog = screen.getByRole('dialog', { name: 'Discard?' })
    expect(dialog).toHaveTextContent('Unsaved: A. Gone.')
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
  })
})
