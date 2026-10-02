import { blob, client } from '../api'
import { enviar } from '../cobro/api'
import type { AnulacionHecha, Pagina, PeticionDeAnulacion, ReciboEnFicha, ReciboEnLista } from '../types'

// caja-backend's recibo after it was issued (/api/caja/recibos/**), as «Duplicado de recibo» uses it

// the list's filters, in the order the url and the query carry them. all optional: an empty one is not sent
export const FILTROS = ['documento', 'caja', 'cajero', 'desde', 'hasta', 'estado'] as const
export type Filtro = (typeof FILTROS)[number]
export type Filtros = Record<Filtro, string>

// the number as it is printed (001-0000123): one with a slash in it would split the route in two
const delRecibo = (numero: string) => `/caja/recibos/${encodeURIComponent(numero)}`

export const recibos = {
  // the newest first. page from 0; size up to 200
  listar: (filtros: Filtros, page: number, size: number) => {
    const params = new URLSearchParams()
    for (const filtro of FILTROS) if (filtros[filtro]) params.set(filtro, filtros[filtro])
    params.set('page', String(page))
    params.set('size', String(size))
    return client.request<Pagina<ReciboEnLista>>(`/caja/recibos?${params}`)
  },
  ficha: (numero: string) => client.request<ReciboEnFicha>(delRecibo(numero)),
  // a duplicate in PDF. it writes: each one is registered with its observación, so it is asked once, by the clerk
  duplicado: (numero: string, observacion: string) => blob(`${delRecibo(numero)}/duplicados`, { observacion }),
  // the act: it is not undone
  anular: (numero: string, peticion: PeticionDeAnulacion) => enviar<AnulacionHecha>(`${delRecibo(numero)}/anulacion`, peticion),
  // the name the duplicate's dialog keys on
  rutaDelDuplicado: (numero: string) => `${delRecibo(numero)}/duplicados`
}
