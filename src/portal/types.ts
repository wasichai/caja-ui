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
