import { Button } from '@wasichai/ui'
import { FileText, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { FieldGrid } from '../../kit/forms/FieldGrid'
import type { FieldSpec, SectionSpec } from '../../kit/forms/spec'
import { Alerta } from '../components/Alerta'
import { PdfDialog } from '../components/PdfDialog'
import { fechaYHoraEnLima } from '../fechas'
import type { CobroHecho } from '../types'
import { cobro } from './api'

// the recibo a cobro issued, the same for «Caja tributaria» and «Caja de tasas»: its number, when in Lima, the forma de
// pago, the total with its date and its lines, every amount by Importe (the ficha's kind importe). each screen says how
// its lines read, and may add fields of its own. «Ver el recibo» opens the original in PDF; a 409 says it can no longer
// be asked for (another cashier, another day) and that a duplicate is

const RECIBO: FieldSpec[] = [
  { name: 'numero_impreso', label: 'Número' },
  { name: 'emitido_en', label: 'Emitido en', span: 3 },
  { name: 'forma_pago', label: 'Forma de pago', kind: 'enum' },
  { name: 'total', label: 'Total', kind: 'importe', span: 3 }
]

// a line of the recibo as a ficha's section, by its fields
export const seccionDeLinea =
  (fields: FieldSpec[]) =>
  (indice: number): SectionSpec => ({ id: `linea-${indice}`, title: 'Línea', number: indice + 1, fields })

const DEL_ORIGEN = () => 'El sistema de origen no lo mandó'

// a line of a recibo of orders: the order it cobró, with what its source system sent
export const LINEA_DE_ORDEN = seccionDeLinea([
  { name: 'concepto', label: 'Concepto', span: 3, placeholder: DEL_ORIGEN },
  { name: 'detalle', label: 'Detalle', span: 3, placeholder: DEL_ORIGEN },
  { name: 'referencia_externa', label: 'Referencia', placeholder: DEL_ORIGEN },
  { name: 'sistema_origen', label: 'Sistema de origen', placeholder: DEL_ORIGEN },
  { name: 'monto', label: 'Monto', kind: 'importe' }
])

// a line of a recibo of tasas: the tasa, how many, at what unit price and for how much, all as the backend issued them
export const LINEA_DE_TASA = seccionDeLinea([
  { name: 'concepto', label: 'Concepto', span: 3 },
  { name: 'codigo', label: 'Código' },
  { name: 'cantidad', label: 'Cantidad' },
  { name: 'precio_unitario', label: 'Precio unitario', kind: 'importe' },
  { name: 'monto', label: 'Monto', kind: 'importe' }
])

const ORIGINAL_YA_NO = 'El original de este recibo ya no se puede pedir: pida un duplicado en «Duplicado de recibo».'

export function ReciboEmitido({
  cobro: hecho,
  linea,
  extra,
  onNuevo
}: {
  cobro: CobroHecho
  // how each line reads (seccionDeLinea)
  linea: (indice: number) => SectionSpec
  // fields of the screen's own after the recibo's, with their values
  extra?: { fields: FieldSpec[]; values: object }
  onNuevo: () => void
}) {
  const { recibo } = hecho
  const [viendo, setViendo] = useState(false)
  const seccion: SectionSpec = { id: 'recibo', title: 'Recibo', fields: [...RECIBO, ...(extra?.fields ?? [])] }
  return (
    <section aria-labelledby="recibo-titulo" className="space-y-4">
      <h2 id="recibo-titulo" className="text-lg font-semibold text-ink">
        Recibo {recibo.numero_impreso}
      </h2>
      {hecho.emitido ? (
        <Alerta tono="exito">Se cobró y se emitió el recibo.</Alerta>
      ) : (
        <Alerta tono="aviso">Este cobro ya se había registrado con este mismo intento: no se cobró otra vez.</Alerta>
      )}
      <FieldGrid sections={[seccion]} values={{ ...extra?.values, ...recibo, emitido_en: fechaYHoraEnLima(recibo.emitido_en) }} />
      {recibo.lineas.map((valores, indice) => (
        <FieldGrid key={indice} sections={[linea(indice)]} values={valores} />
      ))}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onNuevo}>
          <RotateCcw className="size-4" />
          Nuevo cobro
        </Button>
        <Button onClick={() => setViendo(true)}>
          <FileText className="size-4" />
          Ver el recibo
        </Button>
      </div>
      {viendo && (
        <PdfDialog
          path={cobro.pdfDelRecibo(recibo.numero_impreso)}
          titulo={`Recibo ${recibo.numero_impreso}`}
          onClose={() => setViendo(false)}
          explicar={(error) => (error.status === 409 ? ORIGINAL_YA_NO : null)}
        />
      )}
    </section>
  )
}
