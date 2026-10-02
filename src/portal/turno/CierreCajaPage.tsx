import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingState, useAuth } from '@wasichai/core'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Importe } from '../cifras/Importe'
import { PagosSinEntregar as BloqueDePagosSinEntregar } from '../buzon/PagosSinEntregar'
import { Alerta } from '../components/Alerta'
import { fechaYHoraEnLima } from '../fechas'
import { ConciliacionDelDia } from '../recaudacion/ConciliacionDelDia'
import type { CierreHecho, CierreVigente, TurnoDelDia as ElDelDia } from '../types'
import { CLAVE_DE_LOS_TURNOS, turnos } from './api'
import { Cuadra, Dato, PagosSinEntregar, porQueSinDeclarar, ResumenDelArqueo, TablaDeArqueo, SIN_DECLARAR } from './Arqueo'
import { CerrarElTurno } from './CerrarElTurno'
import { impedimentoDeCerrar, impedimentoDeReversar, type ElArqueo, type ElTurno } from './impedimentos'
import { ReversarElCierre } from './ReversarElCierre'
import { TurnoDelDia } from './TurnoDelDia'

// «Cierre y arqueo de caja» (cierre-caja): the clerk's turno of today and its situation, the live arqueo of the turno
// chosen (in the route, ?turno=, when there is more than one), the cierre with what was counted, and its reversal.
// every figure is the backend's, and so is every state: after a write, the turno and its arqueo are read again, never
// changed here. below the arqueo, the payments not delivered (MUERTO) and their explanation, which lets the turno close
// (buzon/PagosSinEntregar.tsx). last, the reconciliation of a day chosen in the route (?fecha=,
// recaudacion/ConciliacionDelDia.tsx)

// the turno of the route, or the only one of the day; with several and none in the route, none
function elTurnoDe(delDia: { isPending: boolean; isError: boolean; error: unknown; data?: ElDelDia }, pedido: string | null): ElTurno {
  if (delDia.isPending) return { estado: 'leyendo' }
  if (delDia.isError || !delDia.data) return { estado: 'ilegible', error: delDia.error }
  const { turnos: delHoy } = delDia.data
  if (delHoy.length === 0) return { estado: 'sin-turnos' }
  if (pedido) {
    const turno = delHoy.find((t) => t.turno_id === pedido)
    return turno ? { estado: 'elegido', turno } : { estado: 'ajeno' }
  }
  return delHoy.length === 1 ? { estado: 'elegido', turno: delHoy[0] } : { estado: 'sin-elegir' }
}

export function CierreCajaPage() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const delDia = useQuery({ queryKey: turnos.claveDelDia, queryFn: turnos.delDia })
  const elTurno = elTurnoDe(delDia, params.get('turno'))
  const turno = elTurno.estado === 'elegido' ? elTurno.turno : null
  const arqueo = useQuery({
    queryKey: turnos.claveDelArqueo(turno?.turno_id ?? ''),
    queryFn: () => turnos.arqueo(turno?.turno_id ?? ''),
    enabled: turno !== null
  })
  const elArqueo: ElArqueo = arqueo.isPending
    ? { estado: 'leyendo' }
    : arqueo.isError
      ? { estado: 'ilegible', error: arqueo.error }
      : { estado: 'leido', arqueo: arqueo.data }
  // what the backend answered to this screen's last act, by the turno it was for
  const [acta, setActa] = useState<CierreHecho | null>(null)
  const [reversado, setReversado] = useState<string | null>(null)
  const recienCerrado = acta && acta.turno_id === turno?.turno_id ? acta : null
  // the acta of a closed turno is the one its arqueo carries, as the backend kept it: after a reload too. the one this
  // screen's cierre answered stands in only until the arqueo read again carries it
  const vigente = elArqueo.estado === 'leido' ? elArqueo.arqueo.cierre_vigente : null

  // what the backend says now: today's turno and the arqueo, read again
  const leerOtraVez = () => void queryClient.invalidateQueries({ queryKey: CLAVE_DE_LOS_TURNOS, refetchType: 'all' })

  // the turno chosen goes to the url, beside the day of the reconciliation
  const elegir = (turnoId: string) =>
    setParams((antes) => {
      const despues = new URLSearchParams(antes)
      despues.set('turno', turnoId)
      return despues
    })
  const clave = turno?.turno_id ?? 'ninguno'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Cierre y arqueo de caja</h1>
        <p className="text-sm text-ink-muted">Su turno de hoy, el arqueo por forma de pago, el cierre con lo que contó y, si hace falta, su reversión.</p>
      </div>

      <TurnoDelDia delDia={delDia} elTurno={elTurno} onElegir={elegir} />

      {turno && (
        <section aria-labelledby="arqueo-titulo" className="space-y-3">
          <h2 id="arqueo-titulo" className="text-lg font-semibold text-ink">
            Arqueo del turno de la caja {turno.caja ?? turno.turno_id}
          </h2>
          {arqueo.isPending ? (
            <LoadingState label="Leyendo el arqueo…" />
          ) : arqueo.isError ? (
            <Alerta tono="error">No se pudo leer el arqueo: {errorMessage(arqueo.error, 'el backend no contestó')}</Alerta>
          ) : (
            <>
              <p className="text-sm text-ink-muted">{porQueSinDeclarar(arqueo.data.estado_del_turno).explicacion}</p>
              <TablaDeArqueo arqueo={arqueo.data.arqueo} nombre="Arqueo" sinDeclarar={porQueSinDeclarar(arqueo.data.estado_del_turno).cifra} />
              <ResumenDelArqueo delTurno={arqueo.data} />
              <PagosSinEntregar pagos={arqueo.data.lo_que_impide_cerrar} />
            </>
          )}
        </section>
      )}

      <BloqueDePagosSinEntregar turno={turno} turnosDelDia={delDia.data?.turnos ?? []} />

      {recienCerrado?.estado_del_turno === 'CERRADO' && <Alerta tono="exito">El turno quedó cerrado.</Alerta>}
      {vigente ? (
        <ActaDelCierre acta={vigente} titulo={`Acta del cierre vigente del ${formatDate(vigente.fecha)}`} />
      ) : (
        recienCerrado && <ActaDelCierre acta={recienCerrado} titulo={`Acta del cierre del ${formatDate(recienCerrado.fecha)}`} />
      )}

      <CerrarElTurno
        key={`cierre-${clave}`}
        turno={turno}
        conMovimiento={elArqueo.estado === 'leido' ? elArqueo.arqueo.arqueo.lineas.map((linea) => linea.forma_pago) : []}
        hayPagosPorExplicar={elArqueo.estado === 'leido' && elArqueo.arqueo.lo_que_impide_cerrar.some((pago) => pago.estado === 'MUERTO')}
        impedido={impedimentoDeCerrar(can, elTurno, elArqueo)}
        onCerrado={(hecho) => {
          setActa(hecho)
          setReversado(null)
          leerOtraVez()
        }}
        onChoque={leerOtraVez}
      />

      {reversado !== null && reversado === turno?.turno_id && <Alerta tono="exito">Se reversó el cierre del turno de la caja {turno.caja}.</Alerta>}
      <ReversarElCierre
        key={`reversion-${clave}`}
        turno={turno}
        impedido={impedimentoDeReversar(can, elTurno)}
        onReversado={(hecha) => {
          setActa(null)
          setReversado(hecha.turno_id)
          leerOtraVez()
        }}
        onChoque={leerOtraVez}
      />

      <ConciliacionDelDia />
    </div>
  )
}

// the acta as the backend has it (the cierre's answer, or the cierre in force of the arqueo): the turno as it was
// closed, with what was declared and its difference, the backend's. nothing is recomputed here
function ActaDelCierre({ acta, titulo }: { acta: CierreHecho | CierreVigente; titulo: string }) {
  return (
    <section aria-labelledby="acta-titulo" className="space-y-3">
      <h2 id="acta-titulo" className="text-lg font-semibold text-ink">
        {titulo}
      </h2>
      <dl data-testid="acta-del-cierre" className="grid gap-1 sm:grid-cols-2">
        <Dato rotulo="Secuencia">{acta.secuencia}</Dato>
        <Dato rotulo="Registrado el">{fechaYHoraEnLima(acta.registrado_en)}</Dato>
        <Dato rotulo="Por">{acta.usuario}</Dato>
        <Dato rotulo="Observación">{acta.observacion}</Dato>
        <Dato rotulo="Cobrado con evento">
          <Importe cifra={acta.cobrado_con_evento} />
        </Dato>
        <Dato rotulo="Cobrado sin evento">
          <Importe cifra={acta.cobrado_sin_evento} />
        </Dato>
        <Dato rotulo="¿Cuadra?">
          <Cuadra cuadra={acta.arqueo.cuadra} motivo={SIN_DECLARAR} />
        </Dato>
      </dl>
      <TablaDeArqueo arqueo={acta.arqueo} nombre="Arqueo del cierre" sinDeclarar={SIN_DECLARAR} />
    </section>
  )
}
