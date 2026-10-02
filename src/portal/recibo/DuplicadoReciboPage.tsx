import { useParams } from 'react-router'
import { ListaDeRecibos } from './ListaDeRecibos'
import { ReciboElegido } from './ReciboElegido'

// «Duplicado de recibo» (duplicado-recibo): the recibos by their filters, the one chosen in the route
// (/duplicado-recibo/001-0000123?documento=…), its duplicate in PDF and «Anular», where the recibo is in sight (caja
// ADR-0044): its payer, its amount and its state. the leaf is offered with READ on recibo or CREATE on anulacion_recibo:
// whoever may only annul gets this screen too, and each part says what it cannot do and why
export function DuplicadoReciboPage() {
  const numero = useParams().sujeto ?? ''
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Duplicado de recibo</h1>
        <p className="text-sm text-ink-muted">Busque el recibo, ábralo para ver su duplicado y, si procede, anúlelo desde aquí.</p>
      </div>
      <ListaDeRecibos />
      <ReciboElegido numero={numero} />
    </div>
  )
}
