import { useQuery } from '@tanstack/react-query'
import { LoadingState } from '@wasichai/core'
import { Alert, Table, Td, Th } from '@wasichai/ui'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { FechaDeLasCifras, Importe, SinDato } from '../cifras/Importe'
import { Dato } from '../turno/Arqueo'
import type { FilaDePartida, RecaudacionPorArea } from '../types'
import { FILTROS_POR_AREA, recaudacion } from './api'
import { erroresDe, FormularioDeFiltros, useFiltrosDeLaRuta, type CampoDeFiltro } from './comun'

// «Recaudación por área» (recaudacion-area): what was collected in a range by área, partida and concepto, and the
// backend's neto. what was charged by orders has no área nor partida (the datum does not exist): its rows say so, and
// it adds up apart, in neto_sin_partida, which is said with its reason, neither hidden nor shared out among the áreas.
// the área and the range live in the url (?area=&desde=&hasta=)

type Filtro = (typeof FILTROS_POR_AREA)[number]

const CAMPOS: CampoDeFiltro<Filtro>[] = [
  { nombre: 'area', rotulo: 'Área (código)' },
  { nombre: 'desde', rotulo: 'Desde', tipo: 'date' },
  { nombre: 'hasta', rotulo: 'Hasta', tipo: 'date' }
]

const SIN_PARTIDA =
  'Lo cobrado por órdenes de los sistemas de origen no tiene área ni partida: se cuenta aparte, en el neto sin partida, y no se reparte entre las áreas.'
// with an área the backend counts only its tasas, and sends neto_sin_partida in 0.00: said, so the zero is not read as
// «nothing was charged by orders»
const CON_AREA =
  'Con un área elegida solo cuentan las tasas de esa área: lo cobrado por órdenes no tiene área, así que queda fuera de esta consulta, y por eso el neto sin partida es cero.'

export function RecaudacionPorAreaPage() {
  const [filtros, poner] = useFiltrosDeLaRuta(FILTROS_POR_AREA, () => void porArea.refetch())
  const porArea = useQuery({ queryKey: ['caja', 'recaudacion', 'por-area', filtros], queryFn: () => recaudacion.porArea(filtros) })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Recaudación por área</h1>
        <p className="text-sm text-ink-muted">Lo recaudado por cada área de la municipalidad y su partida. Toda cifra lleva la fecha a la que se calculó.</p>
      </div>

      <FormularioDeFiltros
        key={JSON.stringify(filtros)}
        id="por-area"
        titulo="Área y periodo"
        campos={CAMPOS}
        filtros={filtros}
        errores={erroresDe(porArea.error, FILTROS_POR_AREA)}
        onConsultar={poner}
      />

      <section aria-labelledby="por-area-recaudacion-titulo" className="space-y-3">
        <h2 id="por-area-recaudacion-titulo" className="text-lg font-semibold text-ink">
          Recaudación del periodo
        </h2>
        {porArea.isPending ? (
          <LoadingState label="Leyendo la recaudación por área…" />
        ) : porArea.isError ? (
          <Alert tone="danger">No se pudo leer la recaudación por área: {errorMessage(porArea.error, 'el backend no contestó')}</Alert>
        ) : (
          <ElPeriodo porArea={porArea.data} conArea={filtros.area !== ''} />
        )}
      </section>
    </div>
  )
}

// `conArea`: the query asked for an área (the url's)
function ElPeriodo({ porArea, conArea }: { porArea: RecaudacionPorArea; conArea: boolean }) {
  return (
    <>
      <dl data-testid="periodo" className="grid gap-1 sm:grid-cols-3">
        <Dato rotulo="Desde">{formatDate(porArea.desde)}</Dato>
        <Dato rotulo="Hasta">{formatDate(porArea.hasta)}</Dato>
        <Dato rotulo="A la fecha">{formatDate(porArea.a_la_fecha)}</Dato>
        <Dato rotulo="Neto">
          <Importe cifra={porArea.neto} />
        </Dato>
        <Dato rotulo="Neto sin partida">
          <Importe cifra={porArea.neto_sin_partida} />
        </Dato>
      </dl>
      <p className="text-sm text-ink-muted">{conArea ? CON_AREA : SIN_PARTIDA}</p>
      {porArea.filas.length === 0 && <p className="text-sm text-ink-muted">No se cobró nada en el periodo.</p>}
      <PorAreaYPartida porArea={porArea} />
    </>
  )
}

// a row of what orders charged has área, nombre and partida in null: it says it has none. any other null, that the
// backend did not send it
const deOrdenes = (fila: FilaDePartida) => fila.area === null && fila.area_nombre === null && fila.partida === null
function areaDe(fila: FilaDePartida) {
  if (fila.area === null) return <SinDato motivo={deOrdenes(fila) ? 'cobrado por órdenes: no tiene área' : 'el backend no mandó el área'} />
  return fila.area_nombre ? `${fila.area} — ${fila.area_nombre}` : fila.area
}
function partidaDe(fila: FilaDePartida) {
  if (fila.partida === null) return <SinDato motivo={deOrdenes(fila) ? 'cobrado por órdenes: no tiene partida' : 'el backend no mandó la partida'} />
  return fila.partida
}

// every figure is as of a_la_fecha: the date goes once, in the caption. the foot is the backend's: the neto and the
// neto sin partida (it sends no total of what was charged nor of what was annulled, and none is made up here)
function PorAreaYPartida({ porArea }: { porArea: RecaudacionPorArea }) {
  const fecha = porArea.a_la_fecha
  const derecha = 'text-right'
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Por área y partida">
        <caption className="caption-top pb-1 text-left text-xs text-ink-muted">
          Cifras <FechaDeLasCifras fecha={fecha} />
        </caption>
        <thead>
          <tr>
            <Th>Área</Th>
            <Th>Partida</Th>
            <Th>Concepto</Th>
            <Th className={derecha}>Cobrado</Th>
            <Th className={derecha}>Anulado</Th>
            <Th className={derecha}>Neto</Th>
          </tr>
        </thead>
        <tbody>
          {porArea.filas.map((fila, i) => (
            <tr key={`${fila.area ?? ''}|${fila.partida ?? ''}|${fila.concepto ?? ''}|${i}`}>
              <Td>{areaDe(fila)}</Td>
              <Td>{partidaDe(fila)}</Td>
              <Td>{fila.concepto ?? <SinDato motivo="el backend no mandó el concepto" />}</Td>
              <Td className={derecha}>
                <Importe cifra={fila.cobrado} fechaDeLaTabla={fecha} />
              </Td>
              <Td className={derecha}>
                <Importe cifra={fila.anulado} fechaDeLaTabla={fecha} />
              </Td>
              <Td className={derecha}>
                <Importe cifra={fila.neto} fechaDeLaTabla={fecha} />
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <Td colSpan={5}>Neto</Td>
            <Td className={derecha}>
              <Importe cifra={porArea.neto} fechaDeLaTabla={fecha} />
            </Td>
          </tr>
          <tr>
            <Td colSpan={5}>Neto sin partida (lo cobrado por órdenes)</Td>
            <Td className={derecha}>
              <Importe cifra={porArea.neto_sin_partida} fechaDeLaTabla={fecha} />
            </Td>
          </tr>
        </tfoot>
      </Table>
    </div>
  )
}
