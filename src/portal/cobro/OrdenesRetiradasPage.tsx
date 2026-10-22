import { useQuery } from '@tanstack/react-query'
import { LoadingState } from '@wasichai/core'
import { Alert, Button, Pagination, Table, Td, Th } from '@wasichai/ui'
import { useSearchParams } from 'react-router'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Importe, SinDato } from '../cifras/Importe'
import { fechaYHoraEnLima } from '../fechas'
import { etiqueta } from '../forms/etiquetas'
import { erroresDe, FormularioDeFiltros, type CampoDeFiltro } from '../recaudacion/comun'
import type { OrdenDeCobro } from '../types'
import { cobro } from './api'

// «Órdenes retiradas por el origen» (ordenes-retiradas): the orders their source system withdrew (ANULADA), with why and
// when, and the one that replaced each. the filter lives in the url (?documento=&page=): a reload or a link passed on
// lists the same. caja-backend's list has no date filter, so a caja with many goes by pages of TAMANO_DE_PAGINA, by
// fecha_exigibilidad as the backend orders them

const FILTROS = ['documento'] as const
const CAMPOS: CampoDeFiltro<(typeof FILTROS)[number]>[] = [{ nombre: 'documento', rotulo: 'Documento del pagador' }]

// a page of the url, or the first: what is not one is not asked for
function pagina(texto: string | null): number {
  return texto !== null && /^\d{1,9}$/.test(texto) ? Number.parseInt(texto, 10) : 0
}

export function OrdenesRetiradasPage() {
  const [params, setParams] = useSearchParams()
  const documento = params.get('documento') ?? ''
  const page = pagina(params.get('page'))
  const lista = useQuery({
    queryKey: ['caja', 'ordenes-retiradas', documento, page],
    queryFn: () => cobro.ordenes({ estado: 'ANULADA', pagador_documento: documento, page })
  })

  // what changes in the url, set (or dropped, when empty or the first page) without touching the rest
  const cambiar = (cambios: Record<string, string | null>) =>
    setParams((antes) => {
      const despues = new URLSearchParams(antes)
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor) despues.set(clave, valor)
        else despues.delete(clave)
      }
      return despues
    })

  // a new search starts at its first page; the same one on the first page is asked again
  const consultar = ({ documento: nuevo }: { documento: string }) => {
    if (page === 0 && nuevo === documento) void lista.refetch()
    else cambiar({ documento: nuevo, page: null })
  }

  // the backend's 400 names the query's field, pagador_documento: it goes under the documento
  const errorDelDocumento = erroresDe(lista.error, ['pagador_documento']).pagador_documento

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Órdenes retiradas por el origen</h1>
        <p className="text-sm text-ink-muted">Las órdenes que su sistema de origen retiró y que la caja ya no cobra, con el motivo y la fecha del retiro.</p>
      </div>

      <FormularioDeFiltros
        key={documento}
        id="retiradas"
        titulo="Buscar órdenes retiradas"
        campos={CAMPOS}
        filtros={{ documento }}
        errores={errorDelDocumento ? { documento: errorDelDocumento } : {}}
        onConsultar={consultar}
      />

      <section aria-labelledby="retiradas-lista-titulo" className="space-y-3">
        <h2 id="retiradas-lista-titulo" className="text-lg font-semibold text-ink">
          Órdenes retiradas
        </h2>
        {lista.isPending ? (
          <LoadingState label="Buscando las órdenes retiradas…" />
        ) : lista.isError ? (
          <Alert tone="danger">No se pudo leer la lista de órdenes retiradas: {errorMessage(lista.error, 'el backend no contestó')}</Alert>
        ) : lista.data.totalElements === 0 ? (
          <p className="text-sm text-ink-muted">Ninguna orden retirada por su sistema de origen coincide con la consulta.</p>
        ) : lista.data.content.length === 0 ? (
          // a link to a page past the last: some do match, so it leads back to the first
          <p className="text-sm text-ink-muted">
            Esta página ya no tiene órdenes: las que coinciden caben en las anteriores.{' '}
            <Button type="button" variant="secondary" size="sm" onClick={() => cambiar({ page: null })}>
              Ir a la primera página
            </Button>
          </p>
        ) : (
          <>
            <TablaDeRetiradas filas={lista.data.content} />
            <Pagination
              page={page}
              totalPages={lista.data.totalPages}
              totalElements={lista.data.totalElements}
              onPage={(otra) => cambiar({ page: otra > 0 ? String(otra) : null })}
            />
          </>
        )}
      </section>
    </div>
  )
}

const SIN_PAGADOR = 'No se identificó al pagador'
const SIN_MOTIVO = 'El backend no mandó el motivo del retiro'
const SIN_FECHA = 'El backend no mandó cuándo se retiró'

function TablaDeRetiradas({ filas }: { filas: OrdenDeCobro[] }) {
  return (
    <Table aria-label="Órdenes retiradas">
      <thead>
        <tr>
          <Th>Referencia</Th>
          <Th>Origen</Th>
          <Th>Concepto</Th>
          <Th>Pagador</Th>
          <Th className="text-right">Importe</Th>
          <Th>Motivo del retiro</Th>
          <Th>Retirada</Th>
          <Th>Estado</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((orden) => (
          <tr key={orden.orden_id}>
            <Td>
              {orden.referencia_externa ?? <SinDato motivo="El backend no mandó la referencia" />}
              {orden.sustituida_por && (
                <>
                  {' '}
                  <span className="text-xs text-ink-muted">sustituida por {orden.sustituida_por}</span>
                </>
              )}
            </Td>
            <Td>{orden.sistema_origen ?? <SinDato motivo="El backend no mandó el origen" />}</Td>
            <Td>{orden.concepto ?? <SinDato motivo="El backend no mandó el concepto" />}</Td>
            <Td>
              {orden.pagador_documento || orden.pagador_nombre ? (
                [orden.pagador_documento, orden.pagador_nombre].filter(Boolean).join(' · ')
              ) : (
                <SinDato motivo={SIN_PAGADOR} />
              )}
            </Td>
            <Td className="text-right">
              <Importe cifra={orden.importe} />
            </Td>
            <Td>{orden.motivo_retiro ?? <SinDato motivo={SIN_MOTIVO} />}</Td>
            <Td>{orden.retirada_en ? fechaYHoraEnLima(orden.retirada_en) : <SinDato motivo={SIN_FECHA} />}</Td>
            <Td>{orden.estado ? etiqueta('estado_orden', orden.estado) : <SinDato motivo="El backend no mandó el estado" />}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
