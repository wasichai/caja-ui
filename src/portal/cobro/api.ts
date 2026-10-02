import { client } from '../api'
import type { CajaEnLista, CobroHecho, NuevoCobro, OrdenDeCobro, Pagina, VistaPrevia } from '../types'

// caja-backend's cobro (/api/caja/**), as the screens of the cash desk use it. the largest page the backend gives
// (wasichai's PageRequest.MAX_SIZE): a screen that gets fewer than there are says so
export const TAMANO_DE_PAGINA = 200

const enviar = <T>(path: string, cuerpo: unknown, headers?: HeadersInit) => client.request<T>(path, { method: 'POST', body: JSON.stringify(cuerpo), headers })

export const cobro = {
  // by code. a closed one comes too, with activa false
  cajas: () => client.request<Pagina<CajaEnLista>>(`/caja/cajas?size=${TAMANO_DE_PAGINA}`),
  // the pending orders of a payer, by fecha_exigibilidad
  ordenesPendientes: (documento: string) =>
    client.request<Pagina<OrdenDeCobro>>(
      `/caja/ordenes-de-cobro?${new URLSearchParams({ pagador_documento: documento, estado: 'PENDIENTE', size: String(TAMANO_DE_PAGINA) })}`
    ),
  // what cobrar them would be today: the total is the backend's, never the client's
  vistaPrevia: (ordenes: string[]) => enviar<VistaPrevia>('/caja/cobros/vista-previa', { ordenes }),
  // one key per attempt (cobro/intento.ts): the same one when the same attempt is sent again
  cobrar: (cuerpo: NuevoCobro, clave: string) => enviar<CobroHecho>('/caja/cobros', cuerpo, { 'Idempotency-Key': clave }),
  // the original in PDF, for blob (PdfDialog)
  pdfDelRecibo: (numeroImpreso: string) => `/caja/recibos/${encodeURIComponent(numeroImpreso)}/pdf`
}
