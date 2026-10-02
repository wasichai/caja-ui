// caja's day and hour are Lima's, not the machine's (caja-backend's reloj): what day it is there, and when an instant
// was there

const PARTES = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

function partes(instante: Date): Record<string, string> {
  return Object.fromEntries(PARTES.formatToParts(instante).map((p) => [p.type, p.value]))
}

// today in Lima, as the backend writes a date: 2026-10-02
export function hoyEnLima(ahora = new Date()): string {
  const { year, month, day } = partes(ahora)
  return `${year}-${month}-${day}`
}

// an instant of the backend (2026-10-02T10:15:30.123456-05:00) as Lima's day and hour: "02/10/2026 10:15 (hora de
// Lima)". one that cannot be read goes as it came
export function fechaYHoraEnLima(instante: string): string {
  const fecha = new Date(instante)
  if (Number.isNaN(fecha.getTime())) return instante
  const { year, month, day, hour, minute } = partes(fecha)
  return `${day}/${month}/${year} ${hour}:${minute} (hora de Lima)`
}
