import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Label } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { NativeSelect } from '../../kit/forms/NativeSelect'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Alerta } from '../components/Alerta'
import type { CobroHecho } from '../types'
import { cobro } from './api'
import { OrdenesPendientes } from './OrdenesPendientes'
import { ReciboEmitido } from './ReciboEmitido'

// «Caja tributaria» (caja-tributaria): the pending orders of a payer, the total the backend previews, the cobro and
// the recibo in PDF. what is chosen lives in the route, as in caja-web: ?caja=C-01&documento=12345678, so a reload or
// a link passed on shows the same. the orders marked do not: they are this moment's

export function CajaTributariaPage() {
  const [params, setParams] = useSearchParams()
  const caja = params.get('caja') ?? ''
  const documento = params.get('documento') ?? ''
  const [recibo, setRecibo] = useState<CobroHecho | null>(null)
  const queryClient = useQueryClient()
  const cajas = useQuery({ queryKey: ['caja', 'cajas'], queryFn: cobro.cajas })

  const elegir = (clave: 'caja' | 'documento', valor: string) => {
    setParams((antes) => {
      const despues = new URLSearchParams(antes)
      if (valor) despues.set(clave, valor)
      else despues.delete(clave)
      return despues
    })
  }

  // only an active caja of the list cobra: one closed or unknown is said, never chosen
  const activa = cajas.data?.content.find((c) => c.codigo === caja && c.activa === true)

  // why no caja cobra: the cajas that could not be read say so, instead of asking to choose one there is no list of
  const sinCaja = cajas.isError
    ? `Sin caja no se cobra, y las cajas no se pudieron leer: ${errorMessage(cajas.error, 'el backend no contestó')}`
    : cajas.isPending
      ? 'Leyendo las cajas…'
      : 'Elija la caja en la que cobra.'

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

      <section aria-labelledby="caja-titulo" className="space-y-2">
        <h2 id="caja-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
          Caja
        </h2>
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="caja-elegida">Caja</Label>
          <NativeSelect id="caja-elegida" value={activa?.codigo ?? ''} onChange={(e) => elegir('caja', e.target.value)}>
            <option value="">Elija la caja</option>
            {(cajas.data?.content ?? [])
              .filter((c) => c.activa === true)
              .map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.nombre ? `${c.codigo} — ${c.nombre}` : c.codigo}
                </option>
              ))}
          </NativeSelect>
        </div>
        {cajas.isPending && <p className="text-sm text-ink-muted">Leyendo las cajas…</p>}
        {cajas.isError && <Alerta tono="error">No se pudieron leer las cajas: {errorMessage(cajas.error, 'el backend no contestó')}</Alerta>}
        {cajas.data && caja && !activa && (
          <Alerta tono="atencion">
            {cajas.data.content.some((c) => c.codigo === caja) ? `La caja ${caja} está de baja: elija otra.` : `No hay ninguna caja ${caja}: elija otra.`}
          </Alerta>
        )}
        {cajas.data && cajas.data.totalElements > cajas.data.content.length && (
          <p className="text-sm text-ink-muted">
            Se muestran las primeras {cajas.data.content.length} de {cajas.data.totalElements} cajas.
          </p>
        )}
      </section>

      <BuscarPagador key={documento} documento={documento} onBuscar={buscar} />

      {recibo ? (
        <ReciboEmitido cobro={recibo} onNuevo={() => setRecibo(null)} />
      ) : (
        documento && (
          <OrdenesPendientes key={documento} documento={documento} cajaDeLaRuta={caja} caja={activa?.codigo ?? null} sinCaja={sinCaja} onCobrado={cobrado} />
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
