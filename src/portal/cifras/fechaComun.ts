import type { Cifra } from './Importe'

// the date of a table's figures, when they all share it: it goes once, in its heading or caption (FechaDeLasCifras).
// a missing figure does not count. apart from Importe.tsx, which only draws figures (its test checks that)
export function fechaComun(cifras: (Cifra | null)[]): string | undefined {
  const presentes = cifras.filter((c): c is Cifra => c !== null)
  const fechas = new Set(presentes.map((c) => c.actualizado_a))
  return fechas.size === 1 ? presentes[0].actualizado_a : undefined
}
