import { client, enviar } from '../api'
import type { CajaEnLista, CobroHecho, CobroSinVerificar, NuevoCobro, OrdenDeCobro, Pagina, VistaPrevia } from '../types'

// caja-backend's cobro (/api/caja/**), as the screens of the cash desk use it. the largest page the backend gives
// (wasichai's PageRequest.MAX_SIZE): a screen that gets fewer than there are says so
export const TAMANO_DE_PAGINA = 200

export const cobro = {
  // by code. a closed one comes too, with activa false
  cajas: () => client.request<Pagina<CajaEnLista>>(`/caja/cajas?size=${TAMANO_DE_PAGINA}`),
  // the pending orders of a payer, by fecha_exigibilidad
  ordenesPendientes: (documento: string) =>
    client.request<Pagina<OrdenDeCobro>>(
      `/caja/ordenes-de-cobro?${new URLSearchParams({ pagador_documento: documento, estado: 'PENDIENTE', size: String(TAMANO_DE_PAGINA) })}`
    ),
  // the orders of one estado (ANULADA: withdrawn by their source system), of a payer or of all, by fecha_exigibilidad.
  // the backend has no date filter: the list goes by pages of TAMANO_DE_PAGINA
  ordenes: ({ estado, pagador_documento, page }: { estado: string; pagador_documento?: string; page: number }) =>
    client.request<Pagina<OrdenDeCobro>>(
      `/caja/ordenes-de-cobro?${new URLSearchParams({
        estado,
        ...(pagador_documento ? { pagador_documento } : {}),
        page: String(page),
        size: String(TAMANO_DE_PAGINA)
      })}`
    ),
  // what cobrar them would be today: the total is the backend's, never the client's
  vistaPrevia: (ordenes: string[]) => enviar<VistaPrevia>('/caja/cobros/vista-previa', { ordenes }),
  // one key per attempt (cobro/intento.ts): the same one when the same attempt is sent again
  cobrar: (cuerpo: NuevoCobro, clave: string) => enviar<CobroHecho>('/caja/cobros', cuerpo, { 'Idempotency-Key': clave }),
  // the recibos of a day charged without being able to check with their source, by emitido_en
  sinVerificar: (fecha: string) => client.request<CobroSinVerificar[]>(`/caja/cobros/sin-verificar?${new URLSearchParams({ fecha })}`),
  claveSinVerificar: ['caja', 'cobros', 'sin-verificar'] as const,
  // the original in PDF, for blob (PdfDialog)
  pdfDelRecibo: (numeroImpreso: string) => `/caja/recibos/${encodeURIComponent(numeroImpreso)}/pdf`
}
