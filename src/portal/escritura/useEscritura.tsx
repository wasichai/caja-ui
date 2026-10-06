import { ApiError, useAuth } from '@wasichai/core'
import { Alert } from '@wasichai/ui'
import { useCallback, useState } from 'react'
import { borrarBorrador, guardarBorrador, leerBorrador, type Campos } from './borrador'

export const SESION_CADUCADA = 'La sesión caducó: vuelve a entrar. Lo que escribiste quedó guardado.'

// the write that got the 401: the act's form shows it while the page goes to the login
export class SesionCaducada extends Error {
  constructor() {
    super(SESION_CADUCADA)
  }
}

// an act that writes (an anulación, a cierre): `escribir` sends, and on a 401 keeps the fields named in `campos` (what
// the clerk typed, picked from the values by name: nothing else of them) with the account, and closes core's session
// (not the portal's sign-out, which forgets the drafts): RequireSession then leads to the login with next back here,
// and the login says why (SESION_CADUCADA). back with the same account, `borrador` is what was typed, for the act to
// fill itself in and say so (AvisoDeBorrador); with another, it is dropped. it is forgotten once written and when the
// act is cancelled (`cancelar`); signing out forgets every draft (auth/session.ts)
export function useEscritura(acto: string, campos: readonly string[]) {
  const { user, signOut } = useAuth()
  const cuenta = user?.id ?? null
  const [borrador, setBorrador] = useState<Campos | null>(() => (cuenta ? leerBorrador(acto, cuenta) : null))

  const escribir = useCallback(
    async <R,>(valores: object, enviar: () => Promise<R>): Promise<R> => {
      try {
        const hecho = await enviar()
        borrarBorrador(acto)
        setBorrador(null)
        return hecho
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401) || cuenta === null) throw e
        guardarBorrador(acto, cuenta, tecleado(valores, campos))
        // core's client drops the token on a 401 already; closing its session here does not lean on that
        signOut()
        throw new SesionCaducada()
      }
    },
    [acto, campos, cuenta, signOut]
  )

  const cancelar = useCallback(() => {
    borrarBorrador(acto)
    setBorrador(null)
  }, [acto])

  return { borrador, escribir, cancelar }
}

// the fields named, as text: what the clerk typed. a value the backend sent (a number, an object) never is
function tecleado(valores: object, campos: readonly string[]): Campos {
  const todos = valores as Record<string, unknown>
  return Object.fromEntries(campos.flatMap((campo) => (typeof todos[campo] === 'string' ? [[campo, todos[campo]]] : [])))
}

// what an act filled in from a draft says above its fields
export function AvisoDeBorrador() {
  return <Alert tone="notice">Se recuperó lo que escribiste antes de que caducara la sesión.</Alert>
}
