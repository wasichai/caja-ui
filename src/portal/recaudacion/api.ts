import { client } from '../api'
import type { AvanceDeRecaudacion, ConciliacionDelDia, RecaudacionPorArea } from '../types'

// caja-backend's recaudación and reconciliation (/api/caja/recaudacion/**, /api/caja/conciliacion), as «Avance de
// recaudación», «Recaudación por área» and the block «Conciliación del día» of «Cierre y arqueo de caja» use them.
// aggregates: none is paged, and every total is the backend's

// the filters of each, in the order the url and the query carry them. all optional: an empty one is not sent, and the
// backend takes its own default (no hasta: today; no desde: the 1st of January of hasta's year)
export const FILTROS_DEL_AVANCE = ['desde', 'hasta', 'origen', 'caja', 'cajero'] as const
export const FILTROS_POR_AREA = ['area', 'desde', 'hasta'] as const

export type Filtros<F extends string> = Record<F, string>

// the query of what was asked for, without what is empty
function consulta<F extends string>(nombres: readonly F[], filtros: Filtros<F>): string {
  const params = new URLSearchParams()
  for (const nombre of nombres) if (filtros[nombre]) params.set(nombre, filtros[nombre])
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

export const recaudacion = {
  avance: (filtros: Filtros<(typeof FILTROS_DEL_AVANCE)[number]>) =>
    client.request<AvanceDeRecaudacion>(`/caja/recaudacion/avance${consulta(FILTROS_DEL_AVANCE, filtros)}`),
  porArea: (filtros: Filtros<(typeof FILTROS_POR_AREA)[number]>) =>
    client.request<RecaudacionPorArea>(`/caja/recaudacion/por-area${consulta(FILTROS_POR_AREA, filtros)}`),
  // the day is required: the one chosen, never «today» by default
  conciliacion: (fecha: string) => client.request<ConciliacionDelDia>(`/caja/conciliacion?${new URLSearchParams({ fecha })}`)
}
