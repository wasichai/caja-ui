import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ElegirCaja, useCajaDeLaRuta } from '../cobro/ElegirCaja'
import { ReciboEmitido, seccionDeLinea } from '../cobro/ReciboEmitido'
import { hoyEnLima } from '../fechas'
import type { CobroHecho } from '../types'
import { tasas } from './api'
import { CobroDeTasas } from './CobroDeTasas'

// «Caja de tasas y derechos administrativos» (caja-tasas): the tasas in force and their quantities, the total the
// backend previews, the cobro and the recibo in PDF. the caja lives in the route, as in «Caja tributaria»
// (?caja=C-01); the lines do not: they are this cobro's, and only a 401 keeps them (as code and quantity)

// a line of the recibo: the tasa, how many, at what unit price and for how much, all as the backend issued them
const LINEA_DE_TASA = seccionDeLinea([
  { name: 'concepto', label: 'Concepto', span: 3 },
  { name: 'codigo', label: 'Código' },
  { name: 'cantidad', label: 'Cantidad' },
  { name: 'precio_unitario', label: 'Precio unitario', kind: 'importe' },
  { name: 'monto', label: 'Monto', kind: 'importe' }
])

// the recibo's payer: the one the cobro was sent with (the recibo the backend answers does not carry it), or that none
// was identified, as the PDF says
const PAGADOR = { name: 'pagador', label: 'Pagador', span: 3 as const, placeholder: () => 'No se identificó al pagador' }

export function CajaTasasPage() {
  const caja = useCajaDeLaRuta()
  const hoy = hoyEnLima()
  const vigentes = useQuery({ queryKey: ['caja', 'tasas', hoy], queryFn: () => tasas.vigentes(hoy) })
  const [hecho, setHecho] = useState<{ cobro: CobroHecho; pagador: string | null } | null>(null)
  const queryClient = useQueryClient()

  const cobrado = (cobro: CobroHecho, pagador: string | null) => {
    setHecho({ cobro, pagador })
    queryClient.removeQueries({ queryKey: ['caja', 'vista-previa-tasas'] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Caja de tasas y derechos administrativos</h1>
        <p className="text-sm text-ink-muted">Cobro de las tasas y los derechos del TUPA, al precio de su tarifa vigente.</p>
      </div>

      <ElegirCaja caja={caja} />

      {hecho ? (
        <ReciboEmitido
          cobro={hecho.cobro}
          linea={LINEA_DE_TASA}
          extra={{ fields: [PAGADOR], values: { pagador: hecho.pagador } }}
          onNuevo={() => setHecho(null)}
        />
      ) : (
        // mounted again per caja, as the tributaria's cobro: its draft is the caja's (caja-tasas.<caja>), read once
        <CobroDeTasas key={caja.deLaRuta} caja={caja} vigentes={vigentes} onCobrado={cobrado} />
      )}
    </div>
  )
}
