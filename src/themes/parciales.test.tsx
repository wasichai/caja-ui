// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rule, rules } from '../test/css'

// portal-tributario's partials for the pieces the portal draws: every rule under the theme and outside any layer (so
// it wins over tailwind's utilities), each imported by the theme's index.css. the tokens are @wasichai/ui's

const dir = join(__dirname, 'portal-tributario')
const read = (file: string) => readFileSync(join(dir, file), 'utf8')

const PORTAL = "[data-theme='portal-tributario']"
const PARCIALES = ['shell.css', 'tabs.css']

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
