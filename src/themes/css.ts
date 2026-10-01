// copiado de srtm-ui@a1df33a (src/themes/css.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// helpers for the themes' tests: read a css rule and measure a contrast, without a css parser

// the declarations of the first rule whose selector list has `selector` (innermost rules, so `@layer` wrappers are skipped)
export function rule(css: string, selector: string): Map<string, string> {
  for (const { selectors, declarations } of rules(css)) if (selectors.includes(selector)) return declarations
  throw new Error(`no rule for ${selector}`)
}

// every innermost rule: its selectors (trimmed, one line each) and its declarations
export function rules(css: string): { selectors: string[]; declarations: Map<string, string> }[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
    selectors: splitTop(selectors.replace(/^[\s\S]*;/, '')).map((part) => part.trim().replace(/\s+/g, ' ')),
    declarations: new Map(
      body.split(';').flatMap((declaration) => {
        const colon = declaration.indexOf(':')
        return colon < 0 ? [] : [[declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()] as const]
      })
    )
  }))
}

// a selector list by its commas, not the ones inside :is(…) or :not(…)
function splitTop(list: string): string[] {
  const parts = ['']
  let depth = 0
  for (const char of list) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0
    if (char === ',' && depth === 0) parts.push('')
    else parts[parts.length - 1] += char
  }
  return parts
}

// #rgb, #rrggbb or rgb(r g b) / rgb(r, g, b), as 0-255 channels
function channels(color: string): number[] {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1]
    return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16))
  }
  const rgb = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/i.exec(color)
  if (rgb) return rgb.slice(1, 4).map(Number)
  throw new Error(`not a plain srgb color: ${color}`)
}

// WCAG 2.x relative luminance and contrast ratio
function luminance(color: string): number {
  const [r, g, b] = channels(color)
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}
