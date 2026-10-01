// copiado de srtm-ui@a1df33a (src/portal/i18n.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { CORE_NAMESPACE } from '@wasichai/core'
import type { i18n as I18n } from 'i18next'

// the portal's wording and number format over the library's: its footers read "1 a 1 de 1 registros" (registros for
// one too) and its figures are grouped as in Perú (12,345; es alone would write 12.345 and leave 1234 ungrouped).
// core nests its strings under a `common` object of its namespace; the override merges over it (and, being the same
// object, over every other instance of the process: all of the portal's take this same override)
export function ajustarI18n(i18n: I18n): void {
  i18n.addResourceBundle('es', CORE_NAMESPACE, { common: { range_one: '{{from, number}} a {{to, number}} de {{count, number}} registros' } }, true, true)
  i18n.services.formatter?.add('number', (value: number) => new Intl.NumberFormat('es-PE').format(value))
}
