import { useQuery } from '@tanstack/react-query'
import { LoadingState } from '@wasichai/core'
import { Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Importe, SinDato } from '../cifras/Importe'
import { Alerta } from '../components/Alerta'
import { hoyEnLima } from '../fechas'
import type { CobroHecho, OrdenDeCobro } from '../types'
import { cobro } from './api'
import { Cobro } from './Cobro'

// the pending orders of a payer, a box per row to mark what is cobrado. an order that cannot be marked says why:
// one not yet due, and one of another system than what is marked (a recibo is annulled whole, so it cobra the orders
// of one system). the backend checks both again (the preview, the cobro): this only spares the clerk a refusal

const SIN_DATO = 'El sistema de origen no lo mandó'

// why the order cannot be marked, or null. `sistema`: the system of what is marked, if anything is
function impedimento(orden: OrdenDeCobro, sistema: string | null, hoy: string): string | null {
  if (!orden.fecha_exigibilidad) return 'No tiene fecha de exigibilidad: no se puede cobrar.'
  // ISO dates compare as text: no arithmetic on them
  if (orden.fecha_exigibilidad > hoy) return `Es exigible desde el ${formatDate(orden.fecha_exigibilidad)}: todavía no se puede cobrar.`
  if (sistema !== null && orden.sistema_origen !== sistema)
    return `Es de «${orden.sistema_origen ?? 'sin sistema'}» y lo marcado es de «${sistema}»: un recibo cobra órdenes de un solo sistema, porque se anula entero.`
  return null
}

const nombreDe = (orden: OrdenDeCobro) => orden.referencia_externa ?? orden.concepto ?? orden.orden_id

export function OrdenesPendientes({
  documento,
  cajaDeLaRuta,
  caja,
  onCobrado
}: {
  documento: string
  // the caja of the url, as it is (the draft's key), and the active one it names, or null
  cajaDeLaRuta: string
  caja: string | null
  onCobrado: (hecho: CobroHecho) => void
}) {
  const ordenes = useQuery({ queryKey: ['caja', 'ordenes', documento], queryFn: () => cobro.ordenesPendientes(documento) })
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set())

  if (ordenes.isPending) return <LoadingState label="Buscando las órdenes pendientes…" />
  if (ordenes.isError) return <Alerta tono="error">No se pudieron leer las órdenes: {errorMessage(ordenes.error, 'el backend no contestó')}</Alerta>

  const filas = ordenes.data.content
  if (filas.length === 0) return <p className="text-sm text-ink-muted">Este documento no tiene órdenes pendientes</p>

  // what is marked, in the table's order: the preview and the cobro get it so
  const elegidas = filas.filter((o) => marcadas.has(o.orden_id))
  const sistema = elegidas.length > 0 ? elegidas[0].sistema_origen : null
  const hoy = hoyEnLima()
  const pagador = filas.find((o) => o.pagador_nombre)?.pagador_nombre

  const alternar = (id: string) =>
    setMarcadas((antes) => {
      const despues = new Set(antes)
      if (!despues.delete(id)) despues.add(id)
      return despues
    })

  return (
    <>
      <section aria-labelledby="ordenes-titulo" className="space-y-3">
        <h2 id="ordenes-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
          Órdenes pendientes
        </h2>
        <p className="text-sm text-ink">
          Pagador: {pagador ? <strong>{pagador}</strong> : <SinDato motivo={SIN_DATO} />} ({documento})
        </p>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>
                  <span className="sr-only">Cobrar</span>
                </Th>
                <Th>Concepto</Th>
                <Th>Detalle</Th>
                <Th>Referencia</Th>
                <Th>Sistema de origen</Th>
                <Th>Exigible desde</Th>
                <Th className="text-right">Importe</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((orden) => {
                const marcada = marcadas.has(orden.orden_id)
                // a marked one is of the system marked, and was due when marked
                const porque = marcada ? null : impedimento(orden, sistema, hoy)
                const motivoId = `impedida-${orden.orden_id}`
                return (
                  <tr key={orden.orden_id} data-impedida={porque ? true : undefined}>
                    <Td>
                      <input
                        type="checkbox"
                        className="accent-brand"
                        aria-label={`Cobrar ${nombreDe(orden)}`}
                        checked={marcada}
                        disabled={porque !== null}
                        aria-describedby={porque ? motivoId : undefined}
                        onChange={() => alternar(orden.orden_id)}
                      />
                    </Td>
                    <Td>
                      {orden.concepto ?? <SinDato motivo={SIN_DATO} />}
                      {porque && (
                        <p id={motivoId} className="mt-0.5 text-xs text-ink-muted">
                          {porque}
                        </p>
                      )}
                    </Td>
                    <Td>{orden.detalle ?? <SinDato motivo={SIN_DATO} />}</Td>
                    <Td>{orden.referencia_externa ?? <SinDato motivo={SIN_DATO} />}</Td>
                    <Td>{orden.sistema_origen ?? <SinDato motivo={SIN_DATO} />}</Td>
                    <Td>{orden.fecha_exigibilidad ? formatDate(orden.fecha_exigibilidad) : <SinDato motivo={SIN_DATO} />}</Td>
                    <Td className="text-right">
                      <Importe cifra={orden.importe} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
        {ordenes.data.totalElements > filas.length && (
          <p className="text-sm text-ink-muted">
            Se muestran las primeras {filas.length} de {ordenes.data.totalElements} órdenes pendientes, por fecha de exigibilidad.
          </p>
        )}
      </section>

      <Cobro
        key={`${cajaDeLaRuta}|${documento}`}
        acto={`caja-tributaria.${cajaDeLaRuta}.${documento}`}
        caja={caja}
        ordenes={elegidas.map((o) => o.orden_id)}
        onCobrado={onCobrado}
      />
    </>
  )
}
