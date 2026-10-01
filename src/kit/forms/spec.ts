// copiado de srtm-ui@a1df33a (src/kit/forms/spec.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'

// how an entity shows and edits: sections, labels and value kinds. names are the model's fields.
// a section lays out on six columns; span says how many a field takes

// an app adds its own kinds through KitProvider's kinds
export type FieldKind =
  | 'text'
  | 'longtext'
  | 'enum'
  | 'integer'
  | 'decimal'
  | 'money'
  | 'date'
  | 'month'
  | 'year'
  | 'boolean'
  | 'multi'
  | 'suggest'
  | 'hidden'
  | 'geometry'
  | 'custom'
  | (string & {})

// the form's values, as the inputs hold them (strings)
export type FormValues = Record<string, string>

// what a function placeholder knows. saved: the record is stored (it has an id)
export interface PlaceholderContext {
  values: FormValues
  saved: boolean
}

// kind suggest: free text with suggestions
export interface SuggestSource {
  fetch: (q: string, values: FormValues) => Promise<string[]>
  // the fields the list depends on: a change refetches
  dependsOn?: readonly string[]
}

export interface FieldSpec {
  name: string
  label: string
  kind?: FieldKind
  // a function when it depends on another field
  required?: boolean | ((values: FormValues) => boolean)
  // shown, validated and sent only while this holds
  when?: (values: FormValues) => boolean
  // shown always, but greyed (and neither required nor sent) until this holds
  enabledWhen?: (values: FormValues) => boolean
  // what it shows while greyed, from the live and the stored values (default: nothing)
  greyedValue?: (values: FormValues, stored: FormValues) => string
  // greyed but still validated and sent while this holds, as a locked field
  lockedWhen?: (values: FormValues) => boolean
  // a filled field's own check: true, or the message
  validate?: (value: string, values: FormValues) => true | string
  // what the clerk's own change or leaving the field sets off, once the form holds the value
  onChange?: (form: UseFormReturn<FormValues>) => void
  onBlur?: (form: UseFormReturn<FormValues>) => void
  // kind multi: the choices, kept as one comma-separated text
  choices?: string[]
  // the backend's (a code, a date of record...): shown, never edited
  readOnly?: boolean
  // a string: the input's hint. a function: what an empty value means, shown on a read-only or locked field and in
  // FieldGrid only. an editable input takes string hints only: a function gives it none
  placeholder?: string | ((ctx: PlaceholderContext) => string | undefined)
  span?: 1 | 2 | 3 | 4 | 6
  suggest?: SuggestSource
  // kind year: the oldest year offered; default 100 years back
  yearFrom?: number
  // kind custom: its own inputs, bound to hidden fields of the same form (not sent itself)
  render?: (form: UseFormReturn<FormValues>) => ReactNode
  // kind hidden: listed in the ficha all the same
  shownInFicha?: boolean
}

export interface SectionSpec {
  // stable: React's key now, tenant adjustments later
  id: string
  title: string
  // a numbered circle before the title
  number?: number
  // on the right of the section's title
  action?: (form: UseFormReturn<FormValues>) => ReactNode
  fields: FieldSpec[]
}

// the fields a form sends: everything but the custom ones, which only drive hidden fields
export const dataFields = (sections: SectionSpec[]): FieldSpec[] => sections.flatMap((s) => s.fields).filter((f) => f.kind !== 'custom')

// every field of the sections, empty: the starting point of a "new" form
export function emptyOf<T>(sections: SectionSpec[], extra: Partial<T> = {}): T {
  const empty = Object.fromEntries(dataFields(sections).map((f) => [f.name, null]))
  return { ...empty, ...extra } as T
}
