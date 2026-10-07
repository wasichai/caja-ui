import { Link } from 'react-router'

// an address that leads to no screen (a mistyped link, a leaf of another version): a page like any other, with its
// heading, and the way back
export function NoExistePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-ink">Esta página no existe</h1>
      <p className="text-sm text-ink-muted">
        La dirección no lleva a ninguna pantalla de la caja.{' '}
        <Link to="/" className="font-medium text-link underline">
          Volver al inicio
        </Link>{' '}
        o elija una pantalla del menú.
      </p>
    </div>
  )
}
