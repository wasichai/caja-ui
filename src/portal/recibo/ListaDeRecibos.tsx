import { useQuery } from '@tanstack/react-query'
import { ApiError, LoadingState } from '@wasichai/core'
import { Alert, Button, Input, Label, PageSizePagination, Table, Td, Th } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { NativeSelect } from '../../kit/forms/NativeSelect'
import { errorMessage } from '../../kit/ui/errorMessage'
import { FechaDeLasCifras, Importe, SinDato } from '../cifras/Importe'
import { conError, ErrorDelCampo } from '../cobro/Formulario'
import { fechaYHoraEnLima } from '../fechas'
import { etiqueta } from '../forms/etiquetas'
import { ESTADOS_DE_RECIBO, type ReciboEnLista } from '../types'
import { FILTROS, recibos, type Filtro, type Filtros } from './api'

// the recibos, newest first, by the filters of the url (?documento=&caja=&cajero=&desde=&hasta=&estado=&page=&size=):
// a reload or a link passed on lists the same. each row's «Ver» takes its recibo to the route, keeping the filters.
// a refusal of the list is said in its place, and the screen goes on (caja ADR-0044: whoever may only annul gets a 403
// here, and the ficha and its actions still say what they say)

// caja-backend's default page, and its largest
const TAMANO = { porDefecto: 25, maximo: 200 }
const TAMANOS = [10, 25, 50, 100] as const

const SIN_PAGADOR = 'No se identificó al pagador'

// a whole number of the url, or the default: what is not one is not asked for
function entero(texto: string | null, porDefecto: number, minimo: number, maximo: number): number {
  const leido = texto !== null && /^\d{1,9}$/.test(texto) ? Number.parseInt(texto, 10) : Number.NaN
  return leido >= minimo && leido <= maximo ? leido : porDefecto
}

export function ListaDeRecibos() {
  const [params, setParams] = useSearchParams()
  const filtros = Object.fromEntries(FILTROS.map((filtro) => [filtro, params.get(filtro) ?? ''])) as Filtros
  const page = entero(params.get('page'), 0, 0, Number.MAX_SAFE_INTEGER)
  const size = entero(params.get('size'), TAMANO.porDefecto, 1, TAMANO.maximo)
  const lista = useQuery({ queryKey: ['caja', 'recibos', filtros, page, size], queryFn: () => recibos.listar(filtros, page, size) })

  // what changes in the url, set (or dropped, when empty or the default) without touching the rest
  const cambiar = (cambios: Record<string, string | null>) =>
    setParams((antes) => {
      const despues = new URLSearchParams(antes)
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor) despues.set(clave, valor)
        else despues.delete(clave)
      }
      return despues
    })

  // a new search starts at its first page. the same filters on the first page are the same url, and so the same query:
  // it is asked again, not left as it was read
  const buscar = (nuevos: Filtros) => {
    if (page === 0 && FILTROS.every((filtro) => nuevos[filtro] === filtros[filtro])) void lista.refetch()
    else cambiar({ ...nuevos, page: null })
  }

  // the 400 of a filter goes under it
  const errores: Partial<Record<Filtro, string>> = Object.fromEntries(
    (lista.error instanceof ApiError ? lista.error.violations : [])
      .filter((v) => (FILTROS as readonly string[]).includes(v.field))
      .map((v) => [v.field, v.message])
  )

  return (
    <>
      <FiltrosDeRecibos key={params.toString()} filtros={filtros} errores={errores} onBuscar={buscar} />

      <section aria-labelledby="recibos-titulo" className="space-y-3">
        <h2 id="recibos-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
          Recibos
        </h2>
        {lista.isPending ? (
          <LoadingState label="Buscando los recibos…" />
        ) : lista.isError ? (
          <Alert tone="danger">No se pudo leer la lista de recibos: {errorMessage(lista.error, 'el backend no contestó')}</Alert>
        ) : lista.data.content.length === 0 ? (
          <p className="text-sm text-ink-muted">Ningún recibo coincide con la búsqueda.</p>
        ) : (
          <>
            <TablaDeRecibos filas={lista.data.content} />
            <PageSizePagination
              page={page}
              size={size}
              total={lista.data.totalElements}
              sizes={TAMANOS}
              onPage={(otra) => cambiar({ page: otra > 0 ? String(otra) : null })}
              onSize={(otro) => cambiar({ size: otro === TAMANO.porDefecto ? null : String(otro), page: null })}
            />
          </>
        )}
      </section>
    </>
  )
}

// the filters as the clerk types them: they go to the url on «Buscar»
function FiltrosDeRecibos({
  filtros,
  errores,
  onBuscar
}: {
  filtros: Filtros
  errores: Partial<Record<Filtro, string>>
  onBuscar: (filtros: Filtros) => void
}) {
  const [tecleados, setTecleados] = useState(filtros)
  const poner = (filtro: Filtro) => (valor: string) => setTecleados((antes) => ({ ...antes, [filtro]: valor }))
  const buscar = (event: FormEvent) => {
    event.preventDefault()
    onBuscar(Object.fromEntries(FILTROS.map((filtro) => [filtro, tecleados[filtro].trim()])) as Filtros)
  }
  const campo = (filtro: Filtro, rotulo: string, tipo: 'text' | 'date' = 'text') => {
    const id = `filtro-${filtro}`
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{rotulo}</Label>
        <Input
          id={id}
          type={tipo}
          autoComplete="off"
          value={tecleados[filtro]}
          onChange={(e) => poner(filtro)(e.target.value)}
          {...conError(id, errores[filtro])}
        />
        <ErrorDelCampo id={id} error={errores[filtro]} />
      </div>
    )
  }
  return (
    <section aria-labelledby="buscar-titulo" className="space-y-2">
      <h2 id="buscar-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
        Buscar recibos
      </h2>
      <form onSubmit={buscar} noValidate className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {campo('documento', 'Documento del pagador')}
        {campo('caja', 'Caja')}
        {campo('cajero', 'Cajero (correo)')}
        {campo('desde', 'Desde', 'date')}
        {campo('hasta', 'Hasta', 'date')}
        <div className="space-y-1.5">
          <Label htmlFor="filtro-estado">Estado</Label>
          <NativeSelect
            id="filtro-estado"
            value={tecleados.estado}
            onChange={(e) => poner('estado')(e.target.value)}
            {...conError('filtro-estado', errores.estado)}
          >
            <option value="">Todos</option>
            {ESTADOS_DE_RECIBO.map((estado) => (
              <option key={estado} value={estado}>
                {etiqueta('estado_recibo', estado)}
              </option>
            ))}
          </NativeSelect>
          <ErrorDelCampo id="filtro-estado" error={errores.estado} />
        </div>
        <div className="flex justify-end sm:col-span-3 lg:col-span-6">
          <Button type="submit" variant="secondary">
            <Search className="size-4" />
            Buscar
          </Button>
        </div>
      </form>
    </section>
  )
}

// a row per recibo. the amounts are the recibos' as they froze them: their date goes once in the heading when all
// share it, and with each figure when not
function TablaDeRecibos({ filas }: { filas: ReciboEnLista[] }) {
  const navigate = useNavigate()
  const { search } = useLocation()
  const fechas = new Set(filas.map((r) => r.total.actualizado_a))
  const comun = fechas.size === 1 ? filas[0].total.actualizado_a : undefined
  const ver = (numero: string) => navigate({ pathname: `/duplicado-recibo/${encodeURIComponent(numero)}`, search })
  return (
    <Table aria-label="Recibos">
      <thead>
        <tr>
          <Th>Número</Th>
          <Th>Emitido</Th>
          <Th>Documento</Th>
          <Th>Pagador</Th>
          <Th className="text-right">
            Importe
            {comun && (
              <>
                {' '}
                <FechaDeLasCifras fecha={comun} />
              </>
            )}
          </Th>
          <Th>Medio de pago</Th>
          <Th className="text-right">Duplicados</Th>
          <Th>Estado</Th>
          <Th>
            <span className="sr-only">Ver</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((recibo) => (
          <tr key={recibo.numero_impreso}>
            <Td className="tabular-nums">{recibo.numero_impreso}</Td>
            <Td>{fechaYHoraEnLima(recibo.emitido_en)}</Td>
            <Td>{recibo.pagador_documento ?? <SinDato motivo={SIN_PAGADOR} />}</Td>
            <Td>{recibo.pagador_nombre ?? <SinDato motivo={SIN_PAGADOR} />}</Td>
            <Td className="text-right">
              <Importe cifra={recibo.total} fechaDeLaTabla={comun} />
            </Td>
            <Td>{etiqueta('forma_pago', recibo.forma_pago)}</Td>
            <Td className="text-right tabular-nums">{recibo.duplicados}</Td>
            <Td>{etiqueta('estado_recibo', recibo.estado)}</Td>
            <Td>
              <Button size="sm" variant="secondary" aria-label={`Ver ${recibo.numero_impreso}`} onClick={() => ver(recibo.numero_impreso)}>
                Ver
              </Button>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
