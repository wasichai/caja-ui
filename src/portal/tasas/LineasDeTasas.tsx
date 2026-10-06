import { Button, Input, Table, Td, Th } from '@wasichai/ui'
import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Importe, SinDato } from '../cifras/Importe'
import { conError, ErrorDelCampo } from '../forms/campos'
import type { TasaVigente } from '../types'
import { CANTIDAD_INVALIDA, cantidadValida, type LineaPedida } from './lineas'
import { NO_REGISTRADO } from './TasasVigentes'

// the tasas to cobrar: they live in the screen until it cobra (no backend holds them). each one with what GET /tasas
// says of it (description, area, partida, unit price), its quantity, which is typed and checked here, and its amount,
// which is the preview's: the client never multiplies. a table of its own, not the kit's EditableList (README)

export function LineasDeTasas({
  lineas,
  porCodigo,
  sinTasa,
  monto,
  onCantidad,
  onQuitar
}: {
  lineas: LineaPedida[]
  // the tasas in force, by code
  porCodigo: ReadonlyMap<string, TasaVigente>
  // why a line's code is not among them: not in force today, or the list could not be read
  sinTasa: string
  // a line's amount as the preview says it, or why there is none
  monto: (linea: LineaPedida) => ReactNode
  onCantidad: (codigo: string, cantidad: string) => void
  onQuitar: (codigo: string) => void
}) {
  return (
    <section aria-labelledby="lineas-titulo" className="space-y-3">
      <h2 id="lineas-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
        Tasas a cobrar
      </h2>
      {lineas.length === 0 ? (
        <p className="text-sm text-ink-muted">Agregue las tasas que va a cobrar desde la lista de tasas vigentes.</p>
      ) : (
        <Table aria-label="Tasas a cobrar">
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Descripción</Th>
              <Th>Área</Th>
              <Th>Partida</Th>
              <Th className="text-right">Precio unitario</Th>
              <Th>Cantidad</Th>
              <Th className="text-right">Monto</Th>
              <Th>
                <span className="sr-only">Quitar</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea) => {
              const tasa = porCodigo.get(linea.codigo)
              const id = `cantidad-${linea.codigo}`
              const error = cantidadValida(linea.cantidad) ? undefined : CANTIDAD_INVALIDA
              return (
                <tr key={linea.codigo}>
                  <Td>{linea.codigo}</Td>
                  <Td>{tasa ? (tasa.descripcion ?? <SinDato motivo={NO_REGISTRADO} />) : <SinDato motivo={sinTasa} />}</Td>
                  <Td>{tasa?.area ?? <SinDato motivo={tasa ? NO_REGISTRADO : sinTasa} />}</Td>
                  <Td>{tasa?.partida_presupuestal ?? <SinDato motivo={tasa ? NO_REGISTRADO : sinTasa} />}</Td>
                  <Td className="text-right">{tasa ? <Importe cifra={tasa.precio} /> : <SinDato motivo={sinTasa} />}</Td>
                  <Td>
                    <Input
                      id={id}
                      className="w-24"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label={`Cantidad de ${linea.codigo}`}
                      value={linea.cantidad}
                      onChange={(e) => onCantidad(linea.codigo, e.target.value)}
                      {...conError(id, error)}
                    />
                    <ErrorDelCampo id={id} error={error} />
                  </Td>
                  <Td className="text-right">
                    <span data-ui="monto-de-linea">{monto(linea)}</span>
                  </Td>
                  <Td>
                    <Button variant="ghost" size="icon" aria-label={`Quitar ${linea.codigo}`} onClick={() => onQuitar(linea.codigo)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </section>
  )
}
