import { describe, expect, it } from 'vitest'
import { currentNavTreeLeaf, navTreeLeaves } from '@wasichai/core'
import { arbolPara, NAV_TREE, rastro } from './navTree'

// the tree of tesorería as data: its leaves and what each one asks of the account (the shell draws it: arbol.test.tsx)

// an account that may do exactly these "objeto ACCION" pairs, every leaf with its screen
const cuenta = (pares: string[]) => ({
  isAdmin: false,
  can: (objeto: string, accion: string) => pares.includes(`${objeto} ${accion}`),
  conPantalla: () => true
})
const ofrecidas = (pares: string[]) =>
  navTreeLeaves(arbolPara(NAV_TREE, cuenta(pares)))
    .filter((hoja) => hoja.clave)
    .map((hoja) => hoja.clave)

describe('NAV_TREE', () => {
  it("has caja's six leaves of tesorería, with their keys and labels, and the administration for admins", () => {
    const ver = (nodos: typeof NAV_TREE): unknown => nodos.map((nodo) => ('children' in nodo ? [nodo.label, ver(nodo.children)] : `${nodo.label} ${nodo.to}`))
    expect(ver(arbolPara(NAV_TREE, { isAdmin: true, can: () => true, conPantalla: () => true }))).toEqual([
      [
        'Tesorería',
        [
          'Caja tributaria /caja-tributaria',
          'Caja de tasas y derechos administrativos /caja-tasas',
          'Duplicado de recibo /duplicado-recibo',
          'Cierre y arqueo de caja /cierre-caja',
          'Avance de recaudación /avance-recaudacion',
          'Recaudación por área /recaudacion-area'
        ]
      ],
      'Administración /admin'
    ])
  })

  it('has no group with soloAdmin: arbolPara reads soloAdmin on leaves only', () => {
    const conSoloAdmin = (nodos: typeof NAV_TREE): boolean =>
      nodos.some((nodo) => ('children' in nodo ? 'soloAdmin' in nodo || conSoloAdmin(nodo.children) : false))
    expect(conSoloAdmin(NAV_TREE)).toBe(false)
  })

  // the brief's table: each leaf with the pairs it needs, and the ones that are near but not enough
  it.each([
    [['orden_de_cobro READ'], ['caja-tributaria']],
    [['tasa READ'], ['caja-tasas']],
    [['recibo READ'], ['duplicado-recibo']],
    [['anulacion_recibo CREATE'], ['duplicado-recibo']],
    [['turno READ'], ['cierre-caja']],
    // the avance and the recaudación por área, by caja-backend's exact gates: a pair short is not enough
    [['linea_recibo READ'], []],
    [
      ['recibo READ', 'linea_recibo READ'],
      ['duplicado-recibo', 'avance-recaudacion']
    ],
    [
      ['recibo READ', 'linea_recibo READ', 'area READ'],
      ['duplicado-recibo', 'avance-recaudacion']
    ],
    [
      ['recibo READ', 'linea_recibo READ', 'area READ', 'tasa READ'],
      ['caja-tasas', 'duplicado-recibo', 'avance-recaudacion', 'recaudacion-area']
    ],
    [['area READ'], []],
    [['orden_de_cobro CREATE', 'tasa UPDATE', 'recibo DELETE', 'anulacion_recibo READ', 'turno CREATE', 'linea_recibo UPDATE'], []]
  ])('with %j offers %j', (pares, claves) => {
    expect(ofrecidas(pares)).toEqual(claves)
  })

  it('offers no leaf without its screen, whatever the account may do', () => {
    expect(
      navTreeLeaves(arbolPara(NAV_TREE, { isAdmin: true, can: () => true, conPantalla: (clave) => clave === 'cierre-caja' })).map((hoja) => hoja.label)
    ).toEqual(['Cierre y arqueo de caja', 'Administración'])
  })

  // a leaf is current on its route and the routes under it (a recibo picked on duplicado-recibo); the trail goes from
  // its module
  it.each([
    ['/', undefined, []],
    ['/duplicado-recibo', 'Duplicado de recibo', ['Tesorería', 'Duplicado de recibo']],
    ['/duplicado-recibo/001-000123', 'Duplicado de recibo', ['Tesorería', 'Duplicado de recibo']],
    ['/cierre-cajax', undefined, []],
    ['/admin', undefined, []]
  ])('on %s the current leaf is %s', (path, label, trail) => {
    expect(currentNavTreeLeaf(NAV_TREE, path)?.label).toBe(label)
    expect(rastro(NAV_TREE, path)).toEqual(trail)
  })
})
