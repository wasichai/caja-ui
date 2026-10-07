import { ApiError } from '@wasichai/core'
import { errorMessage } from '../../kit/ui/errorMessage'

// what every form of the portal shares, whatever its screen: how a field's error is tied to its control and drawn
// under it, how a refusal of the backend is split among the fields, and caja-backend's observación (every act asks
// for one)

// caja-backend's Observacion: trimmed, 5 to 500 characters
export const OBSERVACION = { minimo: 5, maximo: 500 }

// a field's error under it, tied to its control
const idDelError = (id: string) => `${id}-error`
export const conError = (id: string, error: string | undefined) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? idDelError(id) : undefined
})

export function ErrorDelCampo({ id, error }: { id: string; error: string | undefined }) {
  return error ? (
    <p id={idDelError(id)} className="text-xs text-danger">
      {error}
    </p>
  ) : null
}

// a refusal of the backend, told where it belongs: a 400's violations under the fields the form has a control for
// (several of one, joined), the others above the button with how their field reads, and with none, what the backend
// said (or `porDefecto` when it said nothing). every act of the portal says it so
export function repartirElRechazo<Campo extends string>(
  e: unknown,
  campos: readonly Campo[],
  rotular: (campo: string) => string,
  porDefecto: string
): { errores: Partial<Record<Campo, string>>; general: string | null } {
  const violaciones = e instanceof ApiError ? e.violations : []
  const esCampo = (campo: string): campo is Campo => (campos as readonly string[]).includes(campo)
  const errores: Partial<Record<Campo, string>> = {}
  for (const { field, message } of violaciones) if (esCampo(field)) errores[field] = errores[field] ? `${errores[field]} · ${message}` : message
  const ajenas = violaciones.filter((v) => !esCampo(v.field))
  if (ajenas.length > 0) return { errores, general: ajenas.map((v) => `${rotular(v.field)}: ${v.message}`).join(' · ') }
  return { errores, general: violaciones.length === 0 ? errorMessage(e, porDefecto) : null }
}
