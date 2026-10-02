// what a clerk typed in an act, kept in the browser tab when a write gets a 401 (caja ADR-0044 §Decisión·4): signing
// in again is a new page, and without this the act would come back empty. the only file of src/ that keeps drafts
// (src/garantias.test.tsx checks it)
//
// - sessionStorage, not localStorage: a draft is of this tab and this shift. it survives the trip to the login and
//   dies with the tab; a persistent one would hand the next clerk of a shared desk the previous one's half act
// - only the fields typed, with the account that typed them. never the token, never what the backend answered: the
//   caller hands the typed values in (useEscritura picks them by name) and nothing else gets here
// - another account finds nothing: reading it as another one drops it
// - the browser may refuse (a private window, a full or blocked storage): every access is guarded, and then there is
//   no draft, which is how it was before

// the typed fields of an act, by name, as the inputs hold them
export type Campos = Record<string, string>

const PREFIJO = 'caja.borrador.'
const clave = (acto: string) => `${PREFIJO}${acto}`

// only text fields: anything else in what was read is not something a person typed
function soloTexto(campos: Record<string, unknown>): Campos {
  return Object.fromEntries(Object.entries(campos).filter((entrada): entrada is [string, string] => typeof entrada[1] === 'string'))
}

export function guardarBorrador(acto: string, cuenta: string, campos: Campos): void {
  try {
    sessionStorage.setItem(clave(acto), JSON.stringify({ cuenta, campos: soloTexto(campos) }))
  } catch {
    // no storage, no draft: the act goes on as before
  }
}

// the draft this account left for the act, or none. another account's is dropped, never offered
export function leerBorrador(acto: string, cuenta: string): Campos | null {
  try {
    const crudo = sessionStorage.getItem(clave(acto))
    if (crudo === null) return null
    const leido: unknown = JSON.parse(crudo)
    if (typeof leido !== 'object' || leido === null) return null
    const { cuenta: suya, campos } = leido as Record<string, unknown>
    if (suya !== cuenta) {
      borrarBorrador(acto)
      return null
    }
    return typeof campos === 'object' && campos !== null ? soloTexto(campos as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// once written, or the act cancelled
export function borrarBorrador(acto: string): void {
  try {
    sessionStorage.removeItem(clave(acto))
  } catch {
    // nothing to forget if it cannot be touched
  }
}

// whether the tab keeps any draft: the login says the session expired and that what was typed is kept
export function hayBorradores(): boolean {
  try {
    for (let i = 0; i < sessionStorage.length; i++) if (sessionStorage.key(i)?.startsWith(PREFIJO)) return true
    return false
  } catch {
    return false
  }
}

// signing out: what a clerk leaves at the desk must not stay written for the next one. the tab's other keys stay
export function olvidarLosBorradores(): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(PREFIJO)) sessionStorage.removeItem(key)
    }
  } catch {
    // nothing to forget if it cannot be touched
  }
}
