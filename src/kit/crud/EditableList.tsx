// copiado de srtm-ui@a1df33a (src/kit/crud/EditableList.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState, QueryState } from '@wasichai/core'
import { Button, cn, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle, PageSizePagination, Table, Td, Th } from '@wasichai/ui'
import { Box, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { RecordForm } from '../forms/RecordForm'
import type { FormValues, SectionSpec } from '../forms/spec'
import { useKit } from '../KitProvider'
import { errorMessage } from '../ui/errorMessage'

export interface Column<T> {
  label: string
  render: (row: T) => ReactNode
  className?: string
  // figures (areas, amounts, %): right aligned with digits of one width, and marked for the theme
  numeric?: boolean
}

export interface EditableListProps<T extends { id?: string }> {
  queryKey: readonly unknown[]
  load: () => Promise<T[]>
  // editing is the row being changed, null for a new one; values is what the form made
  save: (editing: T | null, values: T) => Promise<unknown>
  remove: (row: T) => Promise<unknown>
  // after a save or a removal: what else must read again, besides this list (it reads its own query again itself)
  onChanged?: () => Promise<unknown> | void
  // "domicilios": the list's heading. "domicilio": the dialogs'
  plural: string
  singular: string
  // the dialog's form; a function when it depends on the rows
  sections: SectionSpec[] | ((rows: T[], editing: T | null) => SectionSpec[])
  // enum options of the form, by field
  options?: Record<string, string[]>
  columns: Column<T>[]
  // a last column (the estado's badge); none = no column. its heading: label, or texts.status
  status?: { label?: string; render: (row: T) => ReactNode }
  // a new one's starting values, knowing the rows already there
  newRow: (rows: T[]) => T
  notice?: (rows: T[]) => ReactNode
  // why a row cannot be removed: the bin is disabled, with this as its title, while it is selected
  fixed?: (row: T, rows: T[]) => string | null
  footer?: (values: FormValues, form: UseFormReturn<FormValues>) => ReactNode
  wide?: boolean
  // listed, never changed: no toolbar, no editing
  readOnly?: boolean
}

// a cell of figures: the theme's `data-numeric` hook, and the alignment for the ones without a theme
const NUMERIC = 'text-right tabular-nums'

// a list of rows that hang from a record: a heading with "+", pencil and bin acting on the selected row, the table
// with its optional status, and a dialog to add or change a row. the app injects load, save and remove
export function EditableList<T extends { id?: string }>({
  queryKey,
  load,
  save,
  remove,
  onChanged,
  plural,
  singular,
  sections,
  options,
  columns,
  status,
  newRow,
  notice,
  fixed,
  footer,
  wide,
  readOnly
}: EditableListProps<T>) {
  const { texts } = useKit()
  const queryClient = useQueryClient()
  // not `queryFn: load`: load takes no query context
  const query = useQuery({ queryKey, queryFn: () => load() })
  const [editing, setEditing] = useState<T | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<T | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  // a removal on its way: the confirmation's button waits, so a double click sends one
  const [removeBusy, setRemoveBusy] = useState(false)
  // the row the pencil and the bin act on: one of the page shown, so a removed row or another page drops it
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // paged: "Filas 10", "1 a 10 de 23 registros"
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const rows = query.data ?? []
  const last = Math.max(0, Math.ceil(rows.length / size) - 1)
  const shown = rows.slice(Math.min(page, last) * size, (Math.min(page, last) + 1) * size)
  const selected = shown.find((r) => r.id === selectedId) ?? null
  const reason = selected ? (fixed?.(selected, rows) ?? undefined) : undefined

  const close = () => {
    setEditing(null)
    setAdding(false)
  }
  // after a write: what else the app says, then this list. with onChanged (an app refresh, first): a fetch of this list
  // in flight began after the write, so join it, not cancel and ask again. without: one in flight may be older than the
  // write, so cancel it and read again
  const changed = () => Promise.all([onChanged?.(), queryClient.invalidateQueries({ queryKey }, { cancelRefetch: !onChanged })])
  const submit = async (values: T) => {
    await save(editing, values)
    await changed()
    close()
  }
  // the confirmation opens and closes with no failure of before: a failure belongs to one try
  const askRemove = (row: T | null) => {
    setRemoveError(null)
    setRemoving(row)
  }
  const confirmRemove = async () => {
    if (!removing?.id) return
    setRemoveError(null)
    setRemoveBusy(true)
    try {
      await remove(removing)
      await changed()
      setRemoving(null)
      setSelectedId(null)
    } catch (e) {
      setRemoveError(errorMessage(e, texts.removeFailed))
    } finally {
      setRemoveBusy(false)
    }
  }
  const open = adding || editing !== null
  const edit = (row: T) => {
    if (!readOnly) setEditing(row)
  }
  // the grid's keys: the arrows move the selection (focusing a row selects it), Enter edits it
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    const next = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.key === 'ArrowUp' ? e.currentTarget.previousElementSibling : null
    if (next instanceof HTMLElement) {
      e.preventDefault()
      next.focus()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      edit(row)
    }
  }

  return (
    <div className="space-y-4">
      {query.data && notice?.(query.data)}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold tracking-wide text-ink uppercase">{texts.listOf(plural)}</h3>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" className="border-brand text-brand" onClick={() => setAdding(true)} aria-label={texts.add(singular)}>
              <Plus className="size-4" />
            </Button>
            <Button variant="secondary" size="icon" disabled={!selected} onClick={() => setEditing(selected)} aria-label={texts.edit(singular)}>
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              disabled={!selected || reason !== undefined}
              title={reason}
              onClick={() => askRemove(selected)}
              aria-label={texts.remove(singular)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <QueryState query={query}>
        {() =>
          rows.length === 0 ? (
            <EmptyState title={texts.noResults} icon={Box} />
          ) : (
            <Table role="grid" aria-label={texts.listOf(plural)}>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <Th key={c.label} data-numeric={c.numeric || undefined} className={cn(c.numeric && NUMERIC, c.className)}>
                      {c.label}
                    </Th>
                  ))}
                  {status && <Th>{status.label ?? texts.status}</Th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, index) => {
                  const isSelected = row === selected
                  return (
                    <tr
                      key={row.id}
                      aria-selected={isSelected}
                      // one stop for Tab: the selected row, or the first while none is
                      tabIndex={isSelected || (selected === null && index === 0) ? 0 : -1}
                      onClick={() => setSelectedId(row.id ?? null)}
                      onFocus={() => setSelectedId(row.id ?? null)}
                      onDoubleClick={() => edit(row)}
                      onKeyDown={(e) => onKey(e, row)}
                      className={cn(
                        'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
                        isSelected ? 'bg-brand-soft' : 'hover:bg-surface-muted/60'
                      )}
                    >
                      {columns.map((c) => (
                        <Td
                          key={c.label}
                          data-numeric={c.numeric || undefined}
                          className={cn(c.numeric && NUMERIC, c.className, isSelected && 'text-brand-strong')}
                        >
                          {c.render(row)}
                        </Td>
                      ))}
                      {status && <Td>{status.render(row)}</Td>}
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )
        }
      </QueryState>
      {rows.length > 0 && (
        <PageSizePagination
          page={Math.min(page, last)}
          size={size}
          total={rows.length}
          onPage={setPage}
          onSize={(next) => {
            setSize(next)
            setPage(0)
          }}
        />
      )}

      {open && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent className={wide ? 'max-h-[90vh] max-w-5xl overflow-y-auto' : 'max-h-[90vh] overflow-y-auto'}>
            <DialogTitle className="text-lg font-semibold uppercase">{editing ? texts.editOne(singular) : texts.newOne(singular)}</DialogTitle>
            <DialogDescription className="sr-only">{texts.dataOf(singular)}</DialogDescription>
            <div className="mt-4">
              <RecordForm
                sections={typeof sections === 'function' ? sections(rows, editing) : sections}
                options={options}
                initial={editing ?? newRow(rows)}
                submitLabel={texts.save}
                onSubmit={submit}
                onCancel={close}
                footer={footer}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {removing && (
        <ConfirmDialog
          title={texts.removeTitle(singular)}
          description={texts.removeBody}
          busy={removeBusy}
          error={removeError}
          onConfirm={() => void confirmRemove()}
          onCancel={() => askRemove(null)}
        />
      )}
    </div>
  )
}
