import { formatDate } from '../../kit/format'

// an amount as caja-backend sends it: the decimal as a string (a double would round it) and the date it is as of
export interface Cifra {
  importe: string
  actualizado_a: string
}

// an amount the backend could not give: it says why in `motivo`, never a 0
export interface CifraQueFalta {
  importe: null
  actualizado_a: string | null
}

// a missing amount (or one that may be missing) needs its reason: the types refuse it without one
type ImporteProps = { fechaDeLaTabla?: string } & ({ cifra: Cifra; motivo?: string } | { cifra: Cifra | CifraQueFalta; motivo: string })

// soles as es-PE writes them. Intl takes the decimal string itself: no Number, so no cent is lost on the way
const SOLES = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const DECIMAL = /^-?\d+(\.\d+)?$/
const esDecimal = (texto: string): texto is `${number}` => DECIMAL.test(texto)

// what a figure says that it is as of: "al 01/10/2026"
const alDia = (fecha: string) => `al ${formatDate(fecha)}`

// what a missing amount says when no reason came with it: a null the backend sent where the types promised an amount
// has none, and a bare dash would read as nothing to pay
const SIN_MOTIVO = 'El backend no mandó el importe'

// a figure the client formats and never computes, with its date. in a table whose heading says the date once
// (FechaDeLasCifras), `fechaDeLaTabla` drops the figure's own when it is that one; one of another date keeps it
export function Importe({ cifra, motivo, fechaDeLaTabla }: ImporteProps) {
  if (cifra.importe === null) return <SinDato motivo={motivo?.trim() ? motivo : SIN_MOTIVO} />
  if (!esDecimal(cifra.importe)) return <SinDato motivo="El importe que mandó el backend no se entiende" />
  return (
    <span data-ui="importe" className="tabular-nums">
      <span data-ui="importe-valor">{SOLES.format(cifra.importe)}</span>
      {cifra.actualizado_a !== fechaDeLaTabla && (
        <>
          {' '}
          <span data-ui="importe-fecha" className="text-xs text-ink-muted">
            {alDia(cifra.actualizado_a)}
          </span>
        </>
      )}
    </span>
  )
}

// a datum that is not there says why: a dash and the reason, never a 0
export function SinDato({ motivo }: { motivo: string }) {
  return (
    <span data-ui="sin-dato" className="text-ink-muted">
      — <span className="text-sm">{motivo}</span>
    </span>
  )
}

// the date of a table's figures, once, in its heading
export function FechaDeLasCifras({ fecha }: { fecha: string }) {
  return (
    <span data-ui="fecha-de-las-cifras" className="text-xs font-normal text-ink-muted">
      {alDia(fecha)}
    </span>
  )
}
