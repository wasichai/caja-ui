import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { diaEnLima } from '../fechas'
import { loQueFalta, type Oferta, type Par } from '../shell/navTree'
import type { ReciboEnFicha } from '../types'

// why «Anular» or «Duplicado en PDF» cannot go, or null: never a mute button (caja ADR-0044). the reasons go in the
// order they are fixed in, and the first that holds wins: first what does not depend on this screen (the account),
// then what does (the recibo chosen, read, its state, its day, its cashier). the backend checks them all again: this
// only spares the clerk a refusal, and says why

// what POST …/anulacion asks of the account before anything (caja-backend's 403)
const PARA_ANULAR: Par[][] = [[{ objeto: 'anulacion_recibo', accion: 'CREATE' }]]
// what POST …/duplicados asks (its 403: a CAJERO has not)
const PARA_DUPLICAR: Par[][] = [[{ objeto: 'reimpresion_recibo', accion: 'CREATE' }]]
// what the ficha of a recibo reads (GET /recibos/{numero}'s 403): a recibo is not annulled without being seen
const PARA_VER: Par[][] = [['recibo', 'linea_recibo', 'caja', 'tasa', 'anulacion_recibo', 'reimpresion_recibo'].map((objeto) => ({ objeto, accion: 'READ' }))]

// ESPECIAL: another cashier's recibo is annulled by this role (or an ADMIN). wasichai has no actions of caja's own, so
// caja-backend checks it by the role's name, and so does this
export const SUPERVISOR_CAJA = 'SUPERVISOR_CAJA'

// the recibo of the route: none chosen, one that could not be read (with why), or the ficha
export type ElRecibo = { estado: 'sin-recibo' } | { estado: 'ilegible'; error: unknown } | { estado: 'leido'; recibo: ReciboEnFicha }

// the signed-in account, as wasichai says it (useAuth): never made up
export interface LaCuenta {
  can: Oferta['can']
  isAdmin: boolean
  email: string | null
  roles: readonly string[]
}

export function impedimentoDeAnular(cuenta: LaCuenta, elRecibo: ElRecibo, hoy: string): string | null {
  const sinPermiso = loQueFalta(PARA_ANULAR, cuenta.can)
  if (sinPermiso) return `Su cuenta no puede anular: le falta ${sinPermiso}.`
  const sinVer = loQueFalta(PARA_VER, cuenta.can)
  if (sinVer) return `Su cuenta puede anular, pero no puede ver el recibo, y un recibo no se anula sin verlo: le falta ${sinVer}.`
  if (elRecibo.estado === 'sin-recibo') return 'Elija primero un recibo de la lista: aquí no se anula un número tecleado a ciegas.'
  if (elRecibo.estado === 'ilegible') return `Sin ver el recibo no se anula: ${errorMessage(elRecibo.error, 'el backend no contestó')}`
  const { recibo } = elRecibo
  // the backend's estado ANULADO is that it has its anulación
  if (recibo.anulacion) return `Este recibo ya se anuló el ${formatDate(recibo.anulacion.fecha)}: un recibo no se anula dos veces.`
  // ISO dates compare as text: no arithmetic on them. the backend checks its turno's day; this, the day it was issued
  const dia = diaEnLima(recibo.emitido_en)
  if (dia !== null && dia !== hoy)
    return `Este recibo se emitió el ${formatDate(dia)} y hoy es ${formatDate(hoy)}: un recibo solo se anula el mismo día del pago. Lo que corresponde es una devolución.`
  const suyo = cuenta.email !== null && recibo.cajero === cuenta.email
  if (!suyo && !cuenta.isAdmin && !cuenta.roles.includes(SUPERVISOR_CAJA))
    return `Este recibo lo cobró otro cajero (${recibo.cajero}): anularlo exige el rol ${SUPERVISOR_CAJA}, y su cuenta no lo tiene.`
  return null
}

export function impedimentoDeDuplicar(cuenta: LaCuenta, elRecibo: ElRecibo): string | null {
  const sinPermiso = loQueFalta(PARA_DUPLICAR, cuenta.can)
  if (sinPermiso) return `Su cuenta no puede pedir duplicados: le falta ${sinPermiso}.`
  if (elRecibo.estado === 'sin-recibo') return 'Elija primero un recibo de la lista.'
  if (elRecibo.estado === 'ilegible') return `Sin ver el recibo no se pide su duplicado: ${errorMessage(elRecibo.error, 'el backend no contestó')}`
  return null
}
