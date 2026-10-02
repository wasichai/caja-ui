// copiado de srtm-ui@a1df33a (src/portal/api.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// adaptado: diverge de srtm-ui en casi todo lo que no es el cliente. se quitaron RentasError (titulares, faltan) y la
// API de srtm (rentas.*, hijos, query); el prefijo es 'caja'; blob se exporta, lanza el ApiError de core y acepta un
// cuerpo (POST en JSON, para el duplicado que se registra al pedirse). las llamadas de caja viven en cada pantalla
// (cobro/api.ts, tasas/api.ts…). al unir las copias en wasichai-ui#14, solo `client` y `blob` son comunes
import { ApiError, createApiClient, type ApiClient, type FieldViolation } from '@wasichai/core'

// same base url and storage prefix as the admin: the token one signs in with is the other's too
const base = createApiClient({ baseUrl: '/api', storagePrefix: 'caja' })

// core's AuthProvider hands the client what to do on a 401 (sign out); kept here too, so blob, which fetches on its
// own, signs out the same way
let onUnauthorized: (() => void) | null = null
export const client: ApiClient = {
  ...base,
  setOnUnauthorized: (handler) => {
    onUnauthorized = handler
    base.setOnUnauthorized(handler)
  }
}

// the file name of a Content-Disposition: filename*=UTF-8''… (RFC 5987) before filename="…"
function nombreDeArchivo(disposition: string | null): string | null {
  if (!disposition) return null
  const extendido = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(disposition)
  if (extendido) {
    try {
      return decodeURIComponent(extendido[1].trim())
    } catch {
      return extendido[1].trim()
    }
  }
  const simple = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(disposition)
  return simple ? (simple[1] ?? simple[2]).trim() : null
}

// a file (the recibo in PDF): client.request only reads JSON, so it is fetched here, with the same token, the same
// sign-out on a 401 and the same problem+json errors (core's ApiError, with the detail). with `cuerpo`, a POST of it as
// JSON: a file that is written as it is asked for (a duplicate, which registers its reprint)
export async function blob(path: string, cuerpo?: object): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers()
  const token = client.getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (cuerpo) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${client.baseUrl}${path}`, cuerpo ? { method: 'POST', headers, body: JSON.stringify(cuerpo) } : { headers })
  if (!response.ok) {
    if (response.status === 401) {
      client.setToken(null)
      onUnauthorized?.()
    }
    const text = await response.text().catch(() => '')
    let problem: Record<string, unknown> = {}
    try {
      problem = text ? ((JSON.parse(text) as Record<string, unknown> | null) ?? {}) : {}
    } catch {
      problem = {}
    }
    const texto = (valor: unknown) => (typeof valor === 'string' && valor ? valor : null)
    throw new ApiError(
      response.status,
      texto(problem.detail) ?? texto(problem.title) ?? (response.statusText || `Error ${response.status}`),
      Array.isArray(problem.errors) ? (problem.errors as FieldViolation[]) : []
    )
  }
  const archivo = nombreDeArchivo(response.headers.get('Content-Disposition')) ?? path.split('?')[0].split('/').filter(Boolean).join('-')
  return { blob: await response.blob(), filename: archivo }
}
