import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingState, useAuth } from '@wasichai/core'
import { Button, Table, Td, Th } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { SinDato } from '../cifras/Importe'
import { Alerta } from '../components/Alerta'
import { BotonConMotivo } from '../components/BotonConMotivo'
import { leerBorrador } from '../escritura/borrador'
import { fechaYHoraEnLima } from '../fechas'
import { etiqueta } from '../forms/etiquetas'
import { CLAVE_DE_LOS_TURNOS } from '../turno/api'
import type { PagoDelBuzon, TurnoEnElDia } from '../types'
import { pagos } from './api'
import { ExplicarElPago } from './ExplicarElPago'
import { impedimentoDeLaCuenta, impedimentoDelPago } from './impedimentos'

// «Pagos sin entregar», in «Cierre y arqueo de caja» (caja-web's block «Pagos pendientes de entrega»): the payments
// whose source system did not get them after every retry (MUERTO), oldest first. while one of a turno is there, that
// turno does not close: whoever has the permission explains it, and then it closes. a 403 is said in its slot and the
// leaf goes on. after explaining, the payments and the arqueo are read again: the state is the backend's, never set here.
// the list has every turno's: each row says its turno, and those of the turno being closed go first

// where the cierre's 409 «Hay pagos sin entregar» leads
const ANCLA = 'pagos-sin-entregar'
const TITULO = `${ANCLA}-titulo`
const SIN_PERMISO = 'explicar-impedido'

// a link to the block: it moves the focus to its heading, which brings it into view
export function IrALosPagosSinEntregar() {
  return (
    <a
      href={`#${ANCLA}`}
      className="font-semibold underline"
      onClick={(e) => {
        e.preventDefault()
        document.getElementById(TITULO)?.focus()
      }}
    >
      Ir a los pagos sin entregar
    </a>
  )
}

// the turno of a row: one of the clerk's today by its caja and day (the one being closed, marked), another by its id
function turnoDe(pago: PagoDelBuzon, elegido: TurnoEnElDia | null, delDia: TurnoEnElDia[]): ReactNode {
  if (!pago.turno_id) return <SinDato motivo="el backend no mandó su turno" />
  const conocido = delDia.find((t) => t.turno_id === pago.turno_id)
  if (!conocido) return pago.turno_id
  const nombre = `${conocido.caja ?? 'Caja sin código'} del ${formatDate(conocido.fecha)}`
  return conocido.turno_id === elegido?.turno_id ? `${nombre} (el que va a cerrar)` : nombre
}

export function PagosSinEntregar({
  turno,
  turnosDelDia
}: {
  // the turno being closed, if one is chosen: its payments go first
  turno: TurnoEnElDia | null
  // the clerk's turnos of today: a row of one of them is named by its caja and day
  turnosDelDia: TurnoEnElDia[]
}) {
  const { can, user } = useAuth()
  const queryClient = useQueryClient()
  const lista = useQuery({ queryKey: pagos.claveSinEntregar, queryFn: pagos.sinEntregar })
  // the act open, by its payment
  const [elegido, setElegido] = useState<string | null>(null)
  const [explicado, setExplicado] = useState<PagoDelBuzon | null>(null)
  // a 409 to an explanation: kept here, since the re-read takes the payment (and its act) off the list
  const [rechazo, setRechazo] = useState<{ pagoId: string; detalle: string } | null>(null)

  // what the backend says now: the payments and the arqueo (whether the turno may close), read again
  const leerOtraVez = () => {
    void queryClient.invalidateQueries({ queryKey: pagos.claveSinEntregar, refetchType: 'all' })
    void queryClient.invalidateQueries({ queryKey: CLAVE_DE_LOS_TURNOS, refetchType: 'all' })
  }

  // the order is the backend's (oldest first), with the turno being closed in front: nothing is added nor dropped
  const leidas = lista.data ?? []
  const filas = turno ? [...leidas.filter((p) => p.turno_id === turno.turno_id), ...leidas.filter((p) => p.turno_id !== turno.turno_id)] : leidas
  // back from a 401 with the same account, the act of the payment that kept a draft opens again
  const conBorrador = user ? filas.find((pago) => leerBorrador(`explicacion.${pago.pago_id}`, user.id) !== null) : undefined
  const abierto = filas.find((pago) => pago.pago_id === (elegido ?? conBorrador?.pago_id))
  const sinPermiso = impedimentoDeLaCuenta(can)

  return (
    <section id={ANCLA} aria-labelledby={TITULO} className="space-y-3">
      <h2 id={TITULO} tabIndex={-1} className="text-lg font-semibold text-ink">
        Pagos sin entregar
      </h2>
      <p className="text-sm text-ink-muted">
        Los cobros que su sistema de origen no recibió después de agotar los reintentos, del más antiguo al más reciente. Mientras un turno tenga alguno, no se
        cierra: quien tiene el permiso lo explica por escrito, y entonces el turno cierra. Los que todavía se están intentando entregar no salen aquí: se
        entregan solos, y el arqueo los nombra. Los del turno que va a cerrar van primero.
      </p>
      {explicado && (
        <Alerta tono="exito">
          Se explicó el pago {explicado.pago_id}: el backend lo dejó «{etiqueta('estado_evento', explicado.estado)}».
        </Alerta>
      )}
      {rechazo && (
        <Alerta tono="error">
          No se explicó el pago {rechazo.pagoId}: {rechazo.detalle}
        </Alerta>
      )}
      {lista.isPending ? (
        <LoadingState label="Leyendo los pagos sin entregar…" />
      ) : lista.isError ? (
        <Alerta tono="error">No se pudieron leer los pagos sin entregar: {errorMessage(lista.error, 'el backend no contestó')}</Alerta>
      ) : filas.length === 0 ? (
        <p className="text-sm text-ink">No hay pagos sin entregar</p>
      ) : (
        <>
          {sinPermiso && (
            <p id={SIN_PERMISO} className="text-sm text-ink-muted">
              {sinPermiso}
            </p>
          )}
          <TablaDePagos
            pagos={filas}
            turnoDe={(pago) => turnoDe(pago, turno, turnosDelDia)}
            sinPermiso={sinPermiso}
            onExplicar={(pagoId) => {
              setExplicado(null)
              setRechazo(null)
              setElegido(pagoId)
            }}
          />
          {abierto && !sinPermiso && impedimentoDelPago(abierto) === null && (
            <ExplicarElPago
              key={abierto.pago_id}
              pago={abierto}
              onCerrar={() => setElegido(null)}
              onExplicado={(hecho) => {
                setElegido(null)
                setRechazo(null)
                setExplicado(hecho)
                leerOtraVez()
              }}
              onChoque={(detalle) => {
                setElegido(null)
                setRechazo({ pagoId: abierto.pago_id, detalle })
                leerOtraVez()
              }}
            />
          )}
        </>
      )}
    </section>
  )
}

function TablaDePagos({
  pagos,
  turnoDe,
  sinPermiso,
  onExplicar
}: {
  pagos: PagoDelBuzon[]
  turnoDe: (pago: PagoDelBuzon) => ReactNode
  sinPermiso: string | null
  onExplicar: (pagoId: string) => void
}) {
  const derecha = 'text-right'
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Pagos sin entregar">
        <thead>
          <tr>
            <Th>Pago</Th>
            <Th>Turno</Th>
            <Th>Tipo</Th>
            <Th>Destino</Th>
            <Th className={derecha}>Recibo</Th>
            <Th className={derecha}>Intentos</Th>
            <Th>Último error</Th>
            <Th>Creado</Th>
            <Th>Estado</Th>
            <Th>
              <span className="sr-only">Explicar</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {pagos.map((pago) => (
            <tr key={pago.pago_id}>
              <Td className="break-all tabular-nums">{pago.pago_id}</Td>
              <Td className="break-all">{turnoDe(pago)}</Td>
              <Td>{etiqueta('tipo_evento_pago', pago.tipo)}</Td>
              <Td>{pago.destino}</Td>
              <Td className={`${derecha} tabular-nums`}>{pago.recibo ?? <SinDato motivo="el recibo no se pudo leer" />}</Td>
              <Td className={`${derecha} tabular-nums`}>{pago.intentos}</Td>
              <Td>{pago.ultimo_error ?? <SinDato motivo="el backend no registró ningún error" />}</Td>
              <Td>{pago.creado_en ? fechaYHoraEnLima(pago.creado_en) : <SinDato motivo="el backend no mandó cuándo se cobró" />}</Td>
              <Td>{etiqueta('estado_evento', pago.estado)}</Td>
              <Td>
                <BotonDeExplicar pago={pago} sinPermiso={sinPermiso} onExplicar={onExplicar} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

// never mute: without the permission, the reason is said once above the table and is each button's description; one of
// the payment's own goes at its side
function BotonDeExplicar({ pago, sinPermiso, onExplicar }: { pago: PagoDelBuzon; sinPermiso: string | null; onExplicar: (pagoId: string) => void }) {
  const nombre = `Explicar el pago ${pago.pago_id}`
  if (sinPermiso)
    return (
      <Button size="sm" variant="secondary" disabled aria-label={nombre} aria-describedby={SIN_PERMISO}>
        Explicar
      </Button>
    )
  return (
    <BotonConMotivo
      id={`explicar-impedido-${pago.pago_id}`}
      nombre={nombre}
      impedido={impedimentoDelPago(pago)}
      variante="secondary"
      onClick={() => onExplicar(pago.pago_id)}
    >
      Explicar
    </BotonConMotivo>
  )
}
