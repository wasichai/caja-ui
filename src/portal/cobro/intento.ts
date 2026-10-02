// the Idempotency-Key of a cobro: one per attempt, the same when that attempt is sent again (a timeout, a 409 that
// says to try again), so the backend charges it once. a changed attempt (other orders, another observación) is another
// one, with a new key

// a uuid v4. crypto.randomUUID exists only in a secure context (https, localhost): a cash desk on the intranet over
// http has getRandomValues only
export function nuevaClave(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface Intento {
  firma: string
  clave: string
}

// the key for what is sent: the previous attempt's when it is the same body, a new one otherwise
export function claveDelIntento(anterior: Intento | null, cuerpo: unknown): Intento {
  const firma = JSON.stringify(cuerpo)
  return anterior?.firma === firma ? anterior : { firma, clave: nuevaClave() }
}
