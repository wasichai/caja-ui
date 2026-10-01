// copiado de srtm-ui@a1df33a (src/kit/forms/RecordForm.test.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PORTAL_TRIBUTARIO_THEME } from '@wasichai/core'
import { renderWithProviders } from '@wasichai/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KitProvider } from '../KitProvider'
import { FieldGrid } from './FieldGrid'
import type { KindRenderer } from './kinds'
import { RecordForm } from './RecordForm'
import type { PlaceholderContext, SectionSpec } from './spec'

// the hooks a theme styles the form by (portal-tributario's partials); light and dark only get the attributes

const SECTIONS: SectionSpec[] = [
  {
    id: 'datos-personales',
    title: 'Datos personales',
    number: 3,
    fields: [
      { name: 'codigo', label: 'Código', readOnly: true },
      { name: 'nombres', label: 'Nombres', required: true },
      { name: 'sexo', label: 'Sexo', kind: 'enum', required: true },
      { name: 'observacion', label: 'Observación', kind: 'longtext' },
      { name: 'documentos', label: 'Documentos', kind: 'multi', choices: ['MINUTA', 'ESCRITURA PUBLICA'] }
    ]
  }
]

function renderForm() {
  const onSubmit = vi.fn(async () => {})
  render(
    <RecordForm
      sections={SECTIONS}
      options={{ sexo: ['HOMBRE', 'MUJER'] }}
      initial={{ codigo: '000012', nombres: '', sexo: '', observacion: '', documentos: '' }}
      submitLabel="Guardar"
      onSubmit={onSubmit}
      onCancel={() => {}}
    />
  )
  return { onSubmit }
}

describe('RecordForm: the theme hooks', () => {
  it('marks its inputs, text areas, selects and buttons', () => {
    renderForm()
    expect(screen.getByRole('textbox', { name: /^Nombres/ })).toHaveAttribute('data-slot', 'input')
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveAttribute('data-slot', 'textarea')
    expect(screen.getByRole('combobox', { name: /^Sexo/ })).toHaveAttribute('data-slot', 'select-trigger')
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveAttribute('data-variant', 'secondary')
  })

  it('keeps a read-only field disabled, with its hook', () => {
    renderForm()
    const codigo = screen.getByRole('textbox', { name: 'Código' })
    expect(codigo).toBeDisabled()
    expect(codigo).toHaveAttribute('data-slot', 'input')
  })

  it('marks each section as a fieldset whose legend has the number, the title and the action', () => {
    render(
      <RecordForm
        sections={[{ ...SECTIONS[0], action: () => <button type="button">Buscar registros</button> }]}
        options={{ sexo: ['HOMBRE', 'MUJER'] }}
        initial={{ codigo: '', nombres: '', sexo: '', observacion: '', documentos: '' }}
        submitLabel="Guardar"
        onSubmit={async () => {}}
      />
    )
    const fieldset = screen.getByRole('group', { name: /Datos personales/ })
    expect(fieldset).toHaveAttribute('data-ui', 'record-fieldset')
    const legend = fieldset.querySelector('legend')
    expect(legend).toHaveAttribute('data-ui', 'record-legend')
    expect(legend?.querySelector('[data-ui="record-number"]')).toHaveTextContent('3')
    expect(legend?.querySelector('[data-ui="record-title"]')).toHaveTextContent('Datos personales')
    expect(legend?.querySelector('[data-ui="record-action"]')).toContainElement(screen.getByRole('button', { name: 'Buscar registros' }))
  })

  it('shows what the backend refuses above the buttons as an alert', async () => {
    render(
      <RecordForm
        sections={SECTIONS}
        options={{ sexo: ['HOMBRE', 'MUJER'] }}
        initial={{ codigo: '', nombres: 'JUAN', sexo: 'HOMBRE', observacion: '', documentos: '' }}
        submitLabel="Guardar"
        onSubmit={async () => {
          throw new Error('El servidor no responde')
        }}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no responde')
  })

  it("draws that alert with the app's renderAlert", async () => {
    render(
      <KitProvider
        renderAlert={(message) => (
          <div role="alert" data-testid="app-alert">
            {message}
          </div>
        )}
      >
        <RecordForm
          sections={SECTIONS}
          options={{ sexo: ['HOMBRE', 'MUJER'] }}
          initial={{ codigo: '', nombres: 'JUAN', sexo: 'HOMBRE', observacion: '', documentos: '' }}
          submitLabel="Guardar"
          onSubmit={async () => {
            throw new Error('El servidor no responde')
          }}
        />
      </KitProvider>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByTestId('app-alert')).toHaveTextContent('El servidor no responde')
  })

  it('keeps aria-invalid on the fields it refuses', async () => {
    const { onSubmit } = renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findAllByText('Este dato es obligatorio')).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: /^Nombres/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('combobox', { name: /^Sexo/ })).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

// the actions' footer: portal-tributario lays it out as the prototype (Cancelar on the left, then a faint note
// and the primary action on the right, by a theme partial); the markup is the same in every theme
describe('RecordForm: the actions footer', () => {
  // the test's own themes, not the app's: the kit's tests stay inside the kit
  const THEMED = { config: { storagePrefix: 'kit', themes: [PORTAL_TRIBUTARIO_THEME] }, user: null }
  const renderIn = (theme: string, note?: string) => {
    localStorage.setItem('kit.theme', theme)
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()
    renderWithProviders(
      <RecordForm
        sections={SECTIONS}
        options={{ sexo: ['HOMBRE', 'MUJER'] }}
        initial={{ codigo: '000012', nombres: 'JUAN', sexo: 'HOMBRE', observacion: '', documentos: '' }}
        submitLabel="Guardar"
        onSubmit={onSubmit}
        onCancel={onCancel}
        note={note}
      />,
      THEMED
    )
    return { onSubmit, onCancel }
  }
  const pie = () => screen.getByRole('button', { name: 'Guardar' }).parentElement!

  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('puts Cancelar before the primary action and the note between them, and both work as before', async () => {
    const { onSubmit, onCancel } = renderIn('portal-tributario', 'Los campos con * son obligatorios')
    expect(document.documentElement.dataset.theme).toBe('portal-tributario')
    expect(pie()).toHaveAttribute('data-ui', 'record-acciones')
    const [cancelar, nota, guardar] = Array.from(pie().children)
    expect(cancelar).toBe(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nota).toHaveAttribute('data-ui', 'record-nota')
    expect(nota).toHaveTextContent('Los campos con * son obligatorios')
    expect(nota).toHaveClass('text-ink-muted')
    expect(guardar).toBe(screen.getByRole('button', { name: 'Guardar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ nombres: 'JUAN', sexo: 'HOMBRE' }))
  })

  it.each(['light', 'portal-tributario'])('keeps the two buttons alone, to the right, without a note, with %s', (theme) => {
    renderIn(theme)
    expect(pie()).toHaveClass('flex', 'justify-end', 'gap-2')
    expect(Array.from(pie().children).map((b) => b.textContent)).toEqual(['Cancelar', 'Guardar'])
    expect(document.querySelector('[data-ui="record-nota"]')).toBeNull()
  })

  it('hides the footer, note included, when the buttons are elsewhere', () => {
    localStorage.setItem('kit.theme', 'portal-tributario')
    renderWithProviders(<RecordForm sections={SECTIONS} initial={{}} submitLabel="Guardar" onSubmit={async () => {}} hideActions note="Una nota" />, THEMED)
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Una nota')).not.toBeInTheDocument()
  })
})

const onSubmit = async () => {}
const one = (fields: SectionSpec['fields']): SectionSpec[] => [{ id: 'datos', title: 'Datos', fields }]
const year = new Date().getFullYear()
const yearsDownTo = (from: number) => Array.from({ length: year - from + 1 }, (_, i) => String(year - i))
const optionsOf = (name: string) =>
  within(screen.getByRole('combobox', { name }))
    .getAllByRole('option')
    .map((o) => o.textContent)

describe('RecordForm: kinds', () => {
  it('asks a suggest field again when a field it depends on changes, and not for another one', async () => {
    const fetch = vi.fn(async () => ['UNO'])
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RecordForm
          sections={one([
            { name: 'tipo', label: 'Tipo' },
            { name: 'otro', label: 'Otro' },
            { name: 'nombre', label: 'Nombre', kind: 'suggest', suggest: { fetch, dependsOn: ['tipo'] } }
          ])}
          initial={{}}
          submitLabel="Guardar"
          onSubmit={onSubmit}
        />
      </QueryClientProvider>
    )
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await userEvent.type(screen.getByRole('textbox', { name: 'Otro' }), 'X')
    await userEvent.type(screen.getByRole('textbox', { name: 'Tipo' }), 'A')
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith('', expect.objectContaining({ tipo: 'A', otro: 'X' }))
  })

  it('offers the years from yearFrom down', () => {
    render(<RecordForm sections={one([{ name: 'anio', label: 'Año', kind: 'year', yearFrom: 2020 }])} initial={{}} submitLabel="Guardar" onSubmit={onSubmit} />)
    expect(optionsOf('Año')).toEqual(['SELECCIONAR', ...yearsDownTo(2020)])
  })

  it('offers a hundred years without yearFrom', () => {
    render(<RecordForm sections={one([{ name: 'anio', label: 'Año', kind: 'year' }])} initial={{}} submitLabel="Guardar" onSubmit={onSubmit} />)
    expect(optionsOf('Año')).toEqual(['SELECCIONAR', ...yearsDownTo(year - 100)])
  })

  it('draws a kind the app registers through KitProvider', async () => {
    const color: KindRenderer = ({ field, form, aria, rules }) => <input type="color" {...aria} {...form.register(field.name, rules)} />
    const submitted = vi.fn(async () => {})
    render(
      <KitProvider kinds={{ color }}>
        <RecordForm sections={one([{ name: 'tono', label: 'Tono', kind: 'color' }])} initial={{ tono: '#ff0000' }} submitLabel="Guardar" onSubmit={submitted} />
      </KitProvider>
    )
    expect(screen.getByLabelText('Tono')).toHaveAttribute('type', 'color')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ tono: '#ff0000' }))
  })
})

describe('RecordForm and FieldGrid: what an empty value means', () => {
  // a function placeholder: what the backend fills, while the record is new; nothing to come once it is stored
  const placeholder = ({ saved }: PlaceholderContext) => (saved ? 'NONE' : 'LATER')
  const sections = one([{ name: 'code', label: 'Code', readOnly: true, placeholder }])

  it('shows it on an empty read-only field, as the record is new or stored', () => {
    const { unmount } = render(<RecordForm sections={sections} initial={{}} submitLabel="Guardar" onSubmit={onSubmit} />)
    expect(screen.getByRole('textbox', { name: 'Code' })).toHaveAttribute('placeholder', 'LATER')
    unmount()
    render(<RecordForm sections={sections} initial={{ id: 'r1', code: null }} submitLabel="Guardar" onSubmit={onSubmit} />)
    expect(screen.getByRole('textbox', { name: 'Code' })).toHaveAttribute('placeholder', 'NONE')
  })

  it('shows it in the ficha for an empty value, as stored', () => {
    render(<FieldGrid sections={sections} values={{ code: null }} />)
    expect(screen.getByText('Code', { selector: 'dt' }).nextElementSibling).toHaveTextContent('NONE')
  })

  it('keeps a string placeholder as the hint only: the ficha shows a dash', () => {
    const hinted = one([{ name: 'note', label: 'Note', readOnly: true, placeholder: 'A NOTE' }])
    const { unmount } = render(<RecordForm sections={hinted} initial={{ id: 'r1' }} submitLabel="Guardar" onSubmit={onSubmit} />)
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveAttribute('placeholder', 'A NOTE')
    unmount()
    render(<FieldGrid sections={hinted} values={{ note: null }} />)
    expect(screen.getByText('Note', { selector: 'dt' }).nextElementSibling).toHaveTextContent('—')
  })
})

describe('sections keyed by id', () => {
  const twins: SectionSpec[] = [
    { id: 'datos', title: 'Datos', fields: [{ name: 'uno', label: 'Uno' }] },
    { id: 'datos-2', title: 'Datos', fields: [{ name: 'dos', label: 'Dos' }] }
  ]

  it('renders two sections of one title in the form, without a key warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<RecordForm sections={twins} initial={{}} submitLabel="Guardar" onSubmit={onSubmit} />)
    expect(screen.getAllByRole('group', { name: 'Datos' })).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: 'Uno' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Dos' })).toBeInTheDocument()
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('renders two sections of one title in the ficha, without a key warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<FieldGrid sections={twins} values={{ uno: 'A', dos: 'B' }} />)
    expect(screen.getAllByRole('heading', { name: 'Datos' })).toHaveLength(2)
    expect(screen.getByText('Uno', { selector: 'dt' }).nextElementSibling).toHaveTextContent('A')
    expect(screen.getByText('Dos', { selector: 'dt' }).nextElementSibling).toHaveTextContent('B')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
