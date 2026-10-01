import { PORTAL_TRIBUTARIO_THEME, type ThemeDefinition } from '@wasichai/core'

export { TEMA_PORTAL, useVarianteTema, type VarianteTema } from './useVarianteTema'

// caja's themes, on top of core's light and dark: portal-tributario, which @wasichai/core defines (its label is in
// core's i18n) and @wasichai/ui styles. portal and admin both register it (config.themes), so a pick on one side shows
// on the other. index.html keeps an id -> color scheme copy for its boot script
export const CAJA_THEMES: ThemeDefinition[] = [PORTAL_TRIBUTARIO_THEME]
