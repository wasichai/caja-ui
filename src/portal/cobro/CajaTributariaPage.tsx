import { useQueryClient } from '@tanstack/react-query'
import { Button, Input, Label } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { CobroHecho } from '../types'
import { ElegirCaja, useCajaDeLaRuta, useEleccionEnLaRuta } from './ElegirCaja'
import { OrdenesPendientes } from './OrdenesPendientes'
import { LINEA_DE_ORDEN, ReciboEmitido } from './ReciboEmitido'

// «Caja tributaria» (caja-tributaria): the pending orders of a payer, the total the backend previews, the cobro and
// the recibo in PDF. what is chosen lives in the route, as in caja-web: ?caja=C-01&documento=12345678, so a reload or
// a link passed on shows the same. the orders marked do not: they are this moment's, and another payer forgets them

export function CajaTributariaPage() {
  const { leer, elegir } = useEleccionEnLaRuta()
  const documento = leer('documento')
  const caja = useCajaDeLaRuta()
  const [recibo, setRecibo] = useState<CobroHecho | null>(null)
  const queryClient = useQueryClient()

  const cobrado = (hecho: CobroHecho) => {
    setRecibo(hecho)
    // the orders paid are no longer pending: asked again, even while the recibo is on screen
    void queryClient.invalidateQueries({ queryKey: ['caja', 'ordenes'], refetchType: 'all' })
    queryClient.removeQueries({ queryKey: ['caja', 'vista-previa'] })
  }

  const buscar = (otro: string) => {
    setRecibo(null)
    elegir('documento', otro)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Caja tributaria</h1>
        <p className="text-sm text-ink-muted">Cobro de las órdenes pendientes que envían los sistemas de origen.</p>
      </div>

      <ElegirCaja caja={caja} />

      <BuscarPagador key={documento} documento={documento} onBuscar={buscar} />

      {recibo ? (
        <ReciboEmitido cobro={recibo} linea={LINEA_DE_ORDEN} onNuevo={() => setRecibo(null)} />
      ) : (
        documento && (
          <OrdenesPendientes key={documento} documento={documento} cajaDeLaRuta={caja.deLaRuta} caja={caja.activa} sinCaja={caja.sinCaja} onCobrado={cobrado} />
        )
      )}
    </div>
  )
}

// the payer, by their document: it goes to ?documento=
function BuscarPagador({ documento, onBuscar }: { documento: string; onBuscar: (documento: string) => void }) {
  const [tecleado, setTecleado] = useState(documento)
  const buscar = (event: FormEvent) => {
    event.preventDefault()
    onBuscar(tecleado.trim())
  }
  return (
    <section aria-labelledby="pagador-titulo" className="space-y-2">
      <h2 id="pagador-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
        Pagador
      </h2>
      <form onSubmit={buscar} className="flex max-w-md items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="documento-pagador">Documento del pagador</Label>
          <Input id="documento-pagador" value={tecleado} onChange={(e) => setTecleado(e.target.value)} autoComplete="off" />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="size-4" />
          Buscar
        </Button>
      </form>
    </section>
  )
}
