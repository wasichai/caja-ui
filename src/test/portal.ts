import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'

// what the portal's tests share: the accounts, what wasichai answers about them, and a session already open

export const CAJERA: AuthUser = { id: 'u-cajera', email: 'cajera@caja.test', displayName: 'Cajera de prueba', organizationId: 'o1', roles: ['CAJERO'] }
export const ADMIN: AuthUser = { id: 'u-admin', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }

// GET /api/auth/me: wasichai's AuthenticatedUser, the account the token belongs to
export const yo = (user: AuthUser) => ({
  userId: user.id,
  organizationId: user.organizationId,
  email: user.email,
  roles: user.roles,
  admin: user.roles.includes('ADMIN')
})

// what the portal asks once someone is signed in: who the token is and what it may do (ADR-020). the stored
// preferences are left to the mock's 404, as a backend without them: the theme stays the browser's (caja.theme)
export function rutasDeSesion(user: AuthUser, permisos: CallerPermissions): MockRoute[] {
  return [
    { path: '/auth/me', body: yo(user) },
    { path: '/auth/me/permissions', body: permisos }
  ]
}

// a session opened before the portal loads, as core keeps it: the token and the user under caja.*
export function abrirSesion(user: AuthUser) {
  localStorage.setItem('caja.token', 't')
  localStorage.setItem('caja.user', JSON.stringify(user))
}

// signs in again from the login a 401 led to, and waits until the portal is drawn again. right after «Ingresar» there is
// a moment with neither the login nor the shell (signIn has answered, the route of `next` is not drawn yet): a query of
// `main` run then, synchronously, finds nothing, and how long that moment lasts depends on the load of the machine.
// the caller mocks POST /auth/login first
export async function volverAEntrar(user: AuthUser, contrasena = 'secreta') {
  await userEvent.type(screen.getByLabelText('Correo'), user.email)
  await userEvent.type(screen.getByLabelText('Contraseña'), contrasena)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  await screen.findByRole('main')
}
