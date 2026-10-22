import { useQuery } from '@tanstack/react-query'
import { LoadingState, useAuth } from '@wasichai/core'
import { Alert } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { formatDate } from '../../kit/format'
import { errorMessage } from '../../kit/ui/errorMessage'
import { pagos } from '../buzon/api'
import { Importe, SinDato } from '../cifras/Importe'
import { cobro } from '../cobro/api'
import { fechaYHoraEnLima } from '../fechas'
import { loQueFalta, type Par } from '../shell/navTree'
import type { CobroSinVerificar, PagoACuenta } from '../types'

// two blocks of «Cierre y arqueo de caja», after the acta: what the source systems received «a cuenta» in the day's
// turnos (GET /caja/pagos/a-cuenta, caja-backend#41), and the recibos of the day charged without being able to check
// with their source (GET /caja/cobros/sin-verificar, caja-backend#42). neither keeps a turno from closing, and that is
// why they are listed: someone has to look at money that did not settle a debt, or that may settle one no longer owed.
// the day is the clerk's, the one of today's turnos. without the permission each block says what the account lacks
// and asks nothing; a refusal of the backend is said in its slot, and the leaf goes on

// what each route asks of the account (its 403)
const PARA_A_CUENTA: Par[][] = [
  [
    { objeto: 'pago_evento', accion: 'READ' },
    { objeto: 'recibo', accion: 'READ' }
  ]
]
const PARA_SIN_VERIFICAR: Par[][] = [[{ objeto: 'recibo', accion: 'READ' }]]

const SIN_DIA = 'Sin el día de sus turnos no se sabe qué día listar.'

// the day of today's turnos, as the screen has it: being read, not readable, or read
export type ElDia = { estado: 'leyendo' } | { estado: 'ilegible' } | { estado: 'leido'; fecha: string }

// the parts of a row, joined by « · »
function Renglon({ partes }: { partes: ReactNode[] }) {
  return (
    <li className="break-words">
      {partes.map((parte, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {parte}
        </span>
      ))}
    </li>
  )
}

function Bloque<T>({
  id,
  titulo,
  explicacion,
  falta,
  sinPermiso,
  dia,
  leer,
  clave,
  leyendo,
  ilegible,
  vacia,
  renglon
}: {
  id: string
  titulo: string
  explicacion: string
  falta: string
  sinPermiso: string
  dia: ElDia
  leer: (fecha: string) => Promise<T[]>
  clave: readonly string[]
  leyendo: string
  ilegible: string
  vacia: string
  renglon: (fila: T, fecha: string) => ReactNode
}) {
  const fecha = dia.estado === 'leido' ? dia.fecha : ''
  const lista = useQuery({ queryKey: [...clave, fecha], queryFn: () => leer(fecha), enabled: falta === '' && fecha !== '' })

  const contenido = (): ReactNode => {
    if (falta) return <p className="text-sm text-ink-muted">{`${sinPermiso}: le falta ${falta}.`}</p>
    if (dia.estado === 'ilegible') return <p className="text-sm text-ink-muted">{SIN_DIA}</p>
    if (dia.estado === 'leyendo' || lista.isPending) return <LoadingState label={leyendo} />
    if (lista.isError)
      return (
        <Alert tone="danger">
          {ilegible}: {errorMessage(lista.error, 'el backend no contestó')}
        </Alert>
      )
    if (lista.data.length === 0) return <p className="text-sm text-ink">{vacia}</p>
    return (
      <ul aria-label={titulo} className="list-disc space-y-1 pl-5 text-sm text-ink">
        {lista.data.map((fila) => renglon(fila, fecha))}
      </ul>
    )
  }

  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-lg font-semibold text-ink">
        {titulo}
      </h2>
      <p className="text-sm text-ink-muted">
        {explicacion}
        {fecha && ` Son los del ${formatDate(fecha)}.`}
      </p>
      {contenido()}
    </section>
  )
}

function ReciboACuenta({ pago, fecha }: { pago: PagoACuenta; fecha: string }) {
  return (
    <Renglon
      partes={[
        <>Recibo {pago.recibo ?? <SinDato motivo="el recibo no se pudo leer" />}</>,
        pago.sistema_destino,
        pago.total ? <Importe cifra={pago.total} fechaDeLaTabla={fecha} /> : <SinDato motivo="el backend no mandó el total del recibo" />,
        <>Motivo: {pago.motivo_a_cuenta ?? <SinDato motivo="el origen no dijo por qué" />}</>,
        <>Entregado el {pago.entregado_en ? fechaYHoraEnLima(pago.entregado_en) : <SinDato motivo="el backend no mandó cuándo se entregó" />}</>
      ]}
    />
  )
}

function pagador(cobrado: CobroSinVerificar): ReactNode {
  const { pagador_nombre: nombre, pagador_documento: documento } = cobrado
  if (nombre && documento) return `${nombre} (${documento})`
  return nombre ?? documento ?? <SinDato motivo="pagador anónimo" />
}

function CobradoSinVerificar({ cobrado, fecha }: { cobrado: CobroSinVerificar; fecha: string }) {
  return (
    <Renglon
      partes={[
        `Recibo ${cobrado.numero_impreso}`,
        cobrado.cajero,
        pagador(cobrado),
        <Importe cifra={cobrado.total} fechaDeLaTabla={fecha} />,
        `Emitido el ${fechaYHoraEnLima(cobrado.emitido_en)}`,
        cobrado.advertencia_origen
      ]}
    />
  )
}

export function LoDelOrigen({ dia }: { dia: ElDia }) {
  const { can } = useAuth()
  return (
    <>
      <Bloque<PagoACuenta>
        id="a-cuenta-titulo"
        titulo="Recibidos a cuenta por el origen"
        explicacion="Pagos entregados que el sistema de origen guardó como saldo a favor del pagador, porque la deuda ya no estaba vigente. No impiden cerrar, pero ese dinero no extinguió la deuda que se cobró: revise cada uno con el sistema de origen."
        falta={loQueFalta(PARA_A_CUENTA, can)}
        sinPermiso="Su cuenta no puede ver los pagos recibidos a cuenta"
        dia={dia}
        leer={pagos.aCuenta}
        clave={pagos.claveACuenta}
        leyendo="Leyendo los pagos recibidos a cuenta…"
        ilegible="No se pudieron leer los pagos recibidos a cuenta"
        vacia="Ese día el sistema de origen no recibió ningún pago a cuenta."
        renglon={(pago, fecha) => <ReciboACuenta key={pago.pago_id} pago={pago} fecha={fecha} />}
      />
      <Bloque<CobroSinVerificar>
        id="sin-verificar-titulo"
        titulo="Cobrados sin verificar con el origen"
        explicacion="Recibos que se cobraron sin poder comprobar con el sistema de origen que la deuda seguía vigente, porque no contestó. El origen recibirá el pago; si ya no lo cobraba, hay que resolverlo con él."
        falta={loQueFalta(PARA_SIN_VERIFICAR, can)}
        sinPermiso="Su cuenta no puede ver los cobros sin verificar"
        dia={dia}
        leer={cobro.sinVerificar}
        clave={cobro.claveSinVerificar}
        leyendo="Leyendo los cobros sin verificar…"
        ilegible="No se pudieron leer los cobros sin verificar"
        vacia="Ese día no se cobró nada sin comprobarlo con el sistema de origen."
        renglon={(cobrado, fecha) => <CobradoSinVerificar key={cobrado.numero_impreso} cobrado={cobrado} fecha={fecha} />}
      />
    </>
  )
}
