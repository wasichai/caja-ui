import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingState, useAuth } from '@wasichai/core'
import { Button, type PdfFile } from '@wasichai/ui'
import { Ban, FileText } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FieldGrid } from '../../kit/forms/FieldGrid'
import type { FieldSpec, SectionSpec } from '../../kit/forms/spec'
import { errorMessage } from '../../kit/ui/errorMessage'
import { LINEA_DE_ORDEN, LINEA_DE_TASA, pagadorDelRecibo } from '../cobro/ReciboEmitido'
import { Alerta } from '../components/Alerta'
import { PdfDialog } from '../components/PdfDialog'
import { useEscritura } from '../escritura/useEscritura'
import { fechaYHoraEnLima, hoyEnLima } from '../fechas'
import { etiqueta } from '../forms/etiquetas'
import type { ReciboEnFicha } from '../types'
import { ActoDeAnulacion, CAMPOS_DE_LA_ANULACION } from './ActoDeAnulacion'
import { recibos } from './api'
import { impedimentoDeAnular, impedimentoDeDuplicar, type ElRecibo, type LaCuenta } from './impedimentos'
import { CAMPOS_DEL_DUPLICADO, PedirDuplicado } from './PedirDuplicado'

// the recibo of the route (/duplicado-recibo/001-0000123): its ficha (GET /recibos/{numero}), its lines, its state and,
// when annulled, its annulment; and its two actions, «Duplicado en PDF» and «Anular», each saying why when it cannot go.
// what the backend answers after an action is read again, never worked out here

const RECIBO: FieldSpec[] = [
  { name: 'numero_impreso', label: 'Número' },
  { name: 'estado', label: 'Estado' },
  { name: 'caja', label: 'Caja', placeholder: () => 'El backend no mandó la caja' },
  { name: 'cajero', label: 'Cajero', span: 3 },
  { name: 'emitido_en', label: 'Emitido en', span: 3 },
  { name: 'forma_pago', label: 'Forma de pago', kind: 'enum' },
  { name: 'tipo_pago', label: 'Tipo de pago', kind: 'enum' },
  { name: 'pagador', label: 'Pagador', span: 4, placeholder: () => 'No se identificó al pagador' },
  { name: 'duplicados', label: 'Duplicados emitidos' },
  { name: 'total', label: 'Total', kind: 'importe', span: 3 },
  { name: 'observacion', label: 'Observación del cobro', span: 3, placeholder: () => 'Sin observación' }
]

const NO_CONSTA = () => 'No consta'

const ANULACION: SectionSpec = {
  id: 'anulacion',
  title: 'Anulación',
  fields: [
    { name: 'fecha', label: 'Anulado el', kind: 'date' },
    { name: 'motivo', label: 'Motivo de la anulación', span: 4 },
    { name: 'autorizado_por', label: 'Autorizado por', span: 3, placeholder: NO_CONSTA },
    { name: 'documento_autorizacion', label: 'N.° de memorando', span: 3, placeholder: NO_CONSTA },
    { name: 'usuario', label: 'Anulado por', span: 3 }
  ]
}

// the account as wasichai says it: its permissions, whether it is an admin, its email and its roles
function useLaCuenta(): LaCuenta {
  const { can, isAdmin, user } = useAuth()
  return { can, isAdmin, email: user?.email ?? null, roles: user?.roles ?? [] }
}

export function ReciboElegido({ numero }: { numero: string }) {
  const cuenta = useLaCuenta()
  if (!numero)
    return (
      <SeccionDelRecibo titulo="Recibo elegido">
        <p className="text-sm text-ink-muted">Elija un recibo de la lista con «Ver».</p>
        <Acciones
          anular={impedimentoDeAnular(cuenta, { estado: 'sin-recibo' }, hoyEnLima())}
          duplicar={impedimentoDeDuplicar(cuenta, { estado: 'sin-recibo' })}
        />
      </SeccionDelRecibo>
    )
  return <FichaDelRecibo key={numero} numero={numero} cuenta={cuenta} />
}

function FichaDelRecibo({ numero, cuenta }: { numero: string; cuenta: LaCuenta }) {
  const ficha = useQuery({ queryKey: ['caja', 'recibo', numero], queryFn: () => recibos.ficha(numero) })
  const queryClient = useQueryClient()
  // the drafts of this recibo's acts: one kept by a 401 opens its act, filled in
  const anulacion = useEscritura(`anulacion.${numero}`, CAMPOS_DE_LA_ANULACION)
  const duplicado = useEscritura(`duplicado.${numero}`, CAMPOS_DEL_DUPLICADO)
  const [anulando, setAnulando] = useState(anulacion.borrador !== null)
  const [duplicando, setDuplicando] = useState(duplicado.borrador !== null)
  const [anulada, setAnulada] = useState(false)
  const [archivo, setArchivo] = useState<PdfFile | null>(null)

  if (ficha.isPending) return <LoadingState label={`Leyendo el recibo ${numero}…`} />

  const elRecibo: ElRecibo = ficha.isError ? { estado: 'ilegible', error: ficha.error } : { estado: 'leido', recibo: ficha.data }
  const noAnula = impedimentoDeAnular(cuenta, elRecibo, hoyEnLima())
  const noDuplica = impedimentoDeDuplicar(cuenta, elRecibo)

  // what the backend says now: the ficha (its state, its count of duplicates) and the list, read again
  const leerOtraVez = () => {
    void queryClient.invalidateQueries({ queryKey: ['caja', 'recibo', numero], refetchType: 'all' })
    void queryClient.invalidateQueries({ queryKey: ['caja', 'recibos'], refetchType: 'all' })
  }

  return (
    <SeccionDelRecibo titulo={`Recibo ${numero}`}>
      {ficha.isError ? (
        <Alerta tono="error">
          No se pudo leer el recibo {numero}: {errorMessage(ficha.error, 'el backend no contestó')}
        </Alerta>
      ) : (
        <Ficha recibo={ficha.data} />
      )}
      {anulada && <Alerta tono="exito">El recibo {numero} quedó anulado.</Alerta>}
      <Acciones
        anular={noAnula}
        duplicar={noDuplica}
        onAnular={() => {
          setAnulada(false)
          setAnulando(true)
        }}
        onDuplicar={() => setDuplicando(true)}
      />
      {duplicando && !noDuplica && (
        <PedirDuplicado
          numero={numero}
          escritura={duplicado}
          onCerrar={() => setDuplicando(false)}
          onEntregado={(entregado) => {
            setDuplicando(false)
            setArchivo(entregado)
            leerOtraVez()
          }}
        />
      )}
      {anulando && !noAnula && ficha.data && (
        <ActoDeAnulacion
          recibo={ficha.data}
          escritura={anulacion}
          onCerrar={() => setAnulando(false)}
          onAnulada={() => {
            setAnulando(false)
            setAnulada(true)
            leerOtraVez()
          }}
          onChoque={leerOtraVez}
        />
      )}
      {archivo && (
        <PdfDialog
          path={recibos.rutaDelDuplicado(numero)}
          titulo={`Duplicado del recibo ${numero}`}
          load={() => Promise.resolve(archivo)}
          onClose={() => setArchivo(null)}
        />
      )}
    </SeccionDelRecibo>
  )
}

function SeccionDelRecibo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby="recibo-elegido-titulo" className="space-y-4">
      <h2 id="recibo-elegido-titulo" className="text-lg font-semibold text-ink">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

// the ficha as the recibo was issued, its lines as its kind reads them, and its annulment when it has one
function Ficha({ recibo }: { recibo: ReciboEnFicha }) {
  const linea = recibo.tipo_pago === 'TASA' ? LINEA_DE_TASA : LINEA_DE_ORDEN
  const valores = {
    ...recibo,
    estado: etiqueta('estado_recibo', recibo.estado),
    emitido_en: fechaYHoraEnLima(recibo.emitido_en),
    pagador: pagadorDelRecibo(recibo)
  }
  return (
    <div className="space-y-4">
      {recibo.anulacion && <Alerta tono="atencion">Este recibo está anulado: no acredita pago.</Alerta>}
      <FieldGrid sections={[{ id: 'recibo', title: 'Recibo', fields: RECIBO }]} values={valores} />
      {recibo.lineas.length === 0 ? (
        <p className="text-sm text-ink-muted">Este recibo no tiene ninguna línea.</p>
      ) : (
        recibo.lineas.map((valoresDeLinea, indice) => <FieldGrid key={indice} sections={[linea(indice)]} values={valoresDeLinea} />)
      )}
      {recibo.anulacion && <FieldGrid sections={[ANULACION]} values={recibo.anulacion} />}
    </div>
  )
}

// the two actions of the recibo: each one, while it cannot go, says why at its side, never mute
function Acciones({
  anular,
  duplicar,
  onAnular,
  onDuplicar
}: {
  anular: string | null
  duplicar: string | null
  onAnular?: () => void
  onDuplicar?: () => void
}) {
  return (
    <div className="flex flex-col items-end gap-2">
      <BotonConMotivo id="duplicado-impedido" impedido={duplicar} onClick={onDuplicar} variante="secondary">
        <FileText className="size-4" />
        Duplicado en PDF
      </BotonConMotivo>
      <BotonConMotivo id="anular-impedido" impedido={anular} onClick={onAnular} variante="danger">
        <Ban className="size-4" />
        Anular
      </BotonConMotivo>
    </div>
  )
}

function BotonConMotivo({
  id,
  impedido,
  onClick,
  variante,
  children
}: {
  id: string
  impedido: string | null
  onClick?: () => void
  variante: 'secondary' | 'danger'
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {impedido && (
        <p id={id} className="max-w-xl text-right text-sm text-ink-muted">
          {impedido}
        </p>
      )}
      <Button variant={variante} disabled={impedido !== null} aria-describedby={impedido ? id : undefined} onClick={onClick}>
        {children}
      </Button>
    </div>
  )
}
