// the Idempotency-Key of a cobro: one per attempt, the same when that attempt is sent again (a timeout, a 409 that
// says to try again), so the backend charges it once. a changed attempt (other orders, another observación) is another
// one, with a new key; except while an attempt's outcome is not known (envio.ts): then the key stays whatever is sent,
// because caja-backend answers a key that already names a recibo with that recibo (200, emitido false), whatever the
// body, and a new key could charge a second time what was already charged

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

// the key for what is sent: the previous attempt's when it is the same body, or when `fija` (the previous attempt's
// outcome is not known), and a new one otherwise
export function claveDelIntento(anterior: Intento | null, cuerpo: unknown, fija = false): Intento {
  const firma = JSON.stringify(cuerpo)
  if (anterior && fija) return { firma, clave: anterior.clave }
  return anterior?.firma === firma ? anterior : { firma, clave: nuevaClave() }
}
