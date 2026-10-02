import { ConfirmDialog } from '@wasichai/ui'
import { useState } from 'react'
import { RecordForm } from '../../kit/forms/RecordForm'
import type { FieldSpec, SectionSpec } from '../../kit/forms/spec'
import { Importe } from '../cifras/Importe'
import { OBSERVACION } from '../cobro/envio'
import { AvisoDeBorrador, SesionCaducada, type useEscritura } from '../escritura/useEscritura'
import type { AnulacionHecha, PeticionDeAnulacion, ReciboEnFicha } from '../types'
import { recibos } from './api'

// «Anular», where the recibo is (caja ADR-0044): an act with its motive (the ground of the act, printed on the
// duplicate), who authorized it, the memorandum and the observación (another thing, for whoever reads the log). it is
// not undone, so it is confirmed first, never with the browser's confirm(); then POST …/anulacion with the number of
// the route, never a typed one. a 401 keeps what was typed (useEscritura, anulacion.<numero>)

// what the clerk types: what a 401 keeps, and the fields a 400 goes under (caja-backend's names)
export const CAMPOS_DE_LA_ANULACION = ['motivo', 'autorizado_por', 'documento_autorizacion', 'observacion'] as const

type Tecleado = Record<(typeof CAMPOS_DE_LA_ANULACION)[number], string | null>

const hasta = (largo: number) => (valor: string) => valor.length <= largo || `A lo sumo ${largo} caracteres.`

// caja-backend's PeticionDeAnulacion: motivo up to 80, autorizado_por up to 80, documento_autorizacion up to 40, and its
// Observacion of 5 to 500
const ACTO: SectionSpec[] = [
  {
    id: 'anulacion',
    title: 'Datos de la anulación',
    fields: [
      { name: 'motivo', label: 'Motivo', required: true, span: 6, validate: hasta(80), placeholder: 'El sustento del acto: se imprime en el duplicado' },
      { name: 'autorizado_por', label: 'Autorizado por', span: 3, validate: hasta(80) },
      { name: 'documento_autorizacion', label: 'N.° de memorando', span: 3, validate: hasta(40) },
      {
        name: 'observacion',
        label: 'Observación',
        kind: 'longtext',
        required: true,
        span: 6,
        placeholder: 'Por qué se anula, para quien lea la bitácora',
        validate: (valor) => (valor.length >= OBSERVACION.minimo && valor.length <= OBSERVACION.maximo) || 'Explique la anulación: de 5 a 500 caracteres.'
      }
    ] satisfies FieldSpec[]
  }
]

// what is sent: the optional ones only when typed (RecordForm hands a blank as null)
function peticion({ motivo, autorizado_por, documento_autorizacion, observacion }: Tecleado): PeticionDeAnulacion {
  return {
    motivo: motivo ?? '',
    ...(autorizado_por ? { autorizado_por } : {}),
    ...(documento_autorizacion ? { documento_autorizacion } : {}),
    observacion: observacion ?? ''
  }
}

// the act waiting for its confirmation: RecordForm's submit stays pending until it is confirmed or not, so a refusal
// lands where RecordForm puts it (a 400 under its field, any other above its buttons)
interface PorConfirmar {
  tecleado: Tecleado
  resolver: () => void
  rechazar: (error: unknown) => void
}

export function ActoDeAnulacion({
  recibo,
  escritura,
  onCerrar,
  onAnulada
}: {
  recibo: ReciboEnFicha
  // the draft of this recibo's act (anulacion.<numero>), kept by the ficha: a draft opens the act
  escritura: ReturnType<typeof useEscritura>
  onCerrar: () => void
  onAnulada: (hecha: AnulacionHecha) => void
}) {
  const numero = recibo.numero_impreso
  const { borrador, escribir, cancelar } = escritura
  const [porConfirmar, setPorConfirmar] = useState<PorConfirmar | null>(null)
  const [enviando, setEnviando] = useState(false)
  const inicial = Object.fromEntries(CAMPOS_DE_LA_ANULACION.map((campo) => [campo, borrador?.[campo] ?? null])) as Tecleado

  const anular = async () => {
    if (!porConfirmar) return
    const { tecleado, resolver, rechazar } = porConfirmar
    setEnviando(true)
    try {
      const hecha = await escribir(tecleado, () => recibos.anular(numero, peticion(tecleado)))
      resolver()
      onAnulada(hecha)
    } catch (e) {
      // a 401: the draft is kept and the login says so; the act has nothing more to say
      if (e instanceof SesionCaducada) resolver()
      else rechazar(e)
    } finally {
      setEnviando(false)
      setPorConfirmar(null)
    }
  }

  const volver = () => {
    porConfirmar?.resolver()
    setPorConfirmar(null)
  }

  const pagador = [recibo.pagador_nombre, recibo.pagador_documento && `(${recibo.pagador_documento})`].filter(Boolean).join(' ')

  return (
    <section aria-labelledby="anulacion-titulo" className="space-y-4 rounded-md border border-border p-4">
      <h3 id="anulacion-titulo" className="text-sm font-semibold text-ink">
        Anular el recibo {numero}
      </h3>
      <p className="text-sm text-ink-muted">
        Anular no borra: el recibo queda anulado, con su número, sus líneas y su total, y las órdenes que cobró vuelven a estar pendientes.
      </p>
      {borrador && <AvisoDeBorrador />}
      <RecordForm<Tecleado>
        sections={ACTO}
        initial={inicial}
        submitLabel="Anular el recibo"
        cancelLabel="Cancelar"
        onCancel={() => {
          cancelar()
          onCerrar()
        }}
        onSubmit={(tecleado) => new Promise<void>((resolver, rechazar) => setPorConfirmar({ tecleado, resolver, rechazar }))}
      />
      {porConfirmar && (
        <ConfirmDialog
          title="Confirmar la anulación"
          description={
            <>
              <span className="block">
                Se anula el recibo {numero}
                {pagador && `, de ${pagador}`}, por <Importe cifra={recibo.total} />.
              </span>
              <span className="mt-2 block text-ink">Motivo: {porConfirmar.tecleado.motivo}</span>
              <span className="mt-2 block">
                Anular no se deshace: las órdenes que cobró vuelven a estar pendientes y el sistema de origen recibe el aviso para reversar el pago.
              </span>
            </>
          }
          confirmLabel="Anular"
          cancelLabel="Volver"
          variant="danger"
          busy={enviando}
          onConfirm={() => void anular()}
          onCancel={volver}
        />
      )}
    </section>
  )
}
