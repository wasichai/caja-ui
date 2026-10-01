// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast, rule, rules } from './css'

// portal-tributario's partials for the pieces the portal draws: every rule under the theme and outside any layer (so
// it wins over tailwind's utilities), each imported by the theme's index.css. the tokens are @wasichai/ui's

const dir = join(__dirname, 'portal-tributario')
const read = (file: string) => readFileSync(join(dir, file), 'utf8')
// the theme's tokens, from @wasichai/ui's sheet
const libraryTokens = () =>
  readFileSync(join(__dirname, '..', '..', 'node_modules', '@wasichai', 'ui', 'dist', 'themes', 'portal-tributario', 'tokens.css'), 'utf8')

const PORTAL = "[data-theme='portal-tributario']"
const PARCIALES = ['shell.css', 'tabs.css', 'nav.css']

describe('portal-tributario partials', () => {
  it('are the ones listed here', () => {
    const css = readdirSync(dir).filter((file) => file.endsWith('.css') && file !== 'index.css')
    expect(css.sort()).toEqual([...PARCIALES].sort())
  })

  describe.each(PARCIALES)('%s', (file) => {
    const css = read(file)

    it('is imported by the theme', () => {
      expect(read('index.css')).toContain(`@import './${file}';`)
    })

    it('scopes every rule to the theme', () => {
      const selectors = rules(css).flatMap((r) => r.selectors)
      expect(selectors.length).toBeGreaterThan(0)
      expect(selectors.filter((selector) => !selector.startsWith(`${PORTAL} `))).toEqual([])
    })

    it('stays outside any layer', () => {
      expect(css).not.toMatch(/@layer/)
    })
  })
})

describe('tabs.css', () => {
  const css = read('tabs.css')

  it('joins the active workspace tab to what is under it', () => {
    const active = rule(css, `${PORTAL} [data-ui='workspace-tab']:has(> [aria-current='page'])`)
    expect(active.get('background')).toBe('var(--surface)')
    expect(active.get('border-bottom-color')).toBe('var(--surface)')
  })
})

describe('nav.css', () => {
  const css = read('nav.css')
  const tokens = rule(libraryTokens(), PORTAL)
  const ARBOL = `${PORTAL} [data-ui='arbol-nav']`
  const arbol = (part: string) => rule(css, `${ARBOL} ${part}`)
  const actual = arbol("[data-ui='arbol-hoja'][aria-current='page']")
  const hover = arbol("[data-ui='arbol-hoja']:hover")
  const grupo = arbol("[data-ui='arbol-grupo']:hover")
  const caret = arbol("[data-ui='arbol-caret']")

  it('only styles the tree', () => {
    const selectors = rules(css).flatMap((r) => r.selectors)
    expect(selectors.filter((selector) => !selector.startsWith(`${ARBOL} `))).toEqual([])
  })

  // over the lateral (table-head): a hovered leaf, the current one and a hovered group at 4.5:1; the caret, a graphic
  // next to its group's name, at 3:1
  it('keeps AA over the backgrounds it paints', () => {
    const head = tokens.get('--table-head')!
    expect(contrast(tokens.get('--link')!, hover.get('background-color')!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(actual.get('color')!, actual.get('background-color')!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(grupo.get('color')!, head)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(caret.get('color')!, head)).toBeGreaterThanOrEqual(3)
  })
})

describe('src/index.css', () => {
  it("imports the library's theme sheet after its base theme, then caja's own partials", () => {
    const index = readFileSync(join(__dirname, '..', 'index.css'), 'utf8')
    const at = (path: string) => index.indexOf(`@import '${path}';`)
    expect(at('tailwindcss')).toBeGreaterThanOrEqual(0)
    expect(at('@wasichai/ui/theme.css')).toBeGreaterThan(at('tailwindcss'))
    expect(at('@wasichai/ui/themes/portal-tributario.css')).toBeGreaterThan(at('@wasichai/ui/theme.css'))
    expect(at('./themes/portal-tributario/index.css')).toBeGreaterThan(at('@wasichai/ui/themes/portal-tributario.css'))
  })
})
