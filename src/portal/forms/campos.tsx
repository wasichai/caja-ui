// what every form of the portal shares, whatever its screen: how a field's error is tied to its control and drawn
// under it, and caja-backend's observación (every act asks for one)

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
