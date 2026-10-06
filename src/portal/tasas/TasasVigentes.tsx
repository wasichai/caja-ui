import type { UseQueryResult } from '@tanstack/react-query'
import { LoadingState } from '@wasichai/core'
import { Alert, Button, Input, Label, Table, Td, Th } from '@wasichai/ui'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Importe, SinDato } from '../cifras/Importe'
import type { TasaVigente } from '../types'

// the tasas in force today (GET /api/caja/tasas?vigentes_a=), to add them to the cobro. the buscador is a text filter
// of that list, by code or description: it asks the backend nothing. each one with its price, as Importe with its date

export const NO_REGISTRADO = 'La tarifa no lo registra'

// what is compared: lower case and without accents, so «numeracion» finds «NUMERACIÓN»
const comparable = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')

export function TasasVigentes({
  vigentes,
  agregadas,
  onAgregar
}: {
  vigentes: UseQueryResult<TasaVigente[]>
  // the codes already among the lines
  agregadas: ReadonlySet<string>
  onAgregar: (codigo: string) => void
}) {
  const [filtro, setFiltro] = useState('')
  const buscado = comparable(filtro.trim())
  const lista = vigentes.data ?? []
  const halladas = buscado ? lista.filter((t) => comparable(t.codigo).includes(buscado) || comparable(t.descripcion ?? '').includes(buscado)) : lista

  return (
    <section aria-labelledby="vigentes-titulo" className="space-y-3">
      <h2 id="vigentes-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
        Tasas vigentes
      </h2>
      <div className="max-w-md space-y-1.5">
        <Label htmlFor="buscar-tasa">Buscar tasa</Label>
        <Input
          id="buscar-tasa"
          type="search"
          placeholder="Código o descripción"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          autoComplete="off"
        />
      </div>
      {vigentes.isPending ? (
        <LoadingState label="Leyendo las tasas vigentes…" />
      ) : vigentes.isError ? (
        <Alert tone="danger">No se pudieron leer las tasas vigentes: {errorMessage(vigentes.error, 'el backend no contestó')}</Alert>
      ) : lista.length === 0 ? (
        <p className="text-sm text-ink-muted">No hay tasas vigentes hoy: no hay nada que cobrar.</p>
      ) : halladas.length === 0 ? (
        <p className="text-sm text-ink-muted">Ninguna tasa vigente tiene «{filtro.trim()}» en su código o su descripción.</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <Table aria-label="Tasas vigentes">
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Descripción</Th>
                <Th>Área</Th>
                <Th>Partida</Th>
                <Th className="text-right">Precio</Th>
                <Th>
                  <span className="sr-only">Agregar</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {halladas.map((tasa) => {
                const ya = agregadas.has(tasa.codigo)
                const motivoId = `ya-agregada-${tasa.codigo}`
                return (
                  <tr key={tasa.codigo}>
                    <Td>{tasa.codigo}</Td>
                    <Td>{tasa.descripcion ?? <SinDato motivo={NO_REGISTRADO} />}</Td>
                    <Td>{tasa.area ?? <SinDato motivo={NO_REGISTRADO} />}</Td>
                    <Td>{tasa.partida_presupuestal ?? <SinDato motivo={NO_REGISTRADO} />}</Td>
                    <Td className="text-right">
                      <Importe cifra={tasa.precio} />
                    </Td>
                    <Td>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Agregar ${tasa.codigo}`}
                        disabled={ya}
                        aria-describedby={ya ? motivoId : undefined}
                        onClick={() => onAgregar(tasa.codigo)}
                      >
                        <Plus className="size-4" />
                        Agregar
                      </Button>
                      {ya && (
                        <p id={motivoId} className="mt-0.5 text-xs text-ink-muted">
                          Ya está entre las tasas a cobrar: cambie su cantidad.
                        </p>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  )
}
