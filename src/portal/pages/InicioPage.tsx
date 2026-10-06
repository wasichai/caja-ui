import { navTreeLeaves, useAuth } from '@wasichai/core'
import { conPantalla, NAV_TREE, useArbol } from '../shell/navTree'

// home: what the tree offers this account, said plainly. the screens of tesorería come one per version, so until then
// the tree has none and home says that, instead of an empty menu that seems to be still loading
export function InicioPage() {
  const { permissions, permissionsError } = useAuth()
  const ofrecidas = navTreeLeaves(useArbol()).filter((hoja) => hoja.clave)
  const hayPantallas = navTreeLeaves(NAV_TREE).some((hoja) => hoja.clave && conPantalla(hoja.clave))

  const frase = !hayPantallas
    ? 'Todavía no hay pantallas de Tesorería en esta versión de la caja.'
    : permissionsError
      ? 'No se pudieron leer los permisos de su cuenta: el menú no ofrece ninguna pantalla.'
      : !permissions
        ? 'Leyendo los permisos de su cuenta…'
        : ofrecidas.length
          ? 'Elija una pantalla del menú.'
          : 'Su cuenta no tiene acceso a ninguna pantalla de Tesorería.'

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-ink">Inicio</h1>
      <p className="text-sm text-ink-muted">{frase}</p>
    </div>
  )
}
