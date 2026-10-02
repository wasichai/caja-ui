// copiado de srtm-ui@a1df33a (src/themes/useVarianteTema.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { PORTAL_TRIBUTARIO_THEME, useTheme } from '@wasichai/core'

export const TEMA_PORTAL = PORTAL_TRIBUTARIO_THEME.id

// which structure the screens draw: 'portal' (brand bar, tree menu, chevron steps...) only under the
// portal-tributario theme; light, dark and the os setting keep the classic shell
export type VarianteTema = 'portal' | 'clasico'

// reads the theme core applied, not the stored pick: an id core does not know falls to the os setting, so classic
export function useVarianteTema(): VarianteTema {
  return useTheme().theme.id === TEMA_PORTAL ? 'portal' : 'clasico'
}
