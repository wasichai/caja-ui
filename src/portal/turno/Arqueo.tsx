import { Alert, Table, Td, Th } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { FechaDeLasCifras, Importe, SinDato } from '../cifras/Importe'
import type { Cifra } from '../cifras/Importe'
import { etiqueta } from '../forms/etiquetas'
import type { Arqueo, ArqueoDelTurno, PagoSinEntregar } from '../types'

// the arqueo as the backend gives it, live or as a cierre froze it: a row per forma de pago and the totals, every figure
// the backend's (the client adds and subtracts nothing). what nobody counted says «sin declarar», never a 0

export const SIN_DECLARAR = 'sin declarar'

// why the live arqueo has no declared figures, by the state of its turno. the backend's live GET gives them in null for
// every turno, closed included: an open one has not been counted yet; a closed one was, and its acta kept it
export interface PorQueSinDeclarar {
  // in the cells of declarado and diferencia
  cifra: string
  // whether it squares
  cuadra: string
  // the line above the table
  explicacion: string
}

export function porQueSinDeclarar(estadoDelTurno: string): PorQueSinDeclarar {
  return estadoDelTurno === 'CERRADO'
    ? {
        cifra: 'el arqueo en vivo no guarda lo declarado: lo guardó el cierre',
        cuadra: 'el arqueo en vivo no lo guarda: lo dice el acta del cierre',
        explicacion: 'Este turno está cerrado: el arqueo en vivo no guarda lo declarado ni la diferencia, que quedaron en el acta del cierre.'
      }
    : {
        cifra: SIN_DECLARAR,
        cuadra: `${SIN_DECLARAR}: el backend lo dice al cerrar`,
        explicacion: 'Lo declarado y la diferencia los da el backend al cerrar, con lo que usted contó.'
      }
}

// a declared figure, or why there is none
function Declarable({ cifra, fecha, motivo }: { cifra: Cifra | null; fecha: string | undefined; motivo: string }) {
  return cifra ? <Importe cifra={cifra} fechaDeLaTabla={fecha} /> : <SinDato motivo={motivo} />
}

// the date of the table's figures, when they all share it: it goes once, in the caption
function fechaComun(arqueo: Arqueo): string | undefined {
  const cifras = [
    ...arqueo.lineas.flatMap((l) => [l.cobrado, l.anulado, l.neto, l.declarado, l.diferencia]),
    arqueo.total_cobrado,
    arqueo.total_anulado,
    arqueo.neto,
    arqueo.total_declarado,
    arqueo.diferencia
  ].filter((c): c is Cifra => c !== null)
  const fechas = new Set(cifras.map((c) => c.actualizado_a))
  return fechas.size === 1 ? cifras[0].actualizado_a : undefined
}

// `sinDeclarar`: why a declared figure is missing (porQueSinDeclarar)
export function TablaDeArqueo({ arqueo, nombre, sinDeclarar }: { arqueo: Arqueo; nombre: string; sinDeclarar: string }) {
  const fecha = fechaComun(arqueo)
  const derecha = 'text-right'
  return (
    <div className="overflow-x-auto">
      <Table aria-label={nombre}>
        {fecha && (
          <caption className="caption-top pb-1 text-left text-xs text-ink-muted">
            Cifras <FechaDeLasCifras fecha={fecha} />
          </caption>
        )}
        <thead>
          <tr>
            <Th>Forma de pago</Th>
            <Th className={derecha}>Cobrado</Th>
            <Th className={derecha}>Anulado</Th>
            <Th className={derecha}>Neto</Th>
            <Th className={derecha}>Declarado</Th>
            <Th className={derecha}>Diferencia</Th>
          </tr>
        </thead>
        <tbody>
          {arqueo.lineas.length === 0 ? (
            <tr>
              <Td colSpan={6} className="text-ink-muted">
                Este turno no tiene movimiento.
              </Td>
            </tr>
          ) : (
            arqueo.lineas.map((linea) => (
              <tr key={linea.forma_pago}>
                <Td>{etiqueta('forma_pago', linea.forma_pago)}</Td>
                <Td className={derecha}>
                  <Importe cifra={linea.cobrado} fechaDeLaTabla={fecha} />
                </Td>
                <Td className={derecha}>
                  <Importe cifra={linea.anulado} fechaDeLaTabla={fecha} />
                </Td>
                <Td className={derecha}>
                  <Importe cifra={linea.neto} fechaDeLaTabla={fecha} />
                </Td>
                <Td className={derecha}>
                  <Declarable cifra={linea.declarado} fecha={fecha} motivo={sinDeclarar} />
                </Td>
                <Td className={derecha}>
                  <Declarable cifra={linea.diferencia} fecha={fecha} motivo={sinDeclarar} />
                </Td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <Td>Total</Td>
            <Td className={derecha}>
              <Importe cifra={arqueo.total_cobrado} fechaDeLaTabla={fecha} />
            </Td>
            <Td className={derecha}>
              <Importe cifra={arqueo.total_anulado} fechaDeLaTabla={fecha} />
            </Td>
            <Td className={derecha}>
              <Importe cifra={arqueo.neto} fechaDeLaTabla={fecha} />
            </Td>
            <Td className={derecha}>
              <Declarable cifra={arqueo.total_declarado} fecha={fecha} motivo={sinDeclarar} />
            </Td>
            <Td className={derecha}>
              <Declarable cifra={arqueo.diferencia} fecha={fecha} motivo={sinDeclarar} />
            </Td>
          </tr>
        </tfoot>
      </Table>
    </div>
  )
}

// one datum of a summary: «Recibos emitidos: 4»
export function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1 text-sm">
      <dt className="text-ink-muted">{rotulo}:</dt> <dd className="text-ink">{children}</dd>
    </div>
  )
}

// whether what was declared matches the neto, as the backend says it; `motivo`, why the backend did not say it
export function Cuadra({ cuadra, motivo }: { cuadra: boolean | null; motivo: string }) {
  if (cuadra === null) return <SinDato motivo={motivo} />
  return cuadra ? <>Sí: lo declarado coincide con el neto.</> : <>No: el descuadre quedó registrado en el acta.</>
}

// what the live arqueo adds to its table: the recibos, the two halves of the neto (with and without an event for the
// source system), the state of the turno and whether it squares
export function ResumenDelArqueo({ delTurno }: { delTurno: ArqueoDelTurno }) {
  const { arqueo } = delTurno
  const porQue = porQueSinDeclarar(delTurno.estado_del_turno)
  return (
    <dl data-testid="resumen-del-arqueo" className="grid gap-1 sm:grid-cols-2">
      <Dato rotulo="Recibos emitidos">{arqueo.recibos_emitidos}</Dato>
      <Dato rotulo="Recibos anulados">{arqueo.recibos_anulados}</Dato>
      <Dato rotulo="Cobrado con evento">
        <Importe cifra={delTurno.cobrado_con_evento} />
      </Dato>
      <Dato rotulo="Cobrado sin evento">
        <Importe cifra={delTurno.cobrado_sin_evento} />
      </Dato>
      <Dato rotulo="Estado del turno">{etiqueta('estado_del_turno', delTurno.estado_del_turno)}</Dato>
      <Dato rotulo="¿Cuadra?">
        <Cuadra cuadra={arqueo.cuadra} motivo={porQue.cuadra} />
      </Dato>
    </dl>
  )
}

// the payments that keep the turno from closing, one by one: its id, its kind and its state (PENDIENTE or MUERTO). the
// MUERTO ones are explained in «Pagos sin entregar» (buzon/PagosSinEntregar.tsx), below
export function PagosSinEntregar({ pagos }: { pagos: PagoSinEntregar[] }) {
  if (pagos.length === 0) return null
  return (
    <Alert tone="warning" title="Hay pagos sin entregar a su sistema de origen.">
      Hasta que se entreguen, o se expliquen los que no se pudieron entregar (en «Pagos sin entregar», más abajo), el turno no se cierra.
      <ul aria-label="Pagos sin entregar" className="mt-1 list-disc space-y-0.5 pl-5">
        {pagos.map((pago) => (
          <li key={pago.pago_id} className="tabular-nums">
            {pago.pago_id} · {etiqueta('tipo_evento_pago', pago.tipo)} · {etiqueta('estado_evento', pago.estado)}
          </li>
        ))}
      </ul>
    </Alert>
  )
}
