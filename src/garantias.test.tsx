import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// the cross-cutting guarantees caja-web kept, swept over src/ (tests aside): a guarantee only one screen keeps is a
// convention, and the next screen forgets it
const SRC = import.meta.dirname

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const ruta = (file: string) => relative(SRC, file).split(sep).join('/')

// --- the client formats and never computes: every total is the backend's ---

// what turns text into a number to compute with. formatNumber( and Number.parseInt( are no hit: \b and the "(" keep
// them out
const CALCULO = { 'parseFloat(': /\bparseFloat\(/g, 'toFixed(': /\btoFixed\(/g, 'Number(': /\bNumber\(/g }

// the exact list of what may: file, what it calls, how many times, and why. an entry no longer used fails too
const PERMITIDOS: { archivo: string; llamada: keyof typeof CALCULO; veces: number; motivo: string }[] = [
  {
    archivo: 'kit/forms/RecordForm.tsx',
    llamada: 'Number(',
    veces: 1,
    motivo:
      'pieza del kit copiado: fromForm convierte un campo decimal o money al enviarlo, sin sumar nada. ' +
      'Una pantalla de caja que envíe importes los manda como texto (el backend espera la cadena decimal), no con kind money'
  }
]

describe('the client does not compute', () => {
  it('calls parseFloat(, toFixed( and Number( only where the exact list says, and says why', () => {
    const halladas = sources(SRC).flatMap((file) => {
      const texto = readFileSync(file, 'utf8')
      return Object.entries(CALCULO).flatMap(([llamada, patron]) => {
        const veces = texto.match(patron)?.length ?? 0
        return veces > 0 ? [{ archivo: ruta(file), llamada, veces }] : []
      })
    })
    expect(halladas).toEqual(PERMITIDOS.map(({ archivo, llamada, veces }) => ({ archivo, llamada, veces })))
  })

  it('gives every allowed call its reason', () => {
    for (const { motivo } of PERMITIDOS) expect(motivo.trim().length).toBeGreaterThan(20)
  })
})

// --- a draft is kept in one place: portal/escritura/borrador.ts ---

// what touches sessionStorage, and for what. drafts: borrador.ts alone (useEscritura, the login and the sign-out go
// through it)
const SESION_DEL_NAVEGADOR: Record<string, string> = {
  'portal/escritura/borrador.ts': 'los borradores de los actos (caja.borrador.<acto>)',
  'portal/auth/session.ts': 'olvida las pestañas de trabajo (caja.tabs) al cerrar sesión',
  'portal/shell/panelLateral.ts': 'el estado del árbol (caja.nav)',
  'portal/shell/WorkspaceTabs.tsx': 'las pestañas de trabajo (caja.tabs)'
}

describe('the drafts of the acts', () => {
  it('are kept by borrador.ts alone', () => {
    const tocan = sources(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes('sessionStorage'))
      .map(ruta)
      .sort()
    expect(tocan).toEqual(Object.keys(SESION_DEL_NAVEGADOR).sort())
    const borradores = sources(SRC)
      .filter((file) => /caja\.borrador/.test(readFileSync(file, 'utf8')))
      .map(ruta)
    expect(borradores).toEqual(['portal/escritura/borrador.ts'])
  })
})
