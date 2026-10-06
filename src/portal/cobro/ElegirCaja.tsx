import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Alert, Label } from '@wasichai/ui'
import { useSearchParams } from 'react-router'
import { NativeSelect } from '../../kit/forms/NativeSelect'
import { errorMessage } from '../../kit/ui/errorMessage'
import type { CajaEnLista, Pagina } from '../types'
import { cobro } from './api'

// the caja a screen of the cash desk cobra in, chosen in the route as in caja-web (?caja=C-01): a reload or a link
// passed on shows the same. shared by «Caja tributaria» and «Caja de tasas»

// what a screen chose, in its url: read by name, and set (or dropped, when empty) without touching the rest
export function useEleccionEnLaRuta() {
  const [params, setParams] = useSearchParams()
  const elegir = (clave: string, valor: string) => {
    setParams((antes) => {
      const despues = new URLSearchParams(antes)
      if (valor) despues.set(clave, valor)
      else despues.delete(clave)
      return despues
    })
  }
  return { leer: (clave: string) => params.get(clave) ?? '', elegir }
}

export interface CajaDeLaRuta {
  // the caja of the url, as it is: the drafts' key
  deLaRuta: string
  // the active caja of the list it names, or null: only one of those cobra
  activa: string | null
  // why no caja cobra while activa is null: the cajas that could not be read say so, instead of asking to choose one
  // from a list there is not
  sinCaja: string
  cajas: UseQueryResult<Pagina<CajaEnLista>>
  elegir: (codigo: string) => void
}

export function useCajaDeLaRuta(): CajaDeLaRuta {
  const { leer, elegir } = useEleccionEnLaRuta()
  const deLaRuta = leer('caja')
  const cajas = useQuery({ queryKey: ['caja', 'cajas'], queryFn: cobro.cajas })
  // only an active caja of the list cobra: one closed or unknown is said, never chosen
  const activa = cajas.data?.content.find((c) => c.codigo === deLaRuta && c.activa === true)?.codigo ?? null
  const sinCaja = cajas.isError
    ? `Sin caja no se cobra, y las cajas no se pudieron leer: ${errorMessage(cajas.error, 'el backend no contestó')}`
    : cajas.isPending
      ? 'Leyendo las cajas…'
      : 'Elija la caja en la que cobra.'
  return { deLaRuta, activa, sinCaja, cajas, elegir: (codigo) => elegir('caja', codigo) }
}

// the section that chooses it: the active cajas, and what is wrong with the one of the url
export function ElegirCaja({ caja }: { caja: CajaDeLaRuta }) {
  const { deLaRuta, activa, cajas } = caja
  return (
    <section aria-labelledby="caja-titulo" className="space-y-2">
      <h2 id="caja-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
        Caja
      </h2>
      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="caja-elegida">Caja</Label>
        <NativeSelect id="caja-elegida" value={activa ?? ''} onChange={(e) => caja.elegir(e.target.value)}>
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
      {/* in line under the picker, not LoadingState's centered block; a status, as every other wait of the portal */}
      {cajas.isPending && (
        <p role="status" className="text-sm text-ink-muted">
          Leyendo las cajas…
        </p>
      )}
      {cajas.isError && <Alert tone="danger">No se pudieron leer las cajas: {errorMessage(cajas.error, 'el backend no contestó')}</Alert>}
      {cajas.data && deLaRuta && !activa && (
        <Alert tone="warning">
          {cajas.data.content.some((c) => c.codigo === deLaRuta)
            ? `La caja ${deLaRuta} está de baja: elija otra.`
            : `No hay ninguna caja ${deLaRuta}: elija otra.`}
        </Alert>
      )}
      {cajas.data && cajas.data.totalElements > cajas.data.content.length && (
        <p className="text-sm text-ink-muted">
          Se muestran las primeras {cajas.data.content.length} de {cajas.data.totalElements} cajas.
        </p>
      )}
    </section>
  )
}
