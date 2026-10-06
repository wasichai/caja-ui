import { useQuery } from '@tanstack/react-query'
import { ApiError, LoadingState } from '@wasichai/core'
import { Alert, Button, Input, Label, Table, Td, Th } from '@wasichai/ui'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { FechaDeLasCifras, Importe, SinDato } from '../cifras/Importe'
import type { Cifra } from '../cifras/Importe'
import { conError, ErrorDelCampo } from '../cobro/Formulario'
import { Dato } from '../turno/Arqueo'
import type { ConciliacionDelDia as LaConciliacion, LineaDeConciliacion } from '../types'
import { recaudacion } from './api'
import { fechaComun } from './comun'

// «Conciliación del día», in «Cierre y arqueo de caja» (caja-web's blocks «Conciliación del día» and «El cuadre del
// día»): what was charged at the window against what each source system says it applied. the day is chosen by whoever
// reconciles, and lives in the route (?fecha=): never «today» by default, so until one is chosen the block says it waits
// for it, and asks nothing (not a 0 before its time). every figure, total and difference is the backend's. the line of a
// source that did not answer, could not be read or is not configured says why it is not known in each of its cells

const PARAMETRO = 'fecha'
const CAMPO = 'conciliacion-fecha'

// a zero as the backend writes it ("0.00", "-0.00"): read as text, never turned into a number
const CERO = /^-?0+(\.0+)?$/

// what the backend's verdict on a line rests on, in words: the counts and figures it sends, nothing worked out
function situacion(linea: LineaDeConciliacion): string {
  if (linea.por_que_no_se_sabe !== null) return `No se sabe: ${linea.por_que_no_se_sabe}`
  if (linea.cuadra) return 'Cuadra'
  const motivos = [
    linea.en_transito > 0 ? `en tránsito: ${linea.en_transito}` : null,
    linea.muertos > 0 ? `sin entregar: ${linea.muertos}` : null,
    linea.rechazados !== null && linea.rechazados > 0 ? `rechazados en el origen: ${linea.rechazados}` : null,
    linea.diferencia !== null && !CERO.test(linea.diferencia.importe) ? 'con diferencia' : null
  ].filter((motivo) => motivo !== null)
  return motivos.length > 0 ? `No cuadra: ${motivos.join(' · ')}` : 'No cuadra'
}

// what the source said, or why it is not known: never a 0 in its place
const SIN_CIFRA_DEL_ORIGEN = 'el backend no mandó la cifra del origen'
function DelOrigen({ linea, children }: { linea: LineaDeConciliacion; children: ReactNode | null }) {
  return children === null ? <SinDato motivo={linea.por_que_no_se_sabe ?? SIN_CIFRA_DEL_ORIGEN} /> : <>{children}</>
}

export function ConciliacionDelDia() {
  const [params, setParams] = useSearchParams()
  const fecha = params.get(PARAMETRO) ?? ''
  const conciliacion = useQuery({
    queryKey: [...recaudacion.claveDeLaConciliacion, fecha],
    queryFn: () => recaudacion.conciliacion(fecha),
    enabled: fecha !== ''
  })

  // the day chosen goes to the url, beside what else is there (the turno). the same day again is the same query: it is
  // asked again, not left as it was read
  const elegir = (dia: string) => {
    if (dia !== '' && dia === fecha) {
      void conciliacion.refetch()
      return
    }
    setParams((antes) => {
      const despues = new URLSearchParams(antes)
      if (dia) despues.set(PARAMETRO, dia)
      else despues.delete(PARAMETRO)
      return despues
    })
  }

  const errorDelDia = conciliacion.error instanceof ApiError ? conciliacion.error.violations.find((v) => v.field === PARAMETRO)?.message : undefined

  return (
    <section aria-labelledby="conciliacion-titulo" className="space-y-4">
      <div>
        <h2 id="conciliacion-titulo" className="text-lg font-semibold text-ink">
          Conciliación del día
        </h2>
        <p className="text-sm text-ink-muted">
          Elija el día que quiere conciliar. La fecha viaja en la dirección de esta pantalla, así que el enlace se puede guardar y compartir.
        </p>
      </div>
      <ElegirElDia key={fecha} fecha={fecha} error={errorDelDia} onElegir={elegir} />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">El cuadre del día</h3>
        <p className="text-sm text-ink-muted">Lo cobrado en ventanilla contra lo que cada sistema de origen dice haber aplicado.</p>
        {fecha === '' ? (
          <p className="text-sm text-ink">Elija arriba el día que quiere conciliar y aquí saldrá su cuadre.</p>
        ) : conciliacion.isPending ? (
          <LoadingState label="Leyendo la conciliación del día…" />
        ) : conciliacion.isError ? (
          <Alert tone="danger">
            {conciliacion.error instanceof ApiError && conciliacion.error.status === 400
              ? `El backend no aceptó el día «${fecha}»: ${errorMessage(conciliacion.error, 'no es un día válido')}`
              : `No se pudo leer la conciliación del día: ${errorMessage(conciliacion.error, 'el backend no contestó')}`}
          </Alert>
        ) : (
          <ElCuadre conciliacion={conciliacion.data} />
        )}
      </div>
    </section>
  )
}

// the day, as a date picker: it goes to the url on «Conciliar». a day of the url the picker cannot hold (badly written)
// still goes to the backend, and its 400 is said under the field
function ElegirElDia({ fecha, error, onElegir }: { fecha: string; error: string | undefined; onElegir: (dia: string) => void }) {
  const [dia, setDia] = useState(fecha)
  const conciliar = (event: FormEvent) => {
    event.preventDefault()
    onElegir(dia.trim())
  }
  return (
    <form onSubmit={conciliar} noValidate className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={CAMPO}>Día a conciliar</Label>
        <Input id={CAMPO} type="date" value={dia} onChange={(e) => setDia(e.target.value)} {...conError(CAMPO, error)} />
        <ErrorDelCampo id={CAMPO} error={error} />
      </div>
      <Button type="submit" variant="secondary">
        Conciliar
      </Button>
    </form>
  )
}

function ElCuadre({ conciliacion }: { conciliacion: LaConciliacion }) {
  return (
    <>
      <dl data-testid="cuadre-del-dia" className="grid gap-1 sm:grid-cols-3">
        <Dato rotulo="Día conciliado">{formatDate(conciliacion.fecha)}</Dato>
        <Dato rotulo="Leído el">{formatDate(conciliacion.a_la_fecha)}</Dato>
        <Dato rotulo="¿Cuadra el día?">{conciliacion.cuadra ? 'Sí: todas las líneas cuadran.' : 'No: alguna línea no cuadra.'}</Dato>
      </dl>
      {conciliacion.lineas.length === 0 ? (
        <p className="text-sm text-ink-muted">Ese día no tiene ningún cobro registrado.</p>
      ) : (
        <PorSistema lineas={conciliacion.lineas} />
      )}
      <p className="text-xs text-ink-muted">Cuando el sistema de origen no contesta, la línea dice por qué no se sabe en vez de mostrar un cero.</p>
    </>
  )
}

function PorSistema({ lineas }: { lineas: LineaDeConciliacion[] }) {
  const fecha = fechaComun(lineas.flatMap((l) => [l.cobrado, l.anulado, l.neto, l.importe_aplicado, l.diferencia]))
  const derecha = 'text-right'
  const cifra = (valor: Cifra) => <Importe cifra={valor} fechaDeLaTabla={fecha} />
  return (
    <Table aria-label="Por sistema de origen">
      {fecha && (
        <caption className="caption-top pb-1 text-left text-xs text-ink-muted">
          Cifras <FechaDeLasCifras fecha={fecha} />
        </caption>
      )}
      <thead>
        <tr>
          <Th>Sistema</Th>
          <Th className={derecha}>Registrados</Th>
          <Th className={derecha}>Anulados</Th>
          <Th className={derecha}>En tránsito</Th>
          <Th className={derecha}>Sin entregar</Th>
          <Th className={derecha}>Explicados</Th>
          <Th className={derecha}>Cobrado</Th>
          <Th className={derecha}>Anulado</Th>
          <Th className={derecha}>Neto</Th>
          <Th className={derecha}>Recibidos en el origen</Th>
          <Th className={derecha}>Aplicados en el origen</Th>
          <Th className={derecha}>Rechazados en el origen</Th>
          <Th className={derecha}>Importe aplicado</Th>
          <Th className={derecha}>Diferencia</Th>
          <Th>¿Cuadra?</Th>
          <Th>Situación</Th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((linea) => (
          <tr key={linea.sistema_destino}>
            <Td>{linea.sistema_destino}</Td>
            <Td className={`${derecha} tabular-nums`}>{linea.registrados}</Td>
            <Td className={`${derecha} tabular-nums`}>{linea.anulados}</Td>
            <Td className={`${derecha} tabular-nums`}>{linea.en_transito}</Td>
            <Td className={`${derecha} tabular-nums`}>{linea.muertos}</Td>
            <Td className={`${derecha} tabular-nums`}>{linea.explicados}</Td>
            <Td className={derecha}>{cifra(linea.cobrado)}</Td>
            <Td className={derecha}>{cifra(linea.anulado)}</Td>
            <Td className={derecha}>{cifra(linea.neto)}</Td>
            <Td className={`${derecha} tabular-nums`}>
              <DelOrigen linea={linea}>{linea.recibidos}</DelOrigen>
            </Td>
            <Td className={`${derecha} tabular-nums`}>
              <DelOrigen linea={linea}>{linea.aplicados}</DelOrigen>
            </Td>
            <Td className={`${derecha} tabular-nums`}>
              <DelOrigen linea={linea}>{linea.rechazados}</DelOrigen>
            </Td>
            <Td className={derecha}>
              <DelOrigen linea={linea}>{linea.importe_aplicado && cifra(linea.importe_aplicado)}</DelOrigen>
            </Td>
            <Td className={derecha}>
              <DelOrigen linea={linea}>{linea.diferencia && cifra(linea.diferencia)}</DelOrigen>
            </Td>
            <Td>{linea.cuadra ? 'Sí' : 'No'}</Td>
            <Td>{situacion(linea)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
