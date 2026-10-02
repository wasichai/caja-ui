import type { ConceptoPedido } from '../types'

// the lines of a cobro of tasas, as the screen keeps them until it cobra: the tasa's code and the quantity as typed.
// never a price nor an amount: the price is GET /tasas', and every line amount and the total, the preview's

export interface LineaPedida {
  codigo: string
  // as typed: checked here, and sent only when it is a quantity
  cantidad: string
}

// caja-backend's cantidadPedida: an integer of at least 1 (an Int, so up to nine digits here: the tenth could pass it)
const CANTIDAD = /^[1-9]\d{0,8}$/

export const CANTIDAD_INVALIDA = 'Escriba un entero de al menos 1 (hasta nueve cifras).'

export const cantidadValida = (texto: string) => CANTIDAD.test(texto.trim())

// what the preview and the cobro send of a line whose quantity is valid: the integer it reads, which nine digits keep
// exact. the price never travels
export const comoConcepto = ({ codigo, cantidad }: LineaPedida): ConceptoPedido => ({ codigo, cantidad: Number.parseInt(cantidad.trim(), 10) })

// the lines in a draft (useEscritura keeps text only): [code, quantity] pairs, as typed
export const lineasComoTexto = (lineas: LineaPedida[]): string => JSON.stringify(lineas.map(({ codigo, cantidad }) => [codigo, cantidad]))

// the lines of a draft, or none: what cannot be read as [code, quantity] pairs of text is dropped, and a code that comes
// twice is kept once
export function lineasDeTexto(texto: string | undefined): LineaPedida[] {
  if (!texto) return []
  try {
    const leido: unknown = JSON.parse(texto)
    if (!Array.isArray(leido)) return []
    const lineas: LineaPedida[] = []
    for (const par of leido) {
      if (!Array.isArray(par) || par.length !== 2 || typeof par[0] !== 'string' || typeof par[1] !== 'string') continue
      if (!par[0] || lineas.some((l) => l.codigo === par[0])) continue
      lineas.push({ codigo: par[0], cantidad: par[1] })
    }
    return lineas
  } catch {
    return []
  }
}
