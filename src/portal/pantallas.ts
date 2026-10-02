import type { ComponentType } from 'react'
import { CajaTributariaPage } from './cobro/CajaTributariaPage'
import { AvanceDeRecaudacionPage } from './recaudacion/AvanceDeRecaudacionPage'
import { RecaudacionPorAreaPage } from './recaudacion/RecaudacionPorAreaPage'
import { DuplicadoReciboPage } from './recibo/DuplicadoReciboPage'
import type { ClaveDeHoja } from './shell/navTree'
import { CajaTasasPage } from './tasas/CajaTasasPage'
import { CierreCajaPage } from './turno/CierreCajaPage'

// the screen of each leaf of the tree, by its key. a leaf with none is not drawn, since a menu entry that leads
// nowhere is a defect (caja ADR-0044): each screen's PR registers it here
export const PANTALLAS: Partial<Record<ClaveDeHoja, ComponentType>> = {
  'caja-tributaria': CajaTributariaPage,
  'caja-tasas': CajaTasasPage,
  'duplicado-recibo': DuplicadoReciboPage,
  'cierre-caja': CierreCajaPage,
  'avance-recaudacion': AvanceDeRecaudacionPage,
  'recaudacion-area': RecaudacionPorAreaPage
}
