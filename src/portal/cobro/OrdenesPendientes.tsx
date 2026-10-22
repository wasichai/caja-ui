import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingState } from '@wasichai/core'
import { Alert, Table, Td, Th } from '@wasichai/ui'
import { useCallback, useEffect, useState } from 'react'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Importe, SinDato } from '../cifras/Importe'
import { hoyEnLima } from '../fechas'
import type { CobroHecho, OrdenDeCobro } from '../types'
import { cobro } from './api'
import { Cobro } from './Cobro'

// the pending orders of a payer, a box per row to mark what is cobrado. an order that cannot be marked says why:
// one not yet due, and one of another system than what is marked (a recibo is annulled whole, so it cobra the orders
// of one system). the backend checks both again (the preview, the cobro): this only spares the clerk a refusal.
//
// the source system may withdraw an order after it was read (caja-backend's retiro, or a sustitución by a new version):
// the list is read again when the clerk comes back to the window and before the confirmation (Cobro), and a marked
// order that is no longer pending is unmarked and said, once, above the table

const SIN_DATO = 'El sistema de origen no lo mandó'

// what is marked: nothing, or the system of its orders. apart, because an order with no system marked is something
// marked too (its system is null), and it keeps the others from being marked as much as one of rentas
type Marcado = { algo: false } | { algo: true; sistema: string | null }

// how a system reads in the reason: «rentas», or that it has none
const deSistema = (sistema: string | null) => (sistema === null ? 'no tiene sistema de origen' : `es de «${sistema}»`)

// why the order cannot be marked, or null
function impedimento(orden: OrdenDeCobro, marcado: Marcado, hoy: string): string | null {
  if (!orden.fecha_exigibilidad) return 'No tiene fecha de exigibilidad: no se puede cobrar.'
  // ISO dates compare as text: no arithmetic on them
  if (orden.fecha_exigibilidad > hoy) return `Es exigible desde el ${formatDate(orden.fecha_exigibilidad)}: todavía no se puede cobrar.`
  if (marcado.algo && orden.sistema_origen !== marcado.sistema) {
    const suyo = deSistema(orden.sistema_origen)
    return `${suyo.charAt(0).toUpperCase()}${suyo.slice(1)} y lo marcado ${deSistema(marcado.sistema)}: un recibo cobra órdenes de un solo sistema, porque se anula entero.`
  }
  return null
}

const nombreDe = (orden: OrdenDeCobro) => orden.referencia_externa ?? orden.concepto ?? orden.orden_id

export function OrdenesPendientes({
  documento,
  cajaDeLaRuta,
  caja,
  sinCaja,
  onCobrado
}: {
  documento: string
  // the caja of the url, as it is (the draft's key), and the active one it names, or null with why
  cajaDeLaRuta: string
  caja: string | null
  sinCaja: string
  onCobrado: (hecho: CobroHecho) => void
}) {
  const queryClient = useQueryClient()
  // whether the cobro below is on its way or its outcome is not known (Cobro's onEnVilo)
  const [enVilo, setEnVilo] = useState(false)
  // only this screen refetches on focus (PortalApp turns it off for the rest): what is cobrado here must still be pending.
  // not while a cobro is in the air: if it was charged, its orders would leave the list, and with them the attempt the
  // clerk has to send again with the same key (envio.ts). «Buscar» still reads them, as before
  const ordenes = useQuery({
    queryKey: ['caja', 'ordenes', documento],
    queryFn: () => cobro.ordenesPendientes(documento),
    refetchOnWindowFocus: !enVilo
  })
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set())
  // the names of the marked orders the last read no longer had, said until another order is marked
  const [retiradas, setRetiradas] = useState<string[]>([])
  // the read the marks were last compared with
  const [leidas, setLeidas] = useState(ordenes.data)

  // react-query's focus is the tab's visibility: coming back from another window of the same screen is a focus. a fetch
  // already on its way is not started again (cancelRefetch false), so the two events of one return ask once
  useEffect(() => {
    if (enVilo) return
    const alVolver = () => void queryClient.refetchQueries({ queryKey: ['caja', 'ordenes', documento], exact: true }, { cancelRefetch: false })
    window.addEventListener('focus', alVolver)
    return () => window.removeEventListener('focus', alVolver)
  }, [queryClient, documento, enVilo])

  // a new read: the marked orders it no longer has were withdrawn (or paid elsewhere) and are unmarked. while a cobro is
  // in the air they are left alone: they may have gone with it, and its attempt must go again as it was (envio.ts).
  // adjusted while rendering, not in an effect, so no frame shows a mark the read no longer has
  if (ordenes.data !== leidas) {
    setLeidas(ordenes.data)
    const ahora = new Set(ordenes.data?.content.map((o) => o.orden_id))
    const idas = leidas && ordenes.data && !enVilo ? leidas.content.filter((o) => marcadas.has(o.orden_id) && !ahora.has(o.orden_id)) : []
    if (idas.length > 0) {
      setMarcadas(new Set([...marcadas].filter((id) => ahora.has(id))))
      setRetiradas(idas.map(nombreDe))
    }
  }

  const releer = useCallback(async () => {
    const leido = await queryClient.fetchQuery({ queryKey: ['caja', 'ordenes', documento], queryFn: () => cobro.ordenesPendientes(documento), staleTime: 0 })
    return leido.content.map((o) => o.orden_id)
  }, [queryClient, documento])

  const volverABuscar = useCallback(() => {
    setMarcadas(new Set())
    setRetiradas([])
    void queryClient.invalidateQueries({ queryKey: ['caja', 'ordenes', documento], exact: true })
  }, [queryClient, documento])

  if (ordenes.isPending) return <LoadingState label="Buscando las órdenes pendientes…" />
  if (!ordenes.data) return <Alert tone="danger">No se pudieron leer las órdenes: {errorMessage(ordenes.error, 'el backend no contestó')}</Alert>
  // a read again that fails («Buscar» with the same document, on a flaky network) keeps what was read: with it would go
  // the cobro below, what was typed in it and the key of an attempt whose outcome is not known (envio.ts)
  const sinReleer = ordenes.isError && (
    <Alert tone="warning">
      No se pudieron volver a leer las órdenes: {errorMessage(ordenes.error, 'el backend no contestó')}. Se muestran las que se leyeron antes.
    </Alert>
  )

  const avisoDeRetiro = retiradas.length > 0 && (
    <Alert tone="warning">
      {retiradas.map((nombre) => (
        <span key={nombre} className="block">
          La orden {nombre} ya no está pendiente: la retiró el sistema de origen o se cobró en otra caja.
        </span>
      ))}
      <span className="mt-1 block">
        {retiradas.length === 1
          ? 'Ya no está pendiente: se quitó de lo marcado y el total se vuelve a pedir sin ella.'
          : 'Ya no están pendientes: se quitaron de lo marcado y el total se vuelve a pedir sin ellas.'}
      </span>
    </Alert>
  )

  const filas = ordenes.data.content
  if (filas.length === 0)
    return (
      <>
        {sinReleer}
        {avisoDeRetiro}
        <p className="text-sm text-ink-muted">Este documento no tiene órdenes pendientes</p>
      </>
    )

  // what is marked, in the table's order: the preview and the cobro get it so
  const elegidas = filas.filter((o) => marcadas.has(o.orden_id))
  const marcado: Marcado = elegidas.length > 0 ? { algo: true, sistema: elegidas[0].sistema_origen } : { algo: false }
  const hoy = hoyEnLima()
  const pagador = filas.find((o) => o.pagador_nombre)?.pagador_nombre

  const alternar = (id: string) => {
    setRetiradas([])
    setMarcadas((antes) => {
      const despues = new Set(antes)
      if (!despues.delete(id)) despues.add(id)
      return despues
    })
  }

  return (
    <>
      <section aria-labelledby="ordenes-titulo" className="space-y-3">
        <h2 id="ordenes-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
          Órdenes pendientes
        </h2>
        {sinReleer}
        {avisoDeRetiro}
        <p className="text-sm text-ink">
          Pagador: {pagador ? <strong>{pagador}</strong> : <SinDato motivo={SIN_DATO} />} ({documento})
        </p>
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
              const porque = marcada ? null : impedimento(orden, marcado, hoy)
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
                  <Td>
                    {orden.referencia_externa ?? <SinDato motivo={SIN_DATO} />}
                    {/* a new version of a debt the source system redetermined: the one it replaces is no longer listed */}
                    {orden.sustituye_a && <p className="mt-0.5 text-xs text-ink-muted">reemplaza a {orden.sustituye_a}</p>}
                  </Td>
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
        sinCaja={sinCaja}
        ordenes={elegidas.map((o) => o.orden_id)}
        onCobrado={onCobrado}
        releer={releer}
        volverABuscar={volverABuscar}
        onEnVilo={setEnVilo}
      />
    </>
  )
}
