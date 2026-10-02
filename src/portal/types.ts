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

// a line of a recibo, or of a preview: what one order costs
export interface LineaDeRecibo {
  orden_id: string | null
  sistema_origen: string | null
  concepto: string | null
  detalle: string | null
  referencia_externa: string | null
  monto: Cifra
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
