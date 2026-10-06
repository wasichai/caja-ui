import { client, enviar } from '../api'
import type { PagoDelBuzon, PeticionDeExplicacion } from '../types'

// caja-backend's buzón (/api/caja/pagos/**), as «Pagos sin entregar» of «Cierre y arqueo de caja» uses it

export const pagos = {
  // the MUERTO ones, oldest first. it takes no parameter
  sinEntregar: () => client.request<PagoDelBuzon[]>('/caja/pagos/sin-entregar'),
  claveSinEntregar: ['caja', 'pagos', 'sin-entregar'] as const,
  // MUERTO → EXPLICADO: then its turno closes
  explicar: (pagoId: string, peticion: PeticionDeExplicacion) => enviar<PagoDelBuzon>(`/caja/pagos/${encodeURIComponent(pagoId)}/explicacion`, peticion)
}
