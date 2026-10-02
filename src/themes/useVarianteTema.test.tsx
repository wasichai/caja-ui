import { act, screen } from '@testing-library/react'
import { useTheme } from '@wasichai/core'
import { renderWithProviders } from '@wasichai/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { CAJA_THEMES, useVarianteTema } from '.'

// the layout the portal draws, and the theme core applied, side by side
function Probe() {
  const variante = useVarianteTema()
  const { theme, setPreference } = useTheme()
  return (
    <>
      <p data-testid="variante">{variante}</p>
      <p data-testid="tema">{theme.id}</p>
      <button type="button" onClick={() => void setPreference('portal-tributario')}>
        portal
      </button>
    </>
  )
}

// signed out: the pick stays in the browser, as the boot script and the login screen read it
function start(stored?: string) {
  if (stored) localStorage.setItem('caja.theme', stored)
  renderWithProviders(<Probe />, { config: { storagePrefix: 'caja', themes: CAJA_THEMES }, user: null })
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('useVarianteTema', () => {
  it('asks for the portal layout with portal-tributario', () => {
    start('portal-tributario')
    expect(screen.getByTestId('tema')).toHaveTextContent('portal-tributario')
    expect(screen.getByTestId('variante')).toHaveTextContent('portal')
  })

  it.each(['light', 'dark', 'system'])('keeps the classic layout with %s', (stored) => {
    start(stored)
    expect(screen.getByTestId('variante')).toHaveTextContent('clasico')
  })

  // core sends an id it does not know (another app's theme) to the os setting: classic, like system
  it('keeps the classic layout with a theme it does not know', () => {
    start('otra-app')
    expect(screen.getByTestId('tema')).toHaveTextContent('light')
    expect(screen.getByTestId('variante')).toHaveTextContent('clasico')
  })

  it('follows the theme when it changes', async () => {
    start()
    expect(screen.getByTestId('variante')).toHaveTextContent('clasico')
    await act(async () => screen.getByRole('button', { name: 'portal' }).click())
    expect(screen.getByTestId('variante')).toHaveTextContent('portal')
  })
})
