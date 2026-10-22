import { client, enviar } from '../api'
import type { PagoACuenta, PagoDelBuzon, PeticionDeExplicacion } from '../types'

// caja-backend's buzón (/api/caja/pagos/**), as «Pagos sin entregar» of «Cierre y arqueo de caja» uses it

export const pagos = {
  // the MUERTO ones, oldest first. it takes no parameter
  sinEntregar: () => client.request<PagoDelBuzon[]>('/caja/pagos/sin-entregar'),
  claveSinEntregar: ['caja', 'pagos', 'sin-entregar'] as const,
  // the ones the source received a cuenta in the turnos of a day (fecha is required: without it, a 400)
  aCuenta: (fecha: string) => client.request<PagoACuenta[]>(`/caja/pagos/a-cuenta?${new URLSearchParams({ fecha })}`),
  claveACuenta: ['caja', 'pagos', 'a-cuenta'] as const,
  // MUERTO → EXPLICADO: then its turno closes
  explicar: (pagoId: string, peticion: PeticionDeExplicacion) => enviar<PagoDelBuzon>(`/caja/pagos/${encodeURIComponent(pagoId)}/explicacion`, peticion)
}
