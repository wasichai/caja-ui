import type { ComponentType } from 'react'
import type { ClaveDeHoja } from './shell/navTree'

// the screen of each leaf of the tree, by its key. a leaf with none is not drawn, since a menu entry that leads
// nowhere is a defect (caja ADR-0044): each screen's PR registers it here
export const PANTALLAS: Partial<Record<ClaveDeHoja, ComponentType>> = {}
