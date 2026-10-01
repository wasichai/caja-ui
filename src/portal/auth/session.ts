// copiado de srtm-ui@a1df33a (src/portal/auth/session.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { useAuth } from '@wasichai/core'
import { useCallback } from 'react'

export const TABS_KEY = 'caja.tabs'

// the session is core's AuthProvider (mounted by WasichaiProviders), the admin's too: same caja.token and
// caja.user. the portal only adds forgetting its workspace tabs on sign-out
export function useSession() {
  const { user, isAdmin, signIn, signOut } = useAuth()
  const leave = useCallback(() => {
    sessionStorage.removeItem(TABS_KEY)
    signOut()
  }, [signOut])
  return { user, isAdmin, signIn, signOut: leave }
}
