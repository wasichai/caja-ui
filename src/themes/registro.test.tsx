import { BUILT_IN_THEMES, resolveConfig } from '@wasichai/core'
import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import { CAJA_THEMES } from '.'

// index.html's boot script, run against a theme stored under caja.theme and the os setting before the bundle loads
function boot(stored: string | null, systemDark = false) {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (!script) throw new Error('index.html has no inline boot script')
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
  const run = new Function('localStorage', 'matchMedia', 'document', script)
  run({ getItem: (key: string) => (key === 'caja.theme' ? stored : null) }, () => ({ matches: systemDark }), { documentElement: root })
  return { theme: root.dataset.theme, colorScheme: root.style.colorScheme }
}

describe('caja themes', () => {
  it('registers portal-tributario, light, with an id core accepts', () => {
    expect(CAJA_THEMES).toEqual([{ id: 'portal-tributario', label: expect.any(String), colorScheme: 'light' }])
    for (const theme of CAJA_THEMES) {
      expect(theme.id).toMatch(/^[a-z0-9-]{1,40}$/)
      expect(BUILT_IN_THEMES.map((builtIn) => builtIn.id)).not.toContain(theme.id)
    }
    expect(() => resolveConfig({ themes: CAJA_THEMES })).not.toThrow()
  })

  // the boot script cannot import CAJA_THEMES: it keeps its own id -> scheme map, which must not drift
  it.each([...BUILT_IN_THEMES, ...CAJA_THEMES])('boots $id with its color scheme, before the bundle', ({ id, colorScheme }) => {
    expect(boot(id)).toEqual({ theme: id, colorScheme })
  })

  it.each([null, 'system', 'otra-app', 'toString', '__proto__'])('boots %s as the os setting', (stored) => {
    expect(boot(stored)).toEqual({ theme: 'light', colorScheme: 'light' })
    expect(boot(stored, true)).toEqual({ theme: 'dark', colorScheme: 'dark' })
  })
})
