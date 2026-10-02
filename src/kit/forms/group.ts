// copiado de srtm-ui@a1df33a (src/kit/forms/group.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { useCallback, useRef, useState } from 'react'
import type { FormValues } from './spec'

// forms edited in place and saved by one button outside them (a page's header saves all its tabs at once)

// what such a form hands over
export interface FormHandle {
  // once the form is valid, what the clerk changed in it (the fields it sends, as it sends them); null while it is
  // not: the errors show under the fields
  changes: () => Promise<Record<string, unknown> | null>
  // the same, but everything it sends (as its onSubmit gets it): what a wizard presents
  values: () => Promise<Record<string, unknown> | null>
  // the backend's violations of this form's fields, under them (above its buttons the ones with no input): whether it
  // had any
  errors: (error: unknown) => boolean
}

// RecordForm's `link`: where its handle goes, and where it says whether it has changes
export interface FormLink {
  handle?: (handle: FormHandle | null) => void
  pending?: (pending: boolean) => void
}

// the forms of a page, by name: which have changes (in the order given), and their changes once all are valid
export function useFormGroup<N extends string>(names: readonly N[]) {
  const handles = useRef(new Map<N, FormHandle>())
  const [withChanges, setWithChanges] = useState<N[]>([])
  const [links] = useState(
    () =>
      Object.fromEntries(
        names.map((name): [N, FormLink] => [
          name,
          {
            handle: (handle) => {
              if (handle) handles.current.set(name, handle)
              else handles.current.delete(name)
            },
            pending: (pending) =>
              setWithChanges((current) => (pending ? (current.includes(name) ? current : [...current, name]) : current.filter((n) => n !== name)))
          }
        ])
      ) as Record<N, FormLink>
  )
  const pending = names.filter((name) => withChanges.includes(name))

  // every pending form is validated (each shows its own errors): their changes, and the ones not valid
  const changes = async () => {
    const values: Partial<Record<N, Record<string, unknown>>> = {}
    const invalid: N[] = []
    for (const name of pending) {
      const handle = handles.current.get(name)
      if (!handle) continue
      const changed = await handle.changes()
      if (changed) values[name] = changed
      else invalid.push(name)
    }
    return { values, invalid }
  }
  // one form's values, once valid; null while it is not (or it is not there)
  const values = async (name: N) => (await handles.current.get(name)?.values()) ?? null
  // the backend's refusal, to the forms it may be about: the ones that took a violation of one of their fields
  const errors = (error: unknown, of: N[]) => names.filter((name) => of.includes(name) && handles.current.get(name)?.errors(error))

  return { links, pending, changes, values, errors }
}

// RecordForm's `shared`: fields that are one value in several forms of a page. what the clerk sets in one, the others
// take
export interface SharedFields {
  fields: readonly string[]
  // the last value the clerk set, by field: none until then
  values: FormValues
  change: (name: string, value: string) => void
}

// those fields, for the forms of a page. empty again (reset) when the forms start over from the record
export function useSharedFields(fields: readonly string[]) {
  const [values, setValues] = useState<FormValues>({})
  const change = useCallback((name: string, value: string) => setValues((current) => (current[name] === value ? current : { ...current, [name]: value })), [])
  const reset = useCallback(() => setValues({}), [])
  return { fields, values, change, reset }
}
