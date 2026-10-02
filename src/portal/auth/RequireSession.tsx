// copiado de srtm-ui@a1df33a (src/portal/auth/RequireSession.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSession } from './session'

export function RequireSession({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

// only same-site paths: ?next=//evil.example must not leave the app
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}
