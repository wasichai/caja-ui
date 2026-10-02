import { Button } from '@wasichai/ui'
import { FileText, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { FieldGrid } from '../../kit/forms/FieldGrid'
import type { SectionSpec } from '../../kit/forms/spec'
import { Alerta } from '../components/Alerta'
import { PdfDialog } from '../components/PdfDialog'
import { fechaYHoraEnLima } from '../fechas'
import type { CobroHecho } from '../types'
import { cobro } from './api'

// the recibo the cobro issued: its number, when in Lima, the forma de pago, the total with its date and its lines,
// every amount by Importe (the ficha's kind importe). «Ver el recibo» opens the original in PDF; a 409 says it can no
// longer be asked for (another cashier, another day) and that a duplicate is

const SIN_DATO = () => 'El sistema de origen no lo mandó'

const RECIBO: SectionSpec[] = [
  {
    id: 'recibo',
    title: 'Recibo',
    fields: [
      { name: 'numero_impreso', label: 'Número' },
      { name: 'emitido_en', label: 'Emitido en', span: 3 },
      { name: 'forma_pago', label: 'Forma de pago', kind: 'enum' },
      { name: 'total', label: 'Total', kind: 'importe', span: 3 }
    ]
  }
]

const lineaComoSeccion = (indice: number): SectionSpec => ({
  id: `linea-${indice}`,
  title: 'Línea',
  number: indice + 1,
  fields: [
    { name: 'concepto', label: 'Concepto', span: 3, placeholder: SIN_DATO },
    { name: 'detalle', label: 'Detalle', span: 3, placeholder: SIN_DATO },
    { name: 'referencia_externa', label: 'Referencia', placeholder: SIN_DATO },
    { name: 'sistema_origen', label: 'Sistema de origen', placeholder: SIN_DATO },
    { name: 'monto', label: 'Monto', kind: 'importe' }
  ]
})

const ORIGINAL_YA_NO = 'El original de este recibo ya no se puede pedir: pida un duplicado en «Duplicado de recibo».'

export function ReciboEmitido({ cobro: hecho, onNuevo }: { cobro: CobroHecho; onNuevo: () => void }) {
  const { recibo } = hecho
  const [viendo, setViendo] = useState(false)
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
      <FieldGrid sections={RECIBO} values={{ ...recibo, emitido_en: fechaYHoraEnLima(recibo.emitido_en) }} />
      {recibo.lineas.map((linea, indice) => (
        <FieldGrid key={linea.orden_id ?? indice} sections={[lineaComoSeccion(indice)]} values={linea} />
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
