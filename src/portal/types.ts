import type { Cifra } from './cifras/Importe'

// what the portal reads from the backend: core's (/api/auth/**) and caja-backend's (/api/caja/**)

// GET /api/auth/me: the account the token belongs to (wasichai's AuthenticatedUser). it has no display name: that one
// comes in POST /api/auth/login's answer, which core keeps (useAuth().user)
export interface CuentaDeWasichai {
  userId: string
  organizationId: string
  email: string
  roles: string[]
}

// --- caja-backend (/api/caja/**): its keys are snake_case, its amounts { importe, actualizado_a } in a string (Cifra) ---

// a page of a list of caja-backend
export interface Pagina<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

// GET /api/caja/cajas: one closed comes too, with activa false; one with no area, with its area in null
export interface CajaEnLista {
  codigo: string
  nombre: string | null
  serie: string | null
  area_codigo: string | null
  area_nombre: string | null
  activa: boolean | null
}

// GET /api/caja/ordenes-de-cobro: an order a source system sent, by its fecha_exigibilidad
export interface OrdenDeCobro {
  orden_id: string
  sistema_origen: string | null
  referencia_externa: string | null
  concepto: string | null
  detalle: string | null
  importe: Cifra
  fecha_exigibilidad: string | null
  pagador_documento: string | null
  pagador_nombre: string | null
  pagador_externo_id: number | null
  estado: string | null
  observacion: string | null
}

// a line of a recibo, or of a preview: what one order costs, or one tasa. a tasa's has its codigo, its cantidad and its
// precio_unitario, which an order's does not carry (caja-backend leaves them out)
export interface LineaDeRecibo {
  orden_id: string | null
  sistema_origen: string | null
  concepto: string | null
  detalle: string | null
  referencia_externa: string | null
  monto: Cifra
  codigo?: string
  cantidad?: number
  precio_unitario?: Cifra
}

// POST /api/caja/cobros/vista-previa: what cobrar those orders would be today, written nowhere. total null when no
// line is left; motivos, what keeps it from being cobrable, to be said as they come
export interface VistaPrevia {
  lineas: LineaDeRecibo[]
  total: Cifra | null
  cobrable: boolean
  motivos: string[]
}

// the forms of payment caja-backend takes (forma_pago)
export const FORMAS_DE_PAGO = ['EFECTIVO', 'CHEQUE', 'DEPOSITO', 'TARJETA', 'TRANSFERENCIA'] as const
export type FormaDePago = (typeof FORMAS_DE_PAGO)[number]

// POST /api/caja/cobros: what the clerk sends. no cajero nor fecha_de_pago: the backend takes the session's and today
export interface NuevoCobro {
  caja: string
  forma_pago: string
  ordenes: string[]
  observacion: string
}

export interface Recibo {
  numero_impreso: string
  serie: string
  numero: number
  cajero: string
  // the payer as caja-backend kept it (the document trimmed and in capitals); all three null on an anonymous recibo of
  // tasas
  pagador_documento: string | null
  pagador_nombre: string | null
  pagador_externo_id: number | null
  forma_pago: string
  tipo_pago: string
  emitido_en: string
  total: Cifra
  lineas: LineaDeRecibo[]
}

// its answer: 201 with emitido true, or 200 with emitido false when the same Idempotency-Key is sent again (the same
// recibo, charged once)
export interface CobroHecho {
  recibo: Recibo
  pago_id: string | null
  estado_del_pago: string
  emitido: boolean
}

// GET /api/caja/tasas?vigentes_a=: a tasa in force that day, by code, with its price as of it. its area is the code
export interface TasaVigente {
  codigo: string
  descripcion: string | null
  area: string | null
  partida_presupuestal: string | null
  precio: Cifra
}

// a concepto the clerk adds: the tasa's code and how many times, never a price (the backend takes the tarifa in force)
export interface ConceptoPedido {
  codigo: string
  cantidad: number
}

// POST /api/caja/cobros/tasas: what the clerk sends. the payer may be anonymous: its keys go only when typed. no cajero
// nor fecha_de_cobro: the backend takes the session's and today
export interface NuevoCobroDeTasas {
  caja: string
  forma_pago: string
  conceptos: ConceptoPedido[]
  observacion: string
  pagador_documento?: string
  pagador_nombre?: string
}

// --- the recibo after it was issued (/api/caja/recibos/**) ---

// EMITIDO, or ANULADO once an anulación was added: the recibo itself is never changed
export const ESTADOS_DE_RECIBO = ['EMITIDO', 'ANULADO'] as const

// GET /api/caja/recibos: a row of the list, with no lines (the ficha has them). the total as the recibo froze it
export interface ReciboEnLista {
  numero_impreso: string
  emitido_en: string
  pagador_documento: string | null
  pagador_nombre: string | null
  total: Cifra
  forma_pago: string
  duplicados: number
  estado: string
}

// what the ficha says of an annulment: the day, the motive, who authorized it, the memorandum and who did it
export interface AnulacionEnFicha {
  fecha: string
  motivo: string
  autorizado_por: string | null
  documento_autorizacion: string | null
  usuario: string
}

// GET /api/caja/recibos/{numero_impreso}: the recibo as it was issued, its state, its reprints and its annulment
export interface ReciboEnFicha {
  numero_impreso: string
  serie: string
  numero: number
  caja: string | null
  cajero: string
  emitido_en: string
  pagador_documento: string | null
  pagador_nombre: string | null
  pagador_externo_id: number | null
  forma_pago: string
  tipo_pago: string
  total: Cifra
  observacion: string | null
  lineas: LineaDeRecibo[]
  estado: string
  duplicados: number
  anulacion: AnulacionEnFicha | null
}

// POST /api/caja/recibos/{numero_impreso}/anulacion: the act. the optional keys go only when typed
export interface PeticionDeAnulacion {
  motivo: string
  autorizado_por?: string
  documento_autorizacion?: string
  observacion: string
}

// its answer (201): the record of the annulment. pago_anulado_id is null on a recibo of tasas
export interface AnulacionHecha {
  numero_impreso: string
  estado: string
  fecha: string
  motivo: string
  autorizado_por: string | null
  documento_autorizacion: string | null
  usuario: string
  importe: Cifra
  pago_anulado_id: string | null
}

// --- the turno of the clerk, its arqueo, its cierre and its reversal (/api/caja/turnos/**) ---

// GET /api/caja/turnos/del-dia: a turno of today, by the code of its caja, with when it was opened and its state
// (ABIERTO or CERRADO, worked out by the backend)
export interface TurnoEnElDia {
  turno_id: string
  caja: string | null
  caja_nombre: string | null
  cajero: string
  fecha: string
  abierto_en: string
  estado_del_turno: string
}

// the clerk's turnos of today and their situation: SIN_ABRIR (none), ABIERTO (exactly one open), CERRADO (all closed)
// or VARIOS_ABIERTOS (open in more than one caja). asking opens nothing
export interface TurnoDelDia {
  cajero: string
  fecha: string
  situacion: string
  turnos: TurnoEnElDia[]
}

// a line of the arqueo, one per forma de pago with movement (or with something declared, in a cierre). live, declarado
// and diferencia are null: nobody has counted, and a 0 would read as «counted zero»
export interface LineaDeArqueo {
  forma_pago: string
  cobrado: Cifra
  anulado: Cifra
  neto: Cifra
  declarado: Cifra | null
  diferencia: Cifra | null
}

// the arqueo, every figure the backend's as of the turno's day. live, total_declarado, diferencia and cuadra are null
export interface Arqueo {
  lineas: LineaDeArqueo[]
  recibos_emitidos: number
  recibos_anulados: number
  total_cobrado: Cifra
  total_anulado: Cifra
  neto: Cifra
  total_declarado: Cifra | null
  diferencia: Cifra | null
  cuadra: boolean | null
}

// a payment its source system does not know yet (PENDIENTE or MUERTO): it keeps the turno from closing
export interface PagoSinEntregar {
  pago_id: string
  tipo: string
  estado: string
}

// the acta of the last cierre in force of a closed turno, as it was kept: the arqueo as declared, as of the turno's day
// (the same shape and values as the arqueo of POST /turnos/cierre's 201)
export interface CierreVigente {
  cierre_id: string
  secuencia: number
  fecha: string
  registrado_en: string
  usuario: string
  observacion: string
  arqueo: Arqueo
  cobrado_con_evento: Cifra
  cobrado_sin_evento: Cifra
}

// GET /api/caja/turnos/{turno_id}/arqueo: the live arqueo, its two halves, what keeps it from closing and, with the
// turno closed, the acta of its cierre in force (null while it is open, also after a reversal)
export interface ArqueoDelTurno {
  turno_id: string
  estado_del_turno: string
  puede_cerrar: boolean
  arqueo: Arqueo
  cobrado_con_evento: Cifra
  cobrado_sin_evento: Cifra
  lo_que_impide_cerrar: PagoSinEntregar[]
  cierre_vigente: CierreVigente | null
}

// POST /api/caja/turnos/cierre: what was counted by forma de pago, as the text typed (never a number: the backend reads
// the decimal string). no cajero: the backend takes the session's
export interface PeticionDeCierre {
  caja: string
  fecha: string
  declarado: Record<string, string>
  observacion: string
}

// its answer (201): the acta, with the arqueo as declared and its diferencia, the backend's
export interface CierreHecho {
  cierre_id: string
  turno_id: string
  caja: string
  cajero: string
  fecha: string
  secuencia: number
  registrado_en: string
  usuario: string
  observacion: string
  estado_del_turno: string
  arqueo: Arqueo
  cobrado_con_evento: Cifra
  cobrado_sin_evento: Cifra
}

// POST /api/caja/turnos/reversion
export interface PeticionDeReversion {
  caja: string
  fecha: string
  motivo: string
  observacion: string
}

// its answer (201): the cierre it leaves without effect stays where it was, and the turno is open again
export interface ReversionHecha {
  reversion_id: string
  turno_id: string
  caja: string
  cajero: string
  fecha: string
  secuencia: number
  cierre_revertido: string
  motivo: string
  registrado_en: string
  usuario: string
  observacion: string
  estado_del_turno: string
}

// --- the payments not delivered and their explanation (/api/caja/pagos/**) ---

// a row of GET /api/caja/pagos/sin-entregar (a list, not a page: the MUERTO ones, oldest first), and the answer of
// POST …/explicacion, with the same shape. recibo is null when the recibo could not be read; ultimo_error comes cut to
// 400 characters, without credentials; creado_en is when it was charged, in Lima's offset
export interface PagoDelBuzon {
  pago_id: string
  tipo: string
  destino: string
  recibo: string | null
  turno_id: string | null
  estado: string
  intentos: number
  ultimo_error: string | null
  creado_en: string | null
  entregado_en: string | null
  explicacion: string | null
}

// POST /api/caja/pagos/{pago_id}/explicacion: what happened and what was done (kept in the event), and the observación
// (kept in the audit). any other key is a 400
export interface PeticionDeExplicacion {
  explicacion: string
  observacion: string
}

// --- what was collected and the reconciliation of a day (/api/caja/recaudacion/**, /api/caja/conciliacion) ---
// aggregates, never paged: every total is the backend's, as of a_la_fecha (the day it was read)

// a row of the avance: by source system (the orders' sistema_origen, or TASA). origen is null only on a recibo of orders
// with no line of its cobro: the datum does not exist
export interface FilaDeOrigen {
  origen: string | null
  cobrado: Cifra
  anulado: Cifra
  neto: Cifra
}

// the turno of today of the caja and the cajero asked for, with its live arqueo (declarado, diferencia and cuadra null)
export interface TurnoDelAvance {
  turno_id: string
  caja: string
  cajero: string
  fecha: string
  estado_del_turno: string
  arqueo: Arqueo
}

// GET /api/caja/recaudacion/avance?desde=&hasta=&origen=&caja=&cajero=: desde and hasta are the range the backend took
// (its defaults when none was asked for). turno, only with caja and cajero
export interface AvanceDeRecaudacion {
  desde: string
  hasta: string
  a_la_fecha: string
  filas: FilaDeOrigen[]
  cobrado: Cifra
  anulado: Cifra
  neto: Cifra
  turno: TurnoDelAvance | null
}

// a row of the recaudación por área: one per (área, partida, concepto). what was charged by orders has no área nor
// partida (null: the datum does not exist), and its concepto is its source system; a tasa's concepto is its code
export interface FilaDePartida {
  area: string | null
  area_nombre: string | null
  partida: string | null
  concepto: string | null
  cobrado: Cifra
  anulado: Cifra
  neto: Cifra
}

// GET /api/caja/recaudacion/por-area?area=&desde=&hasta=: neto_sin_partida is what was charged by orders, said apart
export interface RecaudacionPorArea {
  desde: string
  hasta: string
  a_la_fecha: string
  filas: FilaDePartida[]
  neto: Cifra
  neto_sin_partida: Cifra
}

// a line of the reconciliation, per destination system: the buzón's counts and the recibos' figures, and what the
// source system says (recibidos, aplicados, rechazados, importe_aplicado) with the diferencia. when the source did not
// answer, could not be read or is not configured, those five are null, never 0, and por_que_no_se_sabe says why
export interface LineaDeConciliacion {
  sistema_destino: string
  registrados: number
  anulados: number
  en_transito: number
  muertos: number
  explicados: number
  cobrado: Cifra
  anulado: Cifra
  neto: Cifra
  recibidos: number | null
  aplicados: number | null
  rechazados: number | null
  importe_aplicado: Cifra | null
  diferencia: Cifra | null
  por_que_no_se_sabe: string | null
  cuadra: boolean
}

// GET /api/caja/conciliacion?fecha=: the day reconciled, the day it was read, whether every line squares, and the lines
export interface ConciliacionDelDia {
  fecha: string
  a_la_fecha: string
  cuadra: boolean
  lineas: LineaDeConciliacion[]
}
