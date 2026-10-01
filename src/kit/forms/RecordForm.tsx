// copiado de srtm-ui@a1df33a (src/kit/forms/RecordForm.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { ApiError, type FieldViolation } from '@wasichai/core'
import { Button, cn, Input, Label } from '@wasichai/ui'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useForm, type RegisterOptions, type UseFormReturn } from 'react-hook-form'
import { formatDate } from '../format'
import { useKit } from '../KitProvider'
import type { KitTexts } from '../texts'
import { errorMessage } from '../ui/errorMessage'
import { FieldIdContext, useFieldId } from './fieldId'
import { parseGeometry } from './geometry'
import type { FormLink, SharedFields } from './group'
import { CORE_KINDS } from './kinds'
import { LOCKED, lockedOf } from './locked'
import { dataFields, type FieldSpec, type FormValues, type SectionSpec } from './spec'
import { GRID, SPAN } from './styles'

interface RecordFormProps<T> {
  sections: SectionSpec[]
  // enum options of this entity, by field
  options?: Record<string, string[]>
  initial: T
  submitLabel: string
  onSubmit: (values: T) => Promise<unknown>
  onCancel?: () => void
  cancelLabel?: string
  // a faint line beside the buttons, before the primary one
  note?: string
  // above the sections: what the form does not edit itself (a relation picker)
  children?: ReactNode
  // renders the buttons elsewhere (a wizard's header): the form gets this id
  formId?: string
  hideActions?: boolean
  // below the sections, with the live values (a preview of what they make)
  footer?: (values: FormValues, form: UseFormReturn<FormValues>) => ReactNode
  // fields that start greyed: what a record picked elsewhere filled (forms/locked.ts)
  locked?: string[]
  // edited in place and saved by a button outside it, with other forms (forms/group.ts). while it has no changes it
  // follows `initial`: what another tab or the backend changed of the record shows up
  link?: FormLink
  // fields that are one value with other forms of the page (forms/group.ts): what the clerk sets here goes to them,
  // and theirs comes here
  shared?: SharedFields
}

// one form for every entity. the backend validates again and names the field it rejects:
// that message lands under the field, anything else above the buttons
export function RecordForm<T extends object>({
  sections,
  options,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel,
  note,
  children,
  formId,
  hideActions,
  footer,
  locked,
  link,
  shared
}: RecordFormProps<T>) {
  const { texts, renderAlert } = useKit()
  const fields = dataFields(sections)
  const form = useForm<FormValues>({ defaultValues: { ...toForm(fields, initial as Record<string, unknown>), [LOCKED]: (locked ?? []).join(',') } })
  const {
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = form
  const values = form.watch()
  // a stored record: what an empty field means is told by a function placeholder
  const saved = Boolean((initial as { id?: unknown }).id)
  const [formError, setFormError] = useState<string | null>(null)
  // its inputs' ids: scoped when it shares the page with other forms (forms/fieldId.ts)
  const scope = useId()
  const [fieldId] = useState(() => (link ? (name: string) => `${scope}field-${name}` : (name: string) => `field-${name}`))
  // what it was loaded with: a field that differs is a change
  const loaded = useRef<FormValues>(toForm(fields, initial as Record<string, unknown>))

  // what the clerk edits and can see: read-only and hidden (`when`) fields keep their value
  const sent = (current: FormValues) => fields.filter((f) => !f.readOnly && (!f.when || f.when(current)))
  // as they are sent: a field greyed by the one it depends on (`enabledWhen`) goes empty, and so clears what it had
  const toSend = (current: FormValues): FormValues =>
    Object.fromEntries(fields.map((f) => [f.name, !f.enabledWhen || f.enabledWhen(current) ? (current[f.name] ?? '') : '']))
  const changed = (current: FormValues) => {
    const [now, before] = [toSend(current), toSend(loaded.current)]
    return sent(current).filter((f) => now[f.name] !== before[f.name])
  }
  const output = (current: FormValues) => ({ ...initial, ...fromForm(sent(current), toSend(current)) }) as T
  // the backend names the field it rejects: its message goes under that field, or above the buttons when no control
  // shows it (a hidden field, a geometry, one its `when` hides): see the effect below
  const [fromServer, setFromServer] = useState<FieldViolation[]>([])
  const showErrors = (e: unknown) => {
    const known = e instanceof ApiError ? e.violations.filter((v) => fields.some((f) => f.name === v.field)) : []
    known.forEach((v) => setError(v.field, { type: 'server', message: v.message }))
    setFromServer(known)
    return known.length > 0
  }
  const start = () => {
    setFormError(null)
    setFromServer([])
  }
  // once rendered, the ones whose message no control of the form shows (a custom one that edits hidden fields shows
  // theirs): above the buttons, and off their field, where nothing would clear them
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const noControl = fromServer.filter((v) => !formRef.current?.querySelector(`[id="${fieldId(v.field)}-error"]`))
    if (noControl.length === 0) return
    form.clearErrors(noControl.map((v) => v.field))
    setFormError(noControl.map((v) => `${fields.find((f) => f.name === v.field)?.label ?? v.field}: ${v.message}`).join(' · '))
    // only for a new refusal: the helpers above are new every render
  }, [fromServer])

  const submit = handleSubmit(async (current) => {
    start()
    try {
      await onSubmit(output(current))
    } catch (e) {
      if (!showErrors(e)) setFormError(errorMessage(e, texts.saveFailed))
    }
  })

  const pending = link !== undefined && changed(values).length > 0
  // once valid, what `send` makes of the values; null while not
  const valid = <R,>(send: (current: FormValues) => R) =>
    new Promise<R | null>((resolve) => {
      start()
      void handleSubmit(
        (current) => resolve(send(current)),
        () => resolve(null)
      )()
    })
  useEffect(() => {
    link?.handle?.({
      changes: () => valid((current) => fromForm(changed(current), toSend(current))),
      values: () => valid((current) => output(current) as Record<string, unknown>),
      errors: showErrors
    })
  })
  useEffect(() => link?.pending?.(pending), [link, pending])
  useEffect(
    () => () => {
      link?.handle?.(null)
      link?.pending?.(false)
    },
    [link]
  )
  const first = JSON.stringify(toForm(fields, initial as Record<string, unknown>))
  useEffect(() => {
    if (!link || first === JSON.stringify(loaded.current) || changed(form.getValues()).length > 0) return
    loaded.current = JSON.parse(first) as FormValues
    form.reset({ ...loaded.current, [LOCKED]: form.getValues(LOCKED) ?? '' })
    // only for a record read again: the helpers above are new every render
  }, [first])

  // a field one with other forms (`shared`): the clerk's change here goes to them, theirs comes here
  const changeShared = shared?.change
  const sharedFields = shared?.fields
  useEffect(() => {
    if (!changeShared || !sharedFields) return
    const { unsubscribe } = form.watch((current, { name, type }) => {
      if (type === 'change' && name && sharedFields.includes(name)) changeShared(name, current[name] ?? '')
    })
    return unsubscribe
  }, [form, changeShared, sharedFields])
  const fromOthers = JSON.stringify(shared?.values ?? {})
  useEffect(() => {
    for (const [name, value] of Object.entries(JSON.parse(fromOthers) as FormValues)) {
      if (fields.some((f) => f.name === name) && (form.getValues(name) ?? '') !== value)
        form.setValue(name, value, { shouldValidate: form.formState.isSubmitted })
    }
    // only when another form changed them: the fields are new every render
  }, [fromOthers])

  const content = (
    <form ref={formRef} id={formId} onSubmit={submit} noValidate className="space-y-6">
      {children}
      {sections.map((section) => (
        <fieldset key={section.id} data-ui="record-fieldset">
          <legend data-ui="record-legend" className="mb-3 flex w-full items-center gap-2 text-xs font-semibold tracking-wide text-ink uppercase">
            {section.number !== undefined && (
              <span data-ui="record-number" className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand">
                {section.number}
              </span>
            )}
            <span data-ui="record-title">{section.title}</span>
            {section.action && (
              <span data-ui="record-action" className="ml-auto font-normal tracking-normal normal-case">
                {section.action(form)}
              </span>
            )}
          </legend>
          <div className={GRID}>
            {section.fields.map((field) => (
              <Field key={field.name} field={field} form={form} values={values} options={options?.[field.name]} saved={saved} />
            ))}
          </div>
        </fieldset>
      ))}
      {footer?.(values, form)}
      {formError && renderAlert(formError)}
      {!hideActions && (
        // a theme may spread it: the cancel on the left, the note and the primary on the right
        <div data-ui="record-acciones" className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              {cancelLabel ?? texts.cancel}
            </Button>
          )}
          {note && (
            <p data-ui="record-nota" className="self-center text-sm text-ink-muted">
              {note}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? texts.saving : submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
  return <FieldIdContext value={fieldId}>{content}</FieldIdContext>
}

function Field({
  field,
  form,
  values,
  options,
  saved
}: {
  field: FieldSpec
  form: UseFormReturn<FormValues>
  values: FormValues
  options?: string[]
  saved: boolean
}) {
  const { texts, enumLabel, kinds } = useKit()
  const rules: RegisterOptions<FormValues, string> = {
    validate: (value, all) => validate(field, value ?? '', all, texts),
    onChange: field.onChange && (() => field.onChange?.(form)),
    onBlur: field.onBlur && (() => field.onBlur?.(form))
  }
  const fieldId = useFieldId()
  if (field.kind === 'hidden' || field.kind === 'geometry') {
    // no input: a custom field writes it. registered so `required` still holds
    form.register(field.name, rules)
    return null
  }
  if (field.when && !field.when(values)) return null
  if (field.kind === 'custom') return <div className={cn(SPAN[field.span ?? 6])}>{field.render?.(form)}</div>

  const id = fieldId(field.name)
  const error = form.formState.errors[field.name]?.message
  const enabled = !field.enabledWhen || field.enabledWhen(values)
  const locked = lockedOf(values).includes(field.name) || !!field.lockedWhen?.(values)
  const required = enabled && isRequired(field, values)
  const aria = { id, 'aria-invalid': error ? (true as const) : undefined, 'aria-describedby': error ? `${id}-error` : undefined }

  let control: ReactNode
  if (!enabled && !field.readOnly) {
    const shown = field.greyedValue?.(values, form.formState.defaultValues as FormValues) ?? ''
    control = <Input {...aria} disabled value={shown} placeholder={field.kind === 'date' ? texts.datePlaceholder : field.kind === 'enum' ? texts.select : ''} />
  } else if (field.readOnly || locked) {
    // a locked field is still the form's: registered, so it is validated and sent
    if (locked) form.register(field.name, rules)
    const value = field.kind === 'enum' ? enumLabel(field.name, values[field.name] ?? '') : (values[field.name] ?? '')
    // empty stays empty, so the placeholder (a function one: what an empty value means) shows instead of a dash
    const placeholder = typeof field.placeholder === 'function' ? field.placeholder({ values, saved }) : field.placeholder
    control = <Input {...aria} disabled value={field.kind === 'date' && value ? formatDate(value) : value} placeholder={placeholder} />
  } else {
    const Kind = { ...CORE_KINDS, ...kinds }[field.kind ?? 'text'] ?? CORE_KINDS.text
    control = <Kind field={field} form={form} values={values} options={options} aria={aria} rules={rules} />
  }

  return (
    <div className={cn('space-y-1.5', SPAN[field.span ?? 2])}>
      {/* one line, whatever the label's length: the inputs of a row stay aligned */}
      <Label htmlFor={id} id={`${id}-label`} title={field.label} className="block truncate">
        {field.label}
        {required && !field.readOnly && <span className="text-danger"> *</span>}
      </Label>
      {control}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function isRequired(field: FieldSpec, values: FormValues): boolean {
  return typeof field.required === 'function' ? field.required(values) : field.required === true
}

function validate(field: FieldSpec, value: string, values: FormValues, texts: KitTexts): true | string {
  if (field.readOnly || (field.when && !field.when(values)) || (field.enabledWhen && !field.enabledWhen(values))) return true
  const text = value.trim()
  if (!text) return isRequired(field, values) ? texts.required : true
  if (field.kind === 'integer') return /^-?\d+$/.test(text) || texts.integer
  if (field.kind === 'decimal' || field.kind === 'money') return /^-?\d+([.,]\d+)?$/.test(text) || texts.number
  return field.validate ? field.validate(text, values) : true
}

function toForm(fields: FieldSpec[], values: Record<string, unknown>): FormValues {
  return Object.fromEntries(
    fields.map((f) => {
      const value = values[f.name]
      if (value === null || value === undefined) return [f.name, '']
      // a geometry rides in its hidden field as geojson text
      return [f.name, f.kind === 'geometry' ? JSON.stringify(value) : String(value)]
    })
  )
}

// blanks go back as null: the backend then clears the field instead of keeping the old value
function fromForm(fields: FieldSpec[], values: FormValues): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => {
      const text = (values[f.name] ?? '').trim()
      if (text === '') return [f.name, null]
      if (f.kind === 'integer' || f.kind === 'month' || f.kind === 'year') return [f.name, Number.parseInt(text, 10)]
      if (f.kind === 'decimal' || f.kind === 'money') return [f.name, Number(text.replace(',', '.'))]
      if (f.kind === 'boolean') return [f.name, text === 'true']
      if (f.kind === 'geometry') return [f.name, parseGeometry(text)]
      return [f.name, text]
    })
  )
}
