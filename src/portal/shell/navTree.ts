// copiado de srtm-ui@a1df33a (src/portal/shell/navTree.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { useAuth } from '@wasichai/core'
import { Settings, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { matchPath } from 'react-router'
import { PANTALLAS } from '../pantallas'

// the tree menu of the portal: what a clerk does, grouped by module. the home page is not a leaf, the panel's header
// takes there. a tree is groups (with subgroups, optionally) and leaves

// the leaves of tesorería, by the key and label of caja's tree (caja/frontend/src/pantallas/arbol.ts)
export type ClaveDeHoja = 'caja-tributaria' | 'caja-tasas' | 'duplicado-recibo' | 'cierre-caja' | 'avance-recaudacion' | 'recaudacion-area'

// what an account may do on an object of the model, as GET /api/auth/me/permissions lists it (ADR-020)
export type Accion = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE'

// one thing a leaf asks of the account: an action on an object
export interface Par {
  objeto: string
  accion: Accion
}

export interface HojaNav {
  label: string
  to: string
  // a leaf of a module: the key its screen is registered under (PANTALLAS). one with no screen is not drawn
  clave?: ClaveDeHoja
  // when it is offered: any of these alternatives, each a list of pairs the account must all have
  seOfreceCon?: Par[][]
  // route patterns (react-router's) that draw this leaf's page too: current there, over any other leaf
  tambienEn?: string[]
  // its screen takes what is chosen as the last segment of its route (/duplicado-recibo/001-0000123): a reload or a
  // link passed on shows the same. the screen reads it as the route's param `sujeto`
  conSujeto?: boolean
  // another app (the administration): a plain link, loaded in full, never current
  externa?: boolean
  soloAdmin?: boolean
  // drawn only by a leaf at the root, where a group has its caret
  icono?: LucideIcon
}

export interface GrupoNav {
  label: string
  hijos: NodoNav[]
  soloAdmin?: boolean
}

export type NodoNav = GrupoNav | HojaNav

export const esGrupo = (nodo: NodoNav): nodo is GrupoNav => 'hijos' in nodo

const lee = (objeto: string): Par => ({ objeto, accion: 'READ' })

// the objects are caja-backend's model (/api/caja/**): what each leaf's screen reads, or, for duplicado-recibo, the
// annulment it serves too (caja ADR-0044: whoever may only annul still gets the one screen where a recibo is annulled)
export const NAV_TREE: NodoNav[] = [
  {
    label: 'Tesorería',
    hijos: [
      { clave: 'caja-tributaria', label: 'Caja tributaria', to: '/caja-tributaria', seOfreceCon: [[lee('orden_de_cobro')]] },
      { clave: 'caja-tasas', label: 'Caja de tasas y derechos administrativos', to: '/caja-tasas', seOfreceCon: [[lee('tasa')]] },
      {
        clave: 'duplicado-recibo',
        label: 'Duplicado de recibo',
        to: '/duplicado-recibo',
        conSujeto: true,
        seOfreceCon: [[lee('recibo')], [{ objeto: 'anulacion_recibo', accion: 'CREATE' }]]
      },
      { clave: 'cierre-caja', label: 'Cierre y arqueo de caja', to: '/cierre-caja', seOfreceCon: [[lee('turno')]] },
      { clave: 'avance-recaudacion', label: 'Avance de recaudación', to: '/avance-recaudacion', seOfreceCon: [[lee('linea_recibo')]] },
      { clave: 'recaudacion-area', label: 'Recaudación por área', to: '/recaudacion-area', seOfreceCon: [[lee('linea_recibo'), lee('area')]] }
    ]
  },
  { label: 'Administración', to: '/admin', externa: true, soloAdmin: true, icono: Settings }
]

// what arbolPara asks of the account (core's useAuth: can is always true for an admin) and of the screens
export interface Oferta {
  isAdmin: boolean
  can: (objeto: string, accion: string) => boolean
  conPantalla: (clave: ClaveDeHoja) => boolean
}

// whether the account has every pair of some alternative
const seOfrece = (hoja: HojaNav, can: Oferta['can']) =>
  !hoja.seOfreceCon || hoja.seOfreceCon.some((alternativa) => alternativa.every(({ objeto, accion }) => can(objeto, accion)))

// how a pair reads when it is missing: "lectura de orden_de_cobro"
const ACCIONES: Record<Accion, string> = { READ: 'lectura', CREATE: 'creación', UPDATE: 'modificación', DELETE: 'borrado' }

// what the account lacks for any of the alternatives, as a phrase: within one, the pairs it lacks joined by "y";
// several, by ", o". empty when it has every pair of one of them
export function loQueFalta(alternativas: Par[][], can: Oferta['can']): string {
  const faltas = alternativas.map((alternativa) => alternativa.filter(({ objeto, accion }) => !can(objeto, accion)))
  if (faltas.some((falta) => falta.length === 0)) return ''
  return faltas.map((falta) => falta.map(({ objeto, accion }) => `${ACCIONES[accion]} de ${objeto}`).join(' y ')).join(', o ')
}

// the tree a user sees: what is for admins only, only for them; a leaf of a module only with its screen and when the
// account may open it; a group left empty goes too
export function arbolPara(nodos: NodoNav[], oferta: Oferta): NodoNav[] {
  return nodos.flatMap((nodo): NodoNav[] => {
    if (nodo.soloAdmin && !oferta.isAdmin) return []
    if (!esGrupo(nodo)) return (nodo.clave && !oferta.conPantalla(nodo.clave)) || !seOfrece(nodo, oferta.can) ? [] : [nodo]
    const hijos = arbolPara(nodo.hijos, oferta)
    return hijos.length ? [{ ...nodo, hijos }] : []
  })
}

export const conPantalla = (clave: ClaveDeHoja) => PANTALLAS[clave] !== undefined

// the tree the signed-in account is offered: its permissions are core's (GET /api/auth/me/permissions), so until they
// are read, or when they cannot be, no leaf of a module is offered
export function useArbol(): NodoNav[] {
  const { isAdmin, can } = useAuth()
  return useMemo(() => arbolPara(NAV_TREE, { isAdmin, can, conPantalla }), [isAdmin, can])
}

export const hojasDe = (nodos: NodoNav[]): HojaNav[] => nodos.flatMap((nodo) => (esGrupo(nodo) ? hojasDe(nodo.hijos) : [nodo]))

// the leaf current on a path: one whose tambienEn matches it, else the one whose route is the path or the longest
// start of it. a page with no leaf of its own has none
export function hojaActiva(nodos: NodoNav[], pathname: string): HojaNav | undefined {
  const propias = hojasDe(nodos).filter((hoja) => !hoja.externa)
  const porPatron = propias.find((hoja) => hoja.tambienEn?.some((patron) => matchPath(patron, pathname)))
  if (porPatron) return porPatron
  return propias
    .filter((hoja) => pathname === hoja.to || pathname.startsWith(`${hoja.to}/`))
    .reduce<HojaNav | undefined>((mejor, hoja) => (!mejor || hoja.to.length > mejor.to.length ? hoja : mejor), undefined)
}

// the trail to the leaf current on a path, its groups' labels first; none off the tree
export function rastro(nodos: NodoNav[], pathname: string): string[] {
  const actual = hojaActiva(nodos, pathname)
  const camino = (lista: NodoNav[]): string[] | null => {
    for (const nodo of lista) {
      if (nodo === actual) return [nodo.label]
      const resto = esGrupo(nodo) ? camino(nodo.hijos) : null
      if (resto) return [nodo.label, ...resto]
    }
    return null
  }
  return actual ? (camino(nodos) ?? []) : []
}
