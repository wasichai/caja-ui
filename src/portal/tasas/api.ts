import { enviar } from '../cobro/api'
import { client } from '../api'
import type { CobroHecho, ConceptoPedido, NuevoCobroDeTasas, TasaVigente, VistaPrevia } from '../types'

// caja-backend's caja de tasas (/api/caja/tasas, /api/caja/cobros/tasas/**). the price is never the client's: the list
// says it, and the preview and the cobro take the tarifa in force today
export const tasas = {
  // the tasas in force that day, by code
  vigentes: (dia: string) => client.request<TasaVigente[]>(`/caja/tasas?${new URLSearchParams({ vigentes_a: dia })}`),
  // what cobrar those conceptos would be today: every line amount and the total are the backend's
  vistaPrevia: (conceptos: ConceptoPedido[]) => enviar<VistaPrevia>('/caja/cobros/tasas/vista-previa', { conceptos }),
  // one key per attempt (cobro/intento.ts): the same one when the same attempt is sent again
  cobrar: (cuerpo: NuevoCobroDeTasas, clave: string) => enviar<CobroHecho>('/caja/cobros/tasas', cuerpo, { 'Idempotency-Key': clave })
}
