import { etiqueta } from '../forms/etiquetas'
import { loQueFalta, type Oferta, type Par } from '../shell/navTree'
import type { PagoDelBuzon } from '../types'

// why «Explicar» cannot go, or null: never a mute button (caja ADR-0044). first the account, which is the same for every
// payment, then the payment. the backend checks them all again (its 403 comes before its 400s, its 409 for a payment
// that is not MUERTO): this only spares a refusal, and says why

// what POST …/explicacion asks of the account (its 403): UPDATE on pago_evento, which only SUPERVISOR_CAJA has, and
// READ on recibo
const PARA_EXPLICAR: Par[][] = [
  [
    { objeto: 'pago_evento', accion: 'UPDATE' },
    { objeto: 'recibo', accion: 'READ' }
  ]
]

// only a MUERTO one is explained: a PENDIENTE one is still being delivered, and explaining it would take it off the queue
const MUERTO = 'MUERTO'

export function impedimentoDeLaCuenta(can: Oferta['can']): string | null {
  const sinPermiso = loQueFalta(PARA_EXPLICAR, can)
  return sinPermiso
    ? `Su cuenta no puede explicar pagos sin entregar: le falta ${sinPermiso}. Lo explica una cuenta con ese permiso, que tiene el rol SUPERVISOR_CAJA.`
    : null
}

export function impedimentoDelPago(pago: PagoDelBuzon): string | null {
  if (pago.estado === MUERTO) return null
  const porQue = pago.estado === 'PENDIENTE' ? ': todavía se está intentando entregar' : ''
  return `Solo se explica un pago que no se pudo entregar, y este está «${etiqueta('estado_evento', pago.estado)}»${porQue}.`
}
