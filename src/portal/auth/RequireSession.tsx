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

// only same-site paths: ?next=//evil.example must not leave the app. a browser reads more than the text says (/\evil.example
// and a tab inside the slashes are //evil.example to it), so the path is resolved as the browser would, and kept only
// when it stays on this origin
export function safeNext(next: string | null): string {
  if (!next?.startsWith('/')) return '/'
  try {
    const destino = new URL(next, window.location.origin)
    return destino.origin === window.location.origin ? `${destino.pathname}${destino.search}${destino.hash}` : '/'
  } catch {
    return '/'
  }
}
