import { errorMessage } from '../../kit/ui/errorMessage'
import { loQueFalta, type Oferta, type Par } from '../shell/navTree'
import type { ArqueoDelTurno, TurnoEnElDia } from '../types'

// why «Cerrar el turno» or «Reversar el cierre» cannot go, or null: never a mute button (caja ADR-0044). the reasons go
// in the order they are fixed in, and the first that holds wins: first the account, then today's turno, the one chosen
// and, for the cierre, its arqueo. the backend checks them all again: this only spares the clerk a refusal, and says why

// what POST /turnos/cierre asks of the account (its 403): the acta and its lines
const PARA_CERRAR: Par[][] = [
  [
    { objeto: 'cierre_turno', accion: 'CREATE' },
    { objeto: 'cierre_turno_linea', accion: 'CREATE' }
  ]
]
// what POST /turnos/reversion asks (its 403: a CAJERO has not, a SUPERVISOR_CAJA has). it reverses only the session's
// own turno: another cashier's cierre is a 403 for a supervisor too, so no other account is ever pointed to
const PARA_REVERSAR: Par[][] = [[{ objeto: 'reversion_cierre', accion: 'CREATE' }]]

// today's turno as the screen has it: being read, not readable (with why), none today, several and none chosen, one of
// the url that is not today's, or the one chosen
export type ElTurno =
  | { estado: 'leyendo' }
  | { estado: 'ilegible'; error: unknown }
  | { estado: 'sin-turnos' }
  | { estado: 'sin-elegir' }
  | { estado: 'ajeno' }
  | { estado: 'elegido'; turno: TurnoEnElDia }

// the arqueo of the turno chosen
export type ElArqueo = { estado: 'leyendo' } | { estado: 'ilegible'; error: unknown } | { estado: 'leido'; arqueo: ArqueoDelTurno }

const SIN_CAJA = 'El backend no mandó la caja de este turno'

export function impedimentoDeCerrar(can: Oferta['can'], elTurno: ElTurno, elArqueo: ElArqueo): string | null {
  const sinPermiso = loQueFalta(PARA_CERRAR, can)
  if (sinPermiso) return `Su cuenta no puede cerrar turnos: le falta ${sinPermiso}.`
  if (elTurno.estado === 'leyendo') return 'Leyendo su turno de hoy…'
  if (elTurno.estado === 'ilegible') return `Sin su turno de hoy no se cierra: ${errorMessage(elTurno.error, 'el backend no contestó')}`
  if (elTurno.estado === 'sin-turnos') return 'Hoy no tiene ningún turno: no hay nada que cerrar.'
  if (elTurno.estado !== 'elegido') return 'Elija primero el turno que va a cerrar.'
  if (!elTurno.turno.caja) return `${SIN_CAJA}: sin ella no se cierra.`
  if (elArqueo.estado === 'leyendo') return 'Esperando el arqueo del backend.'
  if (elArqueo.estado === 'ilegible') return `Sin el arqueo no se cierra: ${errorMessage(elArqueo.error, 'el backend no contestó')}`
  const { arqueo } = elArqueo
  if (arqueo.estado_del_turno === 'CERRADO')
    return 'Este turno ya está cerrado: un cierre no se modifica. Para rehacerlo, se reversa (más abajo) y se cierra otra vez.'
  if (arqueo.lo_que_impide_cerrar.length > 0)
    return 'Hay pagos sin entregar a su sistema de origen (vea la lista del arqueo): hasta que se entreguen, o se expliquen los que no se pudieron entregar, el turno no se cierra.'
  if (!arqueo.puede_cerrar) return 'El backend dice que este turno no se puede cerrar todavía.'
  return null
}

export function impedimentoDeReversar(can: Oferta['can'], elTurno: ElTurno): string | null {
  const sinPermiso = loQueFalta(PARA_REVERSAR, can)
  if (sinPermiso)
    return `Su cuenta no puede reversar un cierre: le falta ${sinPermiso}. Un cierre solo se reversa desde la cuenta del cajero del turno: otra cuenta no puede reversarlo por usted, aunque tenga ese permiso.`
  if (elTurno.estado === 'leyendo') return 'Leyendo su turno de hoy…'
  if (elTurno.estado === 'ilegible') return `Sin su turno de hoy no se reversa: ${errorMessage(elTurno.error, 'el backend no contestó')}`
  if (elTurno.estado === 'sin-turnos') return 'Hoy no tiene ningún turno: no hay cierre que reversar.'
  if (elTurno.estado !== 'elegido') return 'Elija primero el turno cuyo cierre va a reversar.'
  if (!elTurno.turno.caja) return `${SIN_CAJA}: sin ella no se reversa.`
  // the state is the backend's, read again after every write: never set here
  if (elTurno.turno.estado_del_turno !== 'CERRADO') return 'Este turno está abierto: no hay ningún cierre que reversar.'
  return null
}
