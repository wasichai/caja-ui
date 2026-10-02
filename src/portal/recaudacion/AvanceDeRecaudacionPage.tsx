import { useQuery } from '@tanstack/react-query'
import { LoadingState } from '@wasichai/core'
import { Table, Td, Th } from '@wasichai/ui'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { FechaDeLasCifras, Importe, SinDato } from '../cifras/Importe'
import { Alerta } from '../components/Alerta'
import { etiqueta } from '../forms/etiquetas'
import { Cuadra, Dato, porQueSinDeclarar, TablaDeArqueo } from '../turno/Arqueo'
import type { AvanceDeRecaudacion, FilaDeOrigen, TurnoDelAvance } from '../types'
import { FILTROS_DEL_AVANCE, recaudacion } from './api'
import { erroresDe, FormularioDeFiltros, useFiltrosDeLaRuta, type CampoDeFiltro } from './comun'

// «Avance de recaudación» (avance-recaudacion): what was collected in a range of days of the turno, by source system,
// with what was annulled and the neto, and the backend's totals: the client adds nothing. the filters live in the url
// (?desde=&hasta=&origen=&caja=&cajero=): a reload or a link passed on asks the same. with no range the backend takes
// its own, and the screen says the one it answered. with caja and cajero, the live turno of today of that cajero there

type Filtro = (typeof FILTROS_DEL_AVANCE)[number]

const CAMPOS: CampoDeFiltro<Filtro>[] = [
  { nombre: 'desde', rotulo: 'Desde', tipo: 'date' },
  { nombre: 'hasta', rotulo: 'Hasta', tipo: 'date' },
  { nombre: 'origen', rotulo: 'Origen' },
  { nombre: 'caja', rotulo: 'Caja' },
  { nombre: 'cajero', rotulo: 'Cajero (correo)' }
]

export function AvanceDeRecaudacionPage() {
  const [filtros, poner] = useFiltrosDeLaRuta(FILTROS_DEL_AVANCE, () => void avance.refetch())
  const avance = useQuery({ queryKey: ['caja', 'recaudacion', 'avance', filtros], queryFn: () => recaudacion.avance(filtros) })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Avance de recaudación</h1>
        <p className="text-sm text-ink-muted">Lo recaudado en el periodo, por origen. Toda cifra lleva la fecha a la que se calculó.</p>
      </div>

      <FormularioDeFiltros
        key={JSON.stringify(filtros)}
        id="avance"
        titulo="Periodo y filtros"
        campos={CAMPOS}
        filtros={filtros}
        errores={erroresDe(avance.error, FILTROS_DEL_AVANCE)}
        onConsultar={poner}
      />

      <section aria-labelledby="periodo-titulo" className="space-y-3">
        <h2 id="periodo-titulo" className="text-lg font-semibold text-ink">
          Recaudación del periodo
        </h2>
        {avance.isPending ? (
          <LoadingState label="Leyendo el avance de recaudación…" />
        ) : avance.isError ? (
          <Alerta tono="error">No se pudo leer el avance de recaudación: {errorMessage(avance.error, 'el backend no contestó')}</Alerta>
        ) : (
          <ElPeriodo avance={avance.data} />
        )}
      </section>

      {avance.data?.turno && <ElTurnoDeHoy turno={avance.data.turno} />}
    </div>
  )
}

function ElPeriodo({ avance }: { avance: AvanceDeRecaudacion }) {
  return (
    <>
      <dl data-testid="periodo" className="grid gap-1 sm:grid-cols-3">
        <Dato rotulo="Desde">{formatDate(avance.desde)}</Dato>
        <Dato rotulo="Hasta">{formatDate(avance.hasta)}</Dato>
        <Dato rotulo="A la fecha">{formatDate(avance.a_la_fecha)}</Dato>
      </dl>
      {avance.filas.length === 0 && <p className="text-sm text-ink-muted">No se cobró nada en el periodo.</p>}
      <PorOrigen avance={avance} />
    </>
  )
}

// what a row's source reads: its label (TASA) or its name; one the backend did not send says so
const SIN_ORIGEN = 'el backend no mandó el origen: un recibo de órdenes sin líneas de su cobro'
const origenDe = (fila: FilaDeOrigen) => (fila.origen === null ? <SinDato motivo={SIN_ORIGEN} /> : etiqueta('origen', fila.origen))

// every figure of the avance is as of a_la_fecha: the date goes once, in the caption
function PorOrigen({ avance }: { avance: AvanceDeRecaudacion }) {
  const fecha = avance.a_la_fecha
  const derecha = 'text-right'
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Por origen">
        <caption className="caption-top pb-1 text-left text-xs text-ink-muted">
          Cifras <FechaDeLasCifras fecha={fecha} />
        </caption>
        <thead>
          <tr>
            <Th>Origen</Th>
            <Th className={derecha}>Cobrado</Th>
            <Th className={derecha}>Anulado</Th>
            <Th className={derecha}>Neto</Th>
          </tr>
        </thead>
        <tbody>
          {avance.filas.map((fila, i) => (
            <tr key={fila.origen ?? `sin-origen-${i}`}>
              <Td>{origenDe(fila)}</Td>
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
            <Td>Total</Td>
            <Td className={derecha}>
              <Importe cifra={avance.cobrado} fechaDeLaTabla={fecha} />
            </Td>
            <Td className={derecha}>
              <Importe cifra={avance.anulado} fechaDeLaTabla={fecha} />
            </Td>
            <Td className={derecha}>
              <Importe cifra={avance.neto} fechaDeLaTabla={fecha} />
            </Td>
          </tr>
        </tfoot>
      </Table>
    </div>
  )
}

// the turno of today of the caja and the cajero asked for, with its live arqueo: what nobody counted says why, never 0
function ElTurnoDeHoy({ turno }: { turno: TurnoDelAvance }) {
  const porQue = porQueSinDeclarar(turno.estado_del_turno)
  return (
    <section aria-labelledby="turno-del-avance-titulo" className="space-y-3">
      <h2 id="turno-del-avance-titulo" className="text-lg font-semibold text-ink">
        Turno de hoy de {turno.cajero} en la caja {turno.caja}
      </h2>
      <p className="text-sm text-ink-muted">{porQue.explicacion}</p>
      <dl data-testid="turno-del-avance" className="grid gap-1 sm:grid-cols-2">
        <Dato rotulo="Día">{formatDate(turno.fecha)}</Dato>
        <Dato rotulo="Estado del turno">{etiqueta('estado_del_turno', turno.estado_del_turno)}</Dato>
        <Dato rotulo="Recibos emitidos">{turno.arqueo.recibos_emitidos}</Dato>
        <Dato rotulo="Recibos anulados">{turno.arqueo.recibos_anulados}</Dato>
        <Dato rotulo="¿Cuadra?">
          <Cuadra cuadra={turno.arqueo.cuadra} motivo={porQue.cuadra} />
        </Dato>
      </dl>
      <TablaDeArqueo arqueo={turno.arqueo} nombre="Arqueo del turno de hoy" sinDeclarar={porQue.cifra} />
    </section>
  )
}
