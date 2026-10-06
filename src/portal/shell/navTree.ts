// copiado de srtm-ui@a1df33a (src/portal/shell/navTree.ts): los nodos y la hoja actual ya son de @wasichai/core (wasichai-ui#14)
// adaptado: diverge de srtm-ui en el árbol (Tesorería con las seis hojas de caja, no los grupos de srtm) y en lo que
// srtm no tiene: la clave de la pantalla de cada hoja (PANTALLAS), su seOfreceCon por permisos (Par, loQueFalta, la
// Oferta de arbolPara, useArbol), conSujeto y el rastro de las migas. la forma de los nodos, su dibujo (NavTree) y la
// hoja actual son de @wasichai/core
import { currentNavTreeLeaf, isNavTreeGroup, useAuth, type NavTreeGroup, type NavTreeLeaf, type NavTreeNode } from '@wasichai/core'
import { Settings } from 'lucide-react'
import { useMemo } from 'react'
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

export interface HojaNav extends NavTreeLeaf {
  // a leaf of a module: the key its screen is registered under (PANTALLAS). one with no screen is not drawn
  clave?: ClaveDeHoja
  // when it is offered: any of these alternatives, each a list of pairs the account must all have
  seOfreceCon?: Par[][]
  // its screen takes what is chosen as the last segment of its route (/duplicado-recibo/001-0000123): a reload or a
  // link passed on shows the same. the screen reads it as the route's param `sujeto`
  conSujeto?: boolean
  // for admins only: the administration. no group has it
  soloAdmin?: boolean
}

export type GrupoNav = NavTreeGroup<HojaNav>
export type NodoNav = NavTreeNode<HojaNav>

const lee = (objeto: string): Par => ({ objeto, accion: 'READ' })

// the objects are caja-backend's model (/api/caja/**): what each leaf's screen reads, or, for duplicado-recibo, the
// annulment it serves too (caja ADR-0044: whoever may only annul still gets the one screen where a recibo is annulled)
export const NAV_TREE: NodoNav[] = [
  {
    label: 'Tesorería',
    children: [
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
      // the two of the recaudación, by caja-backend's exact gates (ConsultaDeRecaudacion): a pair short would open a
      // screen whose read is a 403
      {
        clave: 'avance-recaudacion',
        label: 'Avance de recaudación',
        to: '/avance-recaudacion',
        seOfreceCon: [[lee('recibo'), lee('linea_recibo')]]
      },
      {
        clave: 'recaudacion-area',
        label: 'Recaudación por área',
        to: '/recaudacion-area',
        seOfreceCon: [[lee('recibo'), lee('linea_recibo'), lee('area'), lee('tasa')]]
      }
    ]
  },
  { label: 'Administración', to: '/admin', external: true, soloAdmin: true, icon: Settings }
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
    if (!isNavTreeGroup(nodo))
      return (nodo.soloAdmin && !oferta.isAdmin) || (nodo.clave && !oferta.conPantalla(nodo.clave)) || !seOfrece(nodo, oferta.can) ? [] : [nodo]
    const children = arbolPara(nodo.children, oferta)
    return children.length ? [{ ...nodo, children }] : []
  })
}

export const conPantalla = (clave: ClaveDeHoja) => PANTALLAS[clave] !== undefined

// the tree the signed-in account is offered: its permissions are core's (GET /api/auth/me/permissions), so until they
// are read, or when they cannot be, no leaf of a module is offered
export function useArbol(): NodoNav[] {
  const { isAdmin, can } = useAuth()
  return useMemo(() => arbolPara(NAV_TREE, { isAdmin, can, conPantalla }), [isAdmin, can])
}

// the trail to the leaf current on a path, its groups' labels first; none off the tree
export function rastro(nodos: NodoNav[], pathname: string): string[] {
  const actual = currentNavTreeLeaf(nodos, pathname)
  const camino = (lista: NodoNav[]): string[] | null => {
    for (const nodo of lista) {
      if (nodo === actual) return [nodo.label]
      const resto = isNavTreeGroup(nodo) ? camino(nodo.children) : null
      if (resto) return [nodo.label, ...resto]
    }
    return null
  }
  return actual ? (camino(nodos) ?? []) : []
}
