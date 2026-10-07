// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { diaEnLima, fechaYHoraEnLima, hoyEnLima } from './fechas'

// caja's day and hour are Lima's (UTC-5, no daylight saving), whatever the machine's: the hours after 19:00 in Lima are
// already the next day in UTC, and that is where «hoy» would go wrong

describe('hoyEnLima', () => {
  it('is Lima’s day late at night, when UTC is already the next one', () => {
    expect(hoyEnLima(new Date('2026-10-03T04:30:00Z'))).toBe('2026-10-02')
  })

  it('is the new day right after midnight in Lima', () => {
    expect(hoyEnLima(new Date('2026-10-03T05:00:00Z'))).toBe('2026-10-03')
  })

  it('writes the day as the backend does', () => {
    expect(hoyEnLima(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05')
  })
})

describe('fechaYHoraEnLima', () => {
  it('writes an instant of the backend as Lima’s day and hour, on 24 hours', () => {
    expect(fechaYHoraEnLima('2026-10-02T23:15:30.123456-05:00')).toBe('02/10/2026 23:15 (hora de Lima)')
    expect(fechaYHoraEnLima('2026-10-03T04:15:00Z')).toBe('02/10/2026 23:15 (hora de Lima)')
    expect(fechaYHoraEnLima('2026-10-02T00:05:00-05:00')).toBe('02/10/2026 00:05 (hora de Lima)')
  })

  it('leaves as it came an instant it cannot read', () => {
    expect(fechaYHoraEnLima('ayer a las tres')).toBe('ayer a las tres')
  })
})

describe('diaEnLima', () => {
  it('is the day in Lima of an instant, or null when it cannot be read', () => {
    expect(diaEnLima('2026-10-03T03:59:00Z')).toBe('2026-10-02')
    expect(diaEnLima('no es una fecha')).toBeNull()
  })
})
