import type { DisplayProps } from '../../kit/KitProvider'
import { Importe, SinDato, type Cifra } from '../cifras/Importe'

// the kind importe of a ficha (FieldGrid): caja-backend's { importe, actualizado_a }, drawn by Importe with its date.
// never the kit's money, which takes a Number. a missing one says why: the field's function placeholder, or Importe's
// generic reason

const esCifra = (valor: unknown): valor is Cifra =>
  typeof valor === 'object' &&
  valor !== null &&
  typeof (valor as Record<string, unknown>).importe === 'string' &&
  typeof (valor as Record<string, unknown>).actualizado_a === 'string'

export function ImporteEnFicha({ field, value, values }: DisplayProps) {
  if (esCifra(value)) return <Importe cifra={value} />
  const motivo = typeof field.placeholder === 'function' ? field.placeholder({ values, saved: true }) : undefined
  if (value === null || value === undefined) return <Importe cifra={{ importe: null, actualizado_a: null }} motivo={motivo ?? ''} />
  return <SinDato motivo="El importe que mandó el backend no se entiende" />
}

// the kit's displayKinds of the portal: a module-level object, so the renderers are stable
export const FICHA_DEL_PORTAL = { importe: ImporteEnFicha }
