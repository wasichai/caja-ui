import { LoadingState, useAuth } from '@wasichai/core'
import { Alert } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { loQueFalta, type HojaNav } from './navTree'

// a leaf's screen, kept by the same seOfreceCon the tree offers it with: whoever arrives by its url without it (a link
// passed on, a bookmark of another account) reads what the account lacks, instead of a screen full of 403s. while
// the permissions are read nothing is drawn; when they cannot be, it says so, as the tree offers nothing then. once
// read, they stay: a read again that fails (a reconnection on a flaky network) keeps the ones read, as the tree does
// (useAuth's can), and never takes away the open screen and what was typed in it
export function GuardaDeHoja({ hoja, children }: { hoja: HojaNav; children: ReactNode }) {
  const { permissions, permissionsError, can } = useAuth()
  if (!hoja.seOfreceCon) return children
  if (!permissions)
    return permissionsError ? (
      <Alert tone="warning">No se pudieron leer los permisos de su cuenta: esta pantalla no se abre.</Alert>
    ) : (
      <LoadingState label="Leyendo los permisos de su cuenta…" />
    )
  const falta = loQueFalta(hoja.seOfreceCon, can)
  if (!falta) return children
  return (
    <Alert tone="warning">
      Su cuenta no puede abrir «{hoja.label}»: le falta {falta}.
    </Alert>
  )
}
