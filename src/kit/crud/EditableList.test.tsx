// copiado de srtm-ui@a1df33a (src/kit/crud/EditableList.test.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import type { QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@wasichai/testing'
import { describe, expect, it, vi } from 'vitest'
import type { SectionSpec } from '../forms/spec'
import { KitProvider } from '../KitProvider'
import { EditableList, type Column, type EditableListProps } from './EditableList'

interface Thing {
  id?: string
  name: string
  state?: string
  size?: number
}

const SECTIONS: SectionSpec[] = [{ id: 'main', title: 'Main', fields: [{ name: 'name', label: 'Name', required: true }] }]
const COLUMNS: Column<Thing>[] = [
  { label: 'Name', render: (t) => t.name },
  { label: 'Size', render: (t) => String(t.size ?? ''), numeric: true }
]
const ROWS: Thing[] = [
  { id: 't1', name: 'FIRST', state: 'ON', size: 10 },
  { id: 't2', name: 'SECOND', state: 'OFF', size: 20 }
]

// the list over fakes: load/save/remove are spies, onChanged tells the order of the calls
function setup(props: Partial<EditableListProps<Thing>> = {}) {
  const calls: string[] = []
  const load = vi.fn(async () => ROWS)
  const save = vi.fn(async () => {
    calls.push('save')
  })
  const remove = vi.fn(async () => {
    calls.push('remove')
  })
  const onChanged = vi.fn(async () => {
    calls.push('changed')
  })
  const newRow = vi.fn((rows: Thing[]) => ({ name: `NEW ${rows.length + 1}` }))
  const view = renderWithProviders(
    <EditableList<Thing>
      queryKey={['things', 'p1']}
      load={load}
      save={save}
      remove={remove}
      onChanged={onChanged}
      plural="things"
      singular="thing"
      sections={SECTIONS}
      columns={COLUMNS}
      newRow={newRow}
      {...props}
    />
  )
  return { ...view, calls, load, save, remove, onChanged, newRow }
}

const grid = () => screen.findByRole('grid', { name: 'Listado de things' })

describe('EditableList', () => {
  it('lists the rows under their heading, in a grid with one tab stop', async () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Listado de things' })).toBeInTheDocument()
    const [head, first, second] = within(await grid()).getAllByRole('row')
    expect(
      within(head)
        .getAllByRole('columnheader')
        .map((th) => th.textContent)
    ).toEqual(['Name', 'Size'])
    expect(first).toHaveTextContent('FIRST')
    expect(second).toHaveTextContent('SECOND')
    // none selected: the first row is the one stop for Tab
    expect(first).toHaveAttribute('tabindex', '0')
    expect(second).toHaveAttribute('tabindex', '-1')
  })

  it('marks the numeric columns', async () => {
    setup()
    const [head, first] = within(await grid()).getAllByRole('row')
    const sized = (row: HTMLElement) => [...row.querySelectorAll('[data-numeric]')].map((cell) => cell.textContent)
    expect(sized(head)).toEqual(['Size'])
    expect(sized(first)).toEqual(['10'])
    for (const cell of first.querySelectorAll('[data-numeric]')) expect(cell).toHaveClass('text-right', 'tabular-nums')
  })

  it('moves the selection with the arrows and edits the selected row with Enter', async () => {
    const { save } = setup()
    const [, first, second] = within(await grid()).getAllByRole('row')
    act(() => first.focus())
    expect(first).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowDown}')
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveAttribute('aria-selected', 'false')
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('tabindex', '0')
    expect(first).toHaveAttribute('tabindex', '-1')
    await userEvent.keyboard('{ArrowUp}')
    expect(first).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{Enter}')

    const dialog = await screen.findByRole('dialog', { name: 'Editar thing' })
    expect(within(dialog).getByRole('textbox', { name: /^Name/ })).toHaveValue('SECOND')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(save).toHaveBeenCalledWith(ROWS[1], { id: 't2', name: 'SECOND', state: 'OFF', size: 20 })
  })

  it('edits a row on double click, and the pencil edits the selected one', async () => {
    setup()
    const [, first, second] = within(await grid()).getAllByRole('row')
    expect(screen.getByRole('button', { name: 'Editar thing' })).toBeDisabled()
    await userEvent.dblClick(second)
    const dialog = await screen.findByRole('dialog', { name: 'Editar thing' })
    expect(within(dialog).getByRole('textbox', { name: /^Name/ })).toHaveValue('SECOND')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(first)
    await userEvent.click(screen.getByRole('button', { name: 'Editar thing' }))
    expect(within(await screen.findByRole('dialog', { name: 'Editar thing' })).getByRole('textbox', { name: /^Name/ })).toHaveValue('FIRST')
  })

  it('opens a new form seeded by newRow, saves it as null + values, then asks what else to read again', async () => {
    const { save, newRow, onChanged, calls } = setup()
    await grid()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar thing' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo thing' })
    expect(newRow).toHaveBeenCalledWith(ROWS)
    const name = within(dialog).getByRole('textbox', { name: /^Name/ })
    expect(name).toHaveValue('NEW 3')
    await userEvent.clear(name)
    await userEvent.type(name, 'THIRD')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))

    expect(save).toHaveBeenCalledWith(null, { name: 'THIRD' })
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['save', 'changed'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the dialog open and says why when the save fails', async () => {
    const { onChanged } = setup({
      save: async () => {
        throw new Error('Server is down')
      }
    })
    await grid()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar thing' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Nuevo thing' })).getByRole('button', { name: 'Grabar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Server is down')
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('takes the sections from a function of the rows and the row being edited', async () => {
    const sections = vi.fn((rows: Thing[], editing: Thing | null): SectionSpec[] => [
      { id: 'main', title: 'Main', fields: [{ name: 'name', label: editing ? `Name of ${rows.length}` : 'Fresh name' }] }
    ])
    setup({ sections })
    await grid()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar thing' }))
    expect(await screen.findByRole('textbox', { name: 'Fresh name' })).toBeInTheDocument()
    expect(sections).toHaveBeenCalledWith(ROWS, null)
  })

  it('hands the form the options it was given, and its footer the live values', async () => {
    const options = { name: ['ALPHA', 'BETA'] }
    setup({
      options,
      sections: [{ id: 'main', title: 'Main', fields: [{ name: 'name', label: 'Name', kind: 'enum' }] }],
      newRow: () => ({ name: 'ALPHA' }),
      footer: (values) => <p>Chosen {values.name}</p>
    })
    await grid()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar thing' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo thing' })
    expect(within(dialog).getByText('Chosen ALPHA')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Name' }))
    expect(await screen.findByRole('option', { name: 'BETA' })).toBeInTheDocument()
  })

  it('widens the dialog when asked', async () => {
    setup({ wide: true })
    await grid()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar thing' }))
    expect(await screen.findByRole('dialog', { name: 'Nuevo thing' })).toHaveClass('max-w-5xl')
  })

  it('disables the bin of a fixed row, with its reason as the title, and asks fixed of the row and all rows', async () => {
    const fixed = vi.fn((row: Thing) => (row.id === 't1' ? 'The first one stays' : null))
    setup({ fixed })
    const [, first, second] = within(await grid()).getAllByRole('row')
    const bin = screen.getByRole('button', { name: 'Eliminar thing' })
    expect(bin).toBeDisabled()
    await userEvent.click(first)
    expect(bin).toBeDisabled()
    expect(bin).toHaveAttribute('title', 'The first one stays')
    expect(fixed).toHaveBeenCalledWith(ROWS[0], ROWS)
    await userEvent.click(second)
    expect(bin).toBeEnabled()
    expect(bin).not.toHaveAttribute('title')
  })

  it('removes the selected row after a confirmation, then asks what else to read again', async () => {
    const { remove, onChanged, calls } = setup()
    const [, first] = within(await grid()).getAllByRole('row')
    await userEvent.click(first)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar thing' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })
    expect(dialog).toHaveTextContent('Se quita de la ficha. El historial del registro lo conserva.')
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))

    expect(remove).toHaveBeenCalledWith(ROWS[0])
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['remove', 'changed'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // the removed row's selection is gone
    expect(screen.getByRole('button', { name: 'Eliminar thing' })).toBeDisabled()
  })

  it('does not remove when the confirmation is cancelled', async () => {
    const { remove } = setup()
    const [, first] = within(await grid()).getAllByRole('row')
    await userEvent.click(first)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar thing' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
  })

  it('shows what a failed removal says in the confirmation, and keeps it open', async () => {
    const { onChanged } = setup({
      remove: async () => {
        throw new Error('Still in use')
      }
    })
    const [, first] = within(await grid()).getAllByRole('row')
    await userEvent.click(first)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar thing' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(await within(dialog).findByText('Still in use')).toBeInTheDocument()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('falls back to the default words when a failed removal says nothing', async () => {
    setup({
      remove: async () => {
        throw new Error('  ')
      }
    })
    const [, first] = within(await grid()).getAllByRole('row')
    await userEvent.click(first)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar thing' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(await within(dialog).findByText('No se pudo eliminar')).toBeInTheDocument()
  })

  it('forgets a failed removal when the confirmation closes, by Cancelar or by Escape', async () => {
    setup({
      remove: async () => {
        throw new Error('Still in use')
      }
    })
    const [, first, second] = within(await grid()).getAllByRole('row')
    await userEvent.click(first)
    const bin = screen.getByRole('button', { name: 'Eliminar thing' })
    await userEvent.click(bin)
    let dialog = await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(await within(dialog).findByText('Still in use')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    // the same row again: a fresh question, not the old failure
    await userEvent.click(bin)
    dialog = await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(await within(dialog).findByText('Still in use')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // another row: nothing of the first one's failure either
    await userEvent.click(second)
    await userEvent.click(bin)
    dialog = await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sends one removal for a double click on Eliminar', async () => {
    let done: () => void = () => {}
    const remove = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          done = resolve
        })
    )
    setup({ remove })
    const [, first] = within(await grid()).getAllByRole('row')
    await userEvent.click(first)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar thing' }))
    const confirm = within(await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })).getByRole('button', { name: 'Eliminar' })
    await userEvent.dblClick(confirm)
    expect(remove).toHaveBeenCalledTimes(1)
    // busy while it runs
    expect(confirm).toBeDisabled()
    await act(async () => done())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('lets the removal be tried again once a failed one is over', async () => {
    const remove = vi.fn(async () => {
      throw new Error('Still in use')
    })
    setup({ remove })
    const [, first] = within(await grid()).getAllByRole('row')
    await userEvent.click(first)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar thing' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })
    const confirm = within(dialog).getByRole('button', { name: 'Eliminar' })
    await userEvent.click(confirm)
    expect(await within(dialog).findByText('Still in use')).toBeInTheDocument()
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(remove).toHaveBeenCalledTimes(2)
  })

  it('without onChanged, reads again after a save rather than joining a slower read begun before it', async () => {
    let stored: Thing[] = [...ROWS]
    // the next read hangs, holding the rows of before the save, until the test lets it go
    let hold = false
    let release: () => void = () => {}
    const load = vi.fn((): Promise<Thing[]> => {
      const rows = [...stored]
      if (!hold) return Promise.resolve(rows)
      hold = false
      return new Promise((resolve) => {
        release = () => resolve(rows)
      })
    })
    const { queryClient } = renderWithProviders(
      <EditableList<Thing>
        queryKey={['things', 'slow']}
        load={load}
        save={async (_editing, values) => {
          stored = [...stored, { ...values, id: 't3' }]
        }}
        remove={async () => {}}
        plural="things"
        singular="thing"
        sections={SECTIONS}
        columns={COLUMNS}
        newRow={() => ({ name: '' })}
      />
    )
    await grid()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar thing' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo thing' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'THIRD')
    // a read the list did not ask for (a refocus, say) is on its way when the save lands
    hold = true
    act(() => void queryClient.refetchQueries({ queryKey: ['things', 'slow'] }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    await act(async () => release())

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await within(await grid()).findByRole('row', { name: /THIRD/ })).toBeInTheDocument()
    expect(
      within(screen.getByRole('grid'))
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(['FIRST10', 'SECOND20', 'THIRD'])
  })

  it('reads its list once per save and per removal when onChanged also refreshes it', async () => {
    let client: QueryClient | undefined
    // like an app's global refresh: every query goes stale, this list's too
    const onChanged = vi.fn(() => client?.invalidateQueries())
    const { load, queryClient } = setup({ onChanged })
    client = queryClient
    await grid()
    expect(load).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Agregar thing' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Nuevo thing' })).getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(2)

    await userEvent.click(within(await grid()).getByRole('row', { name: /FIRST/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar thing' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onChanged).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('reads its own list again after a save and a removal, with no onChanged', async () => {
    let stored: Thing[] = [...ROWS]
    renderWithProviders(
      <EditableList<Thing>
        queryKey={['things', 'alone']}
        load={async () => stored}
        save={async (_editing, values) => {
          stored = [...stored, { ...values, id: 't3' }]
        }}
        remove={async (row) => {
          stored = stored.filter((t) => t.id !== row.id)
        }}
        plural="things"
        singular="thing"
        sections={SECTIONS}
        columns={COLUMNS}
        newRow={() => ({ name: '' })}
      />
    )
    await grid()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar thing' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo thing' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'THIRD')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(await within(await grid()).findByRole('row', { name: /THIRD/ })).toBeInTheDocument()

    await userEvent.click(within(await grid()).getByRole('row', { name: /FIRST/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar thing' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Eliminar este thing?' })).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(within(screen.getByRole('grid')).queryByRole('row', { name: /FIRST/ })).not.toBeInTheDocument())
    expect(
      within(screen.getByRole('grid'))
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(['SECOND20', 'THIRD'])
  })

  it('has no Estado column while no status is given', async () => {
    setup()
    const [head, first] = within(await grid()).getAllByRole('row')
    expect(within(head).queryByRole('columnheader', { name: 'Estado' })).not.toBeInTheDocument()
    expect(within(first).getAllByRole('cell')).toHaveLength(2)
  })

  it('adds the status as a last column', async () => {
    setup({ status: { label: 'Estado', render: (t) => <b>{t.state}</b> } })
    const [head, first, second] = within(await grid()).getAllByRole('row')
    expect(
      within(head)
        .getAllByRole('columnheader')
        .map((th) => th.textContent)
    ).toEqual(['Name', 'Size', 'Estado'])
    expect(within(first).getAllByRole('cell').at(-1)).toHaveTextContent('ON')
    expect(within(second).getAllByRole('cell').at(-1)).toHaveTextContent('OFF')
  })

  it('heads the status column with texts.status unless it has a label of its own', async () => {
    const heads = async () =>
      within(within(await screen.findByRole('grid')).getAllByRole('row')[0])
        .getAllByRole('columnheader')
        .map((th) => th.textContent)
    const status = { render: (t: Thing) => t.state }
    const list = (props: Partial<EditableListProps<Thing>>) => (
      <EditableList<Thing>
        queryKey={['heads']}
        load={async () => ROWS}
        save={async () => {}}
        remove={async () => {}}
        plural="things"
        singular="thing"
        sections={SECTIONS}
        columns={COLUMNS}
        newRow={() => ({ name: 'X' })}
        {...props}
      />
    )

    const view = renderWithProviders(list({ status }))
    expect(await heads()).toEqual(['Name', 'Size', 'Estado'])
    view.unmount()

    const words = renderWithProviders(<KitProvider texts={{ status: 'State' }}>{list({ status })}</KitProvider>)
    expect(await heads()).toEqual(['Name', 'Size', 'State'])
    words.unmount()

    renderWithProviders(<KitProvider texts={{ status: 'State' }}>{list({ status: { ...status, label: 'Phase' } })}</KitProvider>)
    expect(await heads()).toEqual(['Name', 'Size', 'Phase'])
  })

  it('shows the notice above the list, knowing the rows', async () => {
    setup({ notice: (rows) => <p>{rows.length} things here</p> })
    expect(await screen.findByText('2 things here')).toBeInTheDocument()
  })

  it('hides the toolbar and refuses to edit when read only', async () => {
    setup({ readOnly: true })
    const [, first] = within(await grid()).getAllByRole('row')
    expect(screen.queryByRole('button', { name: 'Agregar thing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar thing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar thing' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Listado de things' })).toBeInTheDocument()
    await userEvent.dblClick(first)
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says there is nothing when the list is empty, and shows no pager', async () => {
    setup({ load: async () => [] })
    expect(await screen.findByText('No se encontraron resultados!')).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(screen.queryByText(/registros/)).not.toBeInTheDocument()
  })

  it('pages the rows, ten to a page', async () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ id: `r${i}`, name: `ROW ${i + 1}` }))
    setup({ load: async () => many })
    const rows = within(await grid()).getAllByRole('row')
    // the header and ten rows
    expect(rows).toHaveLength(11)
    expect(screen.getByText('1 a 10 de 23 registros')).toBeInTheDocument()
  })

  it('reads the list under its query key', async () => {
    const { queryClient } = setup()
    await grid()
    expect(queryClient.getQueryData(['things', 'p1'])).toEqual(ROWS)
  })

  it('takes its words from the KitProvider', async () => {
    const calls: string[] = []
    renderWithProviders(
      <KitProvider
        texts={{
          listOf: (plural) => `List of ${plural}`,
          add: (singular) => `Add ${singular}`,
          edit: (singular) => `Change ${singular}`,
          remove: (singular) => `Drop ${singular}`,
          newOne: (singular) => `New ${singular}`,
          editOne: (singular) => `Changing ${singular}`,
          dataOf: (singular) => `Data of ${singular}`,
          noResults: 'Nothing here',
          removeTitle: (singular) => `Drop this ${singular}?`,
          removeBody: 'Gone for good.',
          removeFailed: 'Could not drop',
          save: 'Keep'
        }}
      >
        <EditableList<Thing>
          queryKey={['words']}
          load={async () => ROWS}
          save={async () => {
            calls.push('save')
          }}
          remove={async () => {
            throw new Error('')
          }}
          plural="things"
          singular="thing"
          sections={SECTIONS}
          columns={COLUMNS}
          newRow={() => ({ name: 'X' })}
        />
      </KitProvider>
    )
    const [, first] = within(await screen.findByRole('grid', { name: 'List of things' })).getAllByRole('row')
    expect(screen.getByRole('heading', { name: 'List of things' })).toBeInTheDocument()
    await userEvent.click(first)
    expect(screen.getByRole('button', { name: 'Add thing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change thing' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Change thing' }))
    const editing = await screen.findByRole('dialog', { name: 'Changing thing' })
    expect(editing).toHaveTextContent('Data of thing')
    expect(within(editing).getByRole('button', { name: 'Keep' })).toBeInTheDocument()
    await userEvent.click(within(editing).getByRole('button', { name: 'Cancelar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Add thing' }))
    expect(await screen.findByRole('dialog', { name: 'New thing' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Drop thing' }))
    const dialog = await screen.findByRole('dialog', { name: 'Drop this thing?' })
    expect(dialog).toHaveTextContent('Gone for good.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(await within(dialog).findByText('Could not drop')).toBeInTheDocument()
  })

  it('shows the empty state in the words of the app', async () => {
    renderWithProviders(
      <KitProvider texts={{ noResults: 'Nothing here' }}>
        <EditableList<Thing>
          queryKey={['empty']}
          load={async () => []}
          save={async () => {}}
          remove={async () => {}}
          plural="things"
          singular="thing"
          sections={SECTIONS}
          columns={COLUMNS}
          newRow={() => ({ name: 'X' })}
        />
      </KitProvider>
    )
    expect(await screen.findByText('Nothing here')).toBeInTheDocument()
  })
})
