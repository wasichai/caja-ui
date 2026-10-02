import { LoadingState, useAuth } from '@wasichai/core'
import type { ReactNode } from 'react'
import { Alerta } from '../components/Alerta'
import { loQueFalta, type HojaNav } from './navTree'

// a leaf's screen, kept by the same seOfreceCon the tree offers it with: whoever arrives by its url without it (a link
// passed on, a bookmark of another account) reads what the account lacks, instead of a screen full of 403s. while
// the permissions are read nothing is drawn; when they cannot be, it says so, as the tree offers nothing then
export function GuardaDeHoja({ hoja, children }: { hoja: HojaNav; children: ReactNode }) {
  const { permissions, permissionsError, can } = useAuth()
  if (!hoja.seOfreceCon) return children
  if (permissionsError) return <Alerta tono="atencion">No se pudieron leer los permisos de su cuenta: esta pantalla no se abre.</Alerta>
  if (!permissions) return <LoadingState label="Leyendo los permisos de su cuenta…" />
  const falta = loQueFalta(hoja.seOfreceCon, can)
  if (!falta) return children
  return (
    <Alerta tono="atencion">
      Su cuenta no puede abrir «{hoja.label}»: le falta {falta}.
    </Alerta>
  )
}
