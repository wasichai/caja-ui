import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { client } from './api'
import type { CuentaDeWasichai } from './types'

// the account the bar names: while it is asked, once wasichai answers it, or not known when the read fails
export type Cuenta = { estado: 'cargando' } | { estado: 'desconocida' } | { estado: 'conocida'; nombre: string; correo: string }

// who the token belongs to is the backend's answer (GET /api/auth/me), never what was typed at login. its name is the
// one core got for that same account at sign-in; without one, its email. when the read fails, it is not known: the
// bar says so instead of naming anybody (a made-up person on a cash desk reads as the one who took the money)
export function useCuenta(): Cuenta {
  const { user } = useAuth()
  const yo = useQuery({
    queryKey: ['auth', 'me', user?.id ?? null],
    queryFn: () => client.request<CuentaDeWasichai>('/auth/me'),
    enabled: user !== null,
    staleTime: Infinity
  })
  if (yo.isPending) return { estado: 'cargando' }
  if (yo.isError) return { estado: 'desconocida' }
  const nombre = user?.id === yo.data.userId && user.displayName.trim() ? user.displayName : yo.data.email
  return { estado: 'conocida', nombre, correo: yo.data.email }
}
