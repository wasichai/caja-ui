// what the portal reads from the backend. caja-backend's own (/api/caja/**) comes with its screens; for now, core's

// GET /api/auth/me: the account the token belongs to (wasichai's AuthenticatedUser). it has no display name: that one
// comes in POST /api/auth/login's answer, which core keeps (useAuth().user)
export interface CuentaDeWasichai {
  userId: string
  organizationId: string
  email: string
  roles: string[]
}
