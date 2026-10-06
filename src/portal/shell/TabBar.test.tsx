import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TABS_KEY } from '../auth/session'
import { TabBar } from './TabBar'
import { WorkspaceTabsProvider } from './WorkspaceTabs'

// the workspace tabs, kept per browser tab under caja.tabs, and the hooks a theme styles them by (tabs.css)

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem(TABS_KEY, JSON.stringify([{ path: '/duplicado-recibo/001-000123', label: 'Recibo 001-000123' }]))
})

function start(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <WorkspaceTabsProvider>
        <TabBar />
      </WorkspaceTabsProvider>
    </MemoryRouter>
  )
}

describe('TabBar', () => {
  it('marks the strip and each tab, the open one by aria-current', () => {
    start('/duplicado-recibo/001-000123')
    const nav = screen.getByRole('navigation', { name: 'Pestañas abiertas' })
    expect(nav).toHaveAttribute('data-ui', 'workspace-tabs')
    const pestana = screen.getByRole('link', { name: 'Recibo 001-000123' })
    expect(pestana).toHaveAttribute('aria-current', 'page')
    expect(pestana.closest('li')).toHaveAttribute('data-ui', 'workspace-tab')
    expect(screen.getByRole('link', { name: 'Inicio' }).closest('li')).toHaveAttribute('data-ui', 'workspace-tab')
  })

  it.each(['{}', '"Inicio"', '[1, {"path": "/x"}]', 'no es json'])('drops what the browser tab kept when it is not tabs: %s', (guardado) => {
    sessionStorage.setItem(TABS_KEY, guardado)
    start('/')
    expect(screen.getAllByRole('link').map((enlace) => enlace.textContent)).toEqual(['Inicio'])
  })

  it('closes a tab, and forgets it for the browser tab', async () => {
    start('/')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar Recibo 001-000123' }))
    expect(screen.queryByRole('link', { name: 'Recibo 001-000123' })).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('caja.tabs') ?? 'null')).toEqual([])
  })
})
