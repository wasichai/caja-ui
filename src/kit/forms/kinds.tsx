// copiado de srtm-ui@a1df33a (src/kit/forms/kinds.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { Input, Textarea } from '@wasichai/ui'
import type { ReactNode } from 'react'
import type { RegisterOptions, UseFormReturn } from 'react-hook-form'
import { currentYear } from '../format'
import { useKit, type KitConfig } from '../KitProvider'
import { NativeSelect } from './NativeSelect'
import type { FieldSpec, FormValues } from './spec'
import { SuggestInput } from './SuggestInput'

// the control of an editable field, by its kind. an app adds its own through KitProvider's kinds

export interface KindProps {
  field: FieldSpec
  form: UseFormReturn<FormValues>
  // the live values
  values: FormValues
  // kind enum: the options of the field
  options?: string[]
  // the input's id, and its error's when it has one
  aria: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }
  // what the control registers with: the field's validation and its onChange and onBlur
  rules: RegisterOptions<FormValues, string>
}

export type KindRenderer = (props: KindProps) => ReactNode

// a string placeholder is the input's hint. a function one tells what an empty read-only value means
const hint = (field: FieldSpec) => (typeof field.placeholder === 'string' ? field.placeholder : undefined)

interface Choice {
  value: string
  label: string
}

// a native select over the choices. a stored value they no longer offer (an imported record) is still shown, not
// silently dropped
function select({ field, form, values, aria, rules }: KindProps, choices: Choice[], { texts, enumLabel }: KitConfig) {
  const stored = values[field.name]
  const all = stored && !choices.some((c) => c.value === stored) ? [{ value: stored, label: enumLabel(field.name, stored) }, ...choices] : choices
  return (
    <NativeSelect {...aria} {...form.register(field.name, rules)}>
      <option value="">{texts.select}</option>
      {all.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </NativeSelect>
  )
}

function EnumKind(props: KindProps) {
  const kit = useKit()
  return select(
    props,
    (props.options ?? []).map((o) => ({ value: o, label: kit.enumLabel(props.field.name, o) })),
    kit
  )
}

function BooleanKind(props: KindProps) {
  const kit = useKit()
  return select(
    props,
    [
      { value: 'true', label: kit.texts.yes },
      { value: 'false', label: kit.texts.no }
    ],
    kit
  )
}

function MonthKind(props: KindProps) {
  const kit = useKit()
  return select(
    props,
    kit.texts.months.map((label, i) => ({ value: String(i + 1), label })),
    kit
  )
}

// this year down to yearFrom
function YearKind(props: KindProps) {
  const kit = useKit()
  const to = currentYear()
  const from = props.field.yearFrom ?? to - 100
  const years = Array.from({ length: to - from + 1 }, (_, i) => String(to - i))
  return select(
    props,
    years.map((year) => ({ value: year, label: year })),
    kit
  )
}

// several choices, kept as one comma-separated text
function MultiKind({ field, form, values, aria, rules }: KindProps) {
  const { enumLabel } = useKit()
  const picked = (values[field.name] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  form.register(field.name, rules)
  const toggle = (choice: string) => {
    const next = picked.includes(choice) ? picked.filter((p) => p !== choice) : [...picked, choice]
    form.setValue(field.name, next.join(', '), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  }
  return (
    <div
      role="group"
      aria-labelledby={`${aria.id}-label`}
      aria-invalid={aria['aria-invalid']}
      className="flex min-h-9 flex-wrap gap-x-4 gap-y-1 rounded-md border border-border bg-surface px-3 py-1.5 aria-[invalid=true]:border-danger"
    >
      {(field.choices ?? []).map((choice) => (
        <label key={choice} className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={picked.includes(choice)} onChange={() => toggle(choice)} className="accent-brand" />
          {enumLabel(field.name, choice)}
        </label>
      ))}
    </div>
  )
}

function LongtextKind({ field, form, aria, rules }: KindProps) {
  return <Textarea {...aria} {...form.register(field.name, rules)} placeholder={hint(field)} rows={2} />
}

// free text with suggestions: asked again when a field it depends on changes
function SuggestKind(props: KindProps) {
  const { field, form, values, aria, rules } = props
  const suggest = field.suggest
  if (!suggest) return <TextKind {...props} />
  return (
    <SuggestInput
      {...aria}
      {...form.register(field.name, rules)}
      value={values[field.name] ?? ''}
      placeholder={hint(field)}
      queryKey={[field.name, ...(suggest.dependsOn ?? []).map((n) => values[n])]}
      fetch={(q) => suggest.fetch(q, form.getValues())}
    />
  )
}

// text, and the kinds typed as text: numbers, money and dates
function TextKind({ field, form, aria, rules }: KindProps) {
  const type = field.kind === 'date' ? 'date' : 'text'
  const numeric = field.kind === 'integer' || field.kind === 'decimal' || field.kind === 'money'
  return <Input {...aria} {...form.register(field.name, rules)} type={type} inputMode={numeric ? 'decimal' : undefined} placeholder={hint(field)} />
}

export const CORE_KINDS: Record<string, KindRenderer> = {
  multi: MultiKind,
  enum: EnumKind,
  boolean: BooleanKind,
  month: MonthKind,
  year: YearKind,
  longtext: LongtextKind,
  suggest: SuggestKind,
  text: TextKind
}
