import { ApiError } from '@wasichai/core'
import { Button, Input, Label } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { conError, ErrorDelCampo } from '../forms/campos'
import type { Filtros } from './api'

// what «Avance de recaudación», «Recaudación por área» and «Conciliación del día» share: the filters that live in the
// route

// the filters of the route (?desde=&hasta=…): a reload or a link passed on asks the same. setting them drops the empty
// ones and leaves any other key of the url alone. the same filters again are the same query: `repetir` asks it again
// (the screen's refetch), instead of leaving it as it was read
export function useFiltrosDeLaRuta<F extends string>(nombres: readonly F[], repetir: () => void): [Filtros<F>, (nuevos: Filtros<F>) => void] {
  const [params, setParams] = useSearchParams()
  const filtros = Object.fromEntries(nombres.map((nombre) => [nombre, params.get(nombre) ?? ''])) as Filtros<F>
  const poner = (nuevos: Filtros<F>) => {
    if (nombres.every((nombre) => nuevos[nombre] === filtros[nombre])) {
      repetir()
      return
    }
    setParams((antes) => {
      const despues = new URLSearchParams(antes)
      for (const nombre of nombres) {
        if (nuevos[nombre]) despues.set(nombre, nuevos[nombre])
        else despues.delete(nombre)
      }
      return despues
    })
  }
  return [filtros, poner]
}

// the 400 of a filter, by its field, to go under it
export function erroresDe<F extends string>(error: unknown, nombres: readonly F[]): Partial<Record<F, string>> {
  const violaciones = error instanceof ApiError ? error.violations : []
  return Object.fromEntries(violaciones.filter((v) => (nombres as readonly string[]).includes(v.field)).map((v) => [v.field, v.message])) as Partial<
    Record<F, string>
  >
}

export interface CampoDeFiltro<F extends string> {
  nombre: F
  rotulo: string
  tipo?: 'text' | 'date'
}

// the filters as they are typed: they go to the url on «Consultar». mounted again when the url changes (key), so what
// it shows is what the url says
export function FormularioDeFiltros<F extends string>({
  id,
  titulo,
  campos,
  filtros,
  errores,
  onConsultar
}: {
  id: string
  titulo: string
  campos: CampoDeFiltro<F>[]
  filtros: Filtros<F>
  errores: Partial<Record<F, string>>
  onConsultar: (filtros: Filtros<F>) => void
}) {
  const [tecleados, setTecleados] = useState(filtros)
  const consultar = (event: FormEvent) => {
    event.preventDefault()
    onConsultar(Object.fromEntries(campos.map(({ nombre }) => [nombre, tecleados[nombre].trim()])) as Filtros<F>)
  }
  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-2">
      <h2 id={`${id}-titulo`} className="text-xs font-semibold tracking-wide text-ink uppercase">
        {titulo}
      </h2>
      <form onSubmit={consultar} noValidate className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {campos.map(({ nombre, rotulo, tipo = 'text' }) => {
          const campo = `${id}-${nombre}`
          return (
            <div key={nombre} className="space-y-1.5">
              <Label htmlFor={campo}>{rotulo}</Label>
              <Input
                id={campo}
                type={tipo}
                autoComplete="off"
                value={tecleados[nombre]}
                onChange={(e) => setTecleados((antes) => ({ ...antes, [nombre]: e.target.value }))}
                {...conError(campo, errores[nombre])}
              />
              <ErrorDelCampo id={campo} error={errores[nombre]} />
            </div>
          )
        })}
        <div className="flex items-end justify-end sm:col-span-3 lg:col-span-5">
          <Button type="submit" variant="secondary">
            <Search className="size-4" />
            Consultar
          </Button>
        </div>
      </form>
    </section>
  )
}
