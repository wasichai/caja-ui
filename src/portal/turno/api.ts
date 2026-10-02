import { client } from '../api'
import { enviar } from '../cobro/api'
import type { ArqueoDelTurno, CierreHecho, PeticionDeCierre, PeticionDeReversion, ReversionHecha, TurnoDelDia } from '../types'

// caja-backend's turno (/api/caja/turnos/**), as «Cierre y arqueo de caja» uses it

// what is read again after a write: today's turno and every arqueo
export const CLAVE_DE_LOS_TURNOS = ['caja', 'turnos'] as const

export const turnos = {
  // the session's cashier, today in Lima. it takes no parameter (any is a 400) and opens nothing
  delDia: () => client.request<TurnoDelDia>('/caja/turnos/del-dia'),
  claveDelDia: [...CLAVE_DE_LOS_TURNOS, 'del-dia'] as const,
  // the live arqueo: nothing declared, nothing written
  arqueo: (turnoId: string) => client.request<ArqueoDelTurno>(`/caja/turnos/${encodeURIComponent(turnoId)}/arqueo`),
  claveDelArqueo: (turnoId: string) => [...CLAVE_DE_LOS_TURNOS, turnoId, 'arqueo'] as const,
  // the acts: a cierre is not modified, it is reversed by another
  cerrar: (peticion: PeticionDeCierre) => enviar<CierreHecho>('/caja/turnos/cierre', peticion),
  reversar: (peticion: PeticionDeReversion) => enviar<ReversionHecha>('/caja/turnos/reversion', peticion)
}
