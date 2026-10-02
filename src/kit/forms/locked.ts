// copiado de srtm-ui@a1df33a (src/kit/forms/locked.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import type { UseFormReturn } from 'react-hook-form'
import type { FormValues } from './spec'

// fields filled from elsewhere (a record picked from another list): greyed and sent as they are, until the clerk
// unlocks them. the list rides in the form's own values, under a name no field has, so it is never sent
export const LOCKED = '__locked'

export const lockedOf = (values: FormValues): string[] => (values[LOCKED] ?? '').split(',').filter(Boolean)

export const lock = (form: UseFormReturn<FormValues>, names: string[]) => form.setValue(LOCKED, names.join(','))

export const unlock = (form: UseFormReturn<FormValues>) => lock(form, [])

// for the form's own widgets, while rendering: watched, so a change re-renders them
export const lockedIn = (form: UseFormReturn<FormValues>): string[] => lockedOf({ [LOCKED]: form.watch(LOCKED) ?? '' })
