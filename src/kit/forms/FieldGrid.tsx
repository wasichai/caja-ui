// copiado de srtm-ui@a1df33a (src/kit/forms/FieldGrid.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { cn } from '@wasichai/ui'
import { formatDate, formatMoney, formatNumber, formatText } from '../format'
import { useKit, type KitConfig } from '../KitProvider'
import type { FieldSpec, FormValues, SectionSpec } from './spec'
import { GRID, SPAN } from './styles'

// the read-only side of a ficha: label over value, section by section, on the same grid as the form
export function FieldGrid({ sections, values }: { sections: SectionSpec[]; values: object }) {
  const kit = useKit()
  const record = values as Record<string, unknown>
  const asForm = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])) as FormValues
  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const shown = section.fields.filter(
          (f) => (f.kind !== 'hidden' || f.shownInFicha) && f.kind !== 'geometry' && f.kind !== 'custom' && (!f.when || f.when(asForm))
        )
        if (shown.length === 0) return null
        return (
          <section key={section.id} data-ui="ficha-seccion">
            <h3 data-ui="ficha-titulo" className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink uppercase">
              {section.number !== undefined && (
                <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand">{section.number}</span>
              )}
              {section.title}
            </h3>
            <dl data-ui="ficha-kv" className={GRID}>
              {shown.map((field) => (
                <div key={field.name} className={cn(SPAN[field.span ?? 2])}>
                  <dt className="text-xs text-ink-muted">{field.label}</dt>
                  <dd className="mt-0.5 text-sm break-words text-ink">{display(field, record[field.name], asForm, kit)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}

function display(field: FieldSpec, value: unknown, values: FormValues, { texts, enumLabel }: KitConfig): string {
  // greyed by the field it depends on: what the form shows then (saving it sends it empty)
  if (field.enabledWhen && !field.enabledWhen(values)) return formatText(field.greyedValue?.(values, values))
  // a stored record without it: what its function placeholder says that means
  if (typeof field.placeholder === 'function' && (value === null || value === undefined || value === ''))
    return field.placeholder({ values, saved: true }) ?? '—'
  if (field.kind === 'money') return formatMoney(value as number | null)
  if (field.kind === 'decimal') return formatNumber(value as number | null)
  if (field.kind === 'date') return formatDate(value as string | null)
  if (field.kind === 'month') return typeof value === 'number' ? (texts.months[value - 1] ?? String(value)) : '—'
  if (field.kind === 'boolean') return value === true ? texts.yes : value === false ? texts.no : '—'
  if (field.kind === 'enum' && typeof value === 'string') return formatText(enumLabel(field.name, value))
  // several options, kept as one text
  if (field.kind === 'multi' && typeof value === 'string')
    return formatText(
      value
        .split(',')
        .map((v) => enumLabel(field.name, v.trim()))
        .join(', ')
    )
  return formatText(value as string | number | null)
}
