import type { UseQueryResult } from '@tanstack/react-query'
import { LoadingState } from '@wasichai/core'
import { Button, Table, Td, Th } from '@wasichai/ui'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Alerta } from '../components/Alerta'
import { fechaYHoraEnLima } from '../fechas'
import { etiqueta } from '../forms/etiquetas'
import type { TurnoDelDia as ElDelDia, TurnoEnElDia } from '../types'
import type { ElTurno } from './impedimentos'

// the clerk's turno of today (GET /turnos/del-dia): the situation in words, and its turnos with their caja, when they
// were opened (Lima's hour) and their state. «Arquear» takes one to the route (?turno=)

const SITUACIONES: Record<string, string> = {
  SIN_ABRIR: 'Hoy todavía no abrió ningún turno: el turno se abre con el primer cobro del día. No hay nada que arquear ni que cerrar.',
  ABIERTO: 'Tiene un turno abierto: al terminar el día, cuente el cajón y ciérrelo aquí.',
  CERRADO: 'Su turno de hoy está cerrado. Para seguir cobrando no se abre otro: un supervisor de caja reversa el cierre.',
  VARIOS_ABIERTOS: 'Tiene turnos abiertos en más de una caja: elija cuál va a arquear y cerrar.'
}

// the situation as a sentence; one caja does not know, as the backend wrote it
const enPalabras = (situacion: string) =>
  Object.hasOwn(SITUACIONES, situacion) ? SITUACIONES[situacion] : `El backend dice que su situación es «${situacion}».`

// a caja by its code and name: «C-01 — VENTANILLA 1»
export const nombreDeCaja = (turno: TurnoEnElDia) => [turno.caja ?? 'Caja sin código', turno.caja_nombre].filter(Boolean).join(' — ')

export function TurnoDelDia({ delDia, elTurno, onElegir }: { delDia: UseQueryResult<ElDelDia>; elTurno: ElTurno; onElegir: (turnoId: string) => void }) {
  return (
    <section aria-labelledby="turno-del-dia-titulo" data-testid="turno-del-dia" className="space-y-3">
      <h2 id="turno-del-dia-titulo" className="text-lg font-semibold text-ink">
        Su turno de hoy
      </h2>
      {delDia.isPending ? (
        <LoadingState label="Leyendo su turno de hoy…" />
      ) : delDia.isError ? (
        <Alerta tono="error">No se pudo leer su turno de hoy: {errorMessage(delDia.error, 'el backend no contestó')}</Alerta>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            Cajero: {delDia.data.cajero} · Día: {formatDate(delDia.data.fecha)}
          </p>
          <p data-testid="situacion" className="text-sm text-ink">
            {enPalabras(delDia.data.situacion)}
          </p>
          {delDia.data.turnos.length > 0 && <TablaDeTurnos turnos={delDia.data.turnos} onElegir={onElegir} />}
          {elTurno.estado === 'sin-elegir' && <p className="text-sm text-ink-muted">Elija el turno que va a arquear con «Arquear».</p>}
          {elTurno.estado === 'ajeno' && <Alerta tono="atencion">El turno de la dirección no es uno de sus turnos de hoy: elija uno de la lista.</Alerta>}
        </>
      )}
    </section>
  )
}

function TablaDeTurnos({ turnos, onElegir }: { turnos: TurnoEnElDia[]; onElegir: (turnoId: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Turnos de hoy">
        <thead>
          <tr>
            <Th>Caja</Th>
            <Th>Abierto el</Th>
            <Th>Estado</Th>
            <Th>
              <span className="sr-only">Arquear</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((turno) => (
            <tr key={turno.turno_id}>
              <Td>{nombreDeCaja(turno)}</Td>
              <Td>{fechaYHoraEnLima(turno.abierto_en)}</Td>
              <Td>{etiqueta('estado_del_turno', turno.estado_del_turno)}</Td>
              <Td>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Arquear el turno de ${turno.caja ?? turno.turno_id}`}
                  onClick={() => onElegir(turno.turno_id)}
                >
                  Arquear
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
