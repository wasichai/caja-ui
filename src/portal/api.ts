// copiado de srtm-ui@a1df33a (src/portal/api.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { createApiClient } from '@wasichai/core'

// same base url and storage prefix as the admin: the token one signs in with is the other's too. caja-backend's own
// api (/api/caja/**) comes with its screens; until then the portal only asks core's /api/auth/**
export const client = createApiClient({ baseUrl: '/api', storagePrefix: 'caja' })
