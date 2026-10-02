// copiado de srtm-ui@a1df33a (src/kit/boundaries.test.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// kit = code waiting to move to wasichai-ui. it must not know the app it grows in.
// import.meta.dirname, not new URL(.., import.meta.url): vite rewrites the latter under jsdom
const SRC = import.meta.dirname
// besides other kit files: only what wasichai-ui packages already depend on
const ALLOWED = /^(react|react-dom|react-hook-form|react-router|@tanstack\/react-query|@wasichai\/core|@wasichai\/ui|lucide-react)$/
// app vocabulary. a hit means domain leaked in: this app's (the cash desk), and the one the kit was copied from
const DOMAIN = new RegExp(
  [
    // this app
    'recibo|orden de cobro|orden_de_cobro|cobr|tasa|turno|cierre|arqueo|cajer|tesorer|ventanilla|conciliaci',
    // the app it was copied from
    'contribuyente|predio|declaraci|srtm|rentas|ubigeo|reniec|padr[oó]n|catastro|peren[eé]|\\bdj\\b'
  ].join('|'),
  'i'
)

// the line every kit source opens with: where it was copied from, and where it goes
const header = (file: string) =>
  `// copiado de srtm-ui@a1df33a (src/kit/${relative(SRC, file).split(sep).join('/')}): sube a wasichai-ui en la fase 2 (wasichai-ui#14)`

// non-test sources only. tests may know whatever they like
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

// from '..', import '..', import('..'): dynamic import is a side door otherwise. single or double quotes: the
// formatter writes single, but a file it has not touched may not
function importsOf(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/(?:from |import |import\()(['"])([^'"\n]+)\1/g)].map((match) => match[2])
}

// what a file says past its header: the header names the app it was copied from, and only there may it
function body(file: string): string {
  const [first, ...rest] = readFileSync(file, 'utf8').split('\n')
  return first === header(file) ? rest.join('\n') : [first, ...rest].join('\n')
}

const insideKit = (path: string) => path === SRC || path.startsWith(SRC + sep)

// relative: must land inside kit. bare: package root (@scope/name or name) must be allowed
function offends(file: string, specifier: string): boolean {
  if (specifier.startsWith('.')) return !insideKit(resolve(dirname(file), specifier))
  return !ALLOWED.test(
    specifier
      .split('/')
      .slice(0, specifier.startsWith('@') ? 2 : 1)
      .join('/')
  )
}

describe('kit boundaries', () => {
  it('imports only kit files and the allowed packages', () => {
    const offenders = sources(SRC).flatMap((file) =>
      importsOf(file)
        .filter((specifier) => offends(file, specifier))
        .map((specifier) => `${relative(SRC, file)} -> ${specifier}`)
    )
    expect(offenders).toEqual([])
  })

  it('does not speak the app domain', () => {
    const offenders = sources(SRC).flatMap((file) => {
      const hit = DOMAIN.exec(body(file))
      return hit ? [`${relative(SRC, file)} -> ${hit[0]}`] : []
    })
    expect(offenders).toEqual([])
  })

  // a temporary copy, marked: each file says where it came from and where it goes (wasichai-ui#14)
  it('opens every source with its copy header, naming its own path', () => {
    const files = sources(SRC)
    expect(files.length).toBeGreaterThan(10)
    const unmarked = files.filter((file) => readFileSync(file, 'utf8').split('\n')[0] !== header(file)).map((file) => relative(SRC, file))
    expect(unmarked).toEqual([])
  })
})
