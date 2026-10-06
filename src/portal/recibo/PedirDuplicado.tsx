import { ApiError } from '@wasichai/core'
import { Alert, Button, Label, type PdfFile, Textarea } from '@wasichai/ui'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../kit/ui/errorMessage'
import { OBSERVACION } from '../forms/campos'
import { conError, ErrorDelCampo } from '../forms/campos'
import { AvisoDeBorrador, SesionCaducada, type useEscritura } from '../escritura/useEscritura'
import { recibos } from './api'

// «Duplicado en PDF»: asking for one writes (each reprint is registered with its observación), so it asks why, and it
// is never set off by opening the ficha. only PDF (decision 8). a 409 says the recibo is no longer drawn the same: what
// it froze changed since its first reprint, and nothing was handed out nor registered. a 401 keeps the observación
// (useEscritura, duplicado.<numero>)

// what the clerk types: what a 401 keeps
export const CAMPOS_DEL_DUPLICADO = ['observacion'] as const

const YA_NO_SE_DIBUJA_IGUAL = 'Este recibo ya no se dibuja igual que en su reimpresión anterior: no se entregó ni se registró este duplicado.'

export function PedirDuplicado({
  numero,
  escritura,
  onCerrar,
  onEntregado
}: {
  numero: string
  // the draft of this recibo's duplicate (duplicado.<numero>), kept by the ficha: a draft opens the form
  escritura: ReturnType<typeof useEscritura>
  onCerrar: () => void
  onEntregado: (archivo: PdfFile) => void
}) {
  const { borrador, escribir, cancelar } = escritura
  const [observacion, setObservacion] = useState(borrador?.observacion ?? '')
  const [error, setError] = useState<string | undefined>()
  const [general, setGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const id = 'duplicado-observacion'

  const contar = (e: unknown) => {
    const violaciones = e instanceof ApiError ? e.violations : []
    const suya = violaciones.find((v) => v.field === 'observacion')
    const ajenas = violaciones.filter((v) => v.field !== 'observacion')
    setError(suya?.message)
    if (ajenas.length > 0) setGeneral(ajenas.map((v) => `${v.field}: ${v.message}`).join(' · '))
    else if (e instanceof ApiError && e.status === 409) setGeneral(`${YA_NO_SE_DIBUJA_IGUAL} ${e.message}`)
    else if (!suya) setGeneral(errorMessage(e, 'No se pudo pedir el duplicado'))
  }

  const pedir = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)
    const texto = observacion.trim()
    if (texto.length < OBSERVACION.minimo || texto.length > OBSERVACION.maximo) {
      setError('Explique la reimpresión: de 5 a 500 caracteres.')
      return
    }
    setError(undefined)
    setEnviando(true)
    try {
      onEntregado(await escribir({ observacion }, () => recibos.duplicado(numero, texto)))
    } catch (e) {
      if (!(e instanceof SesionCaducada)) contar(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section aria-labelledby="duplicado-titulo" className="space-y-3 rounded-md border border-border p-4">
      <h3 id="duplicado-titulo" className="text-sm font-semibold text-ink">
        Pedir un duplicado
      </h3>
      <p className="text-sm text-ink-muted">Cada duplicado queda registrado con su observación, y el papel dice qué duplicado es.</p>
      {borrador && <AvisoDeBorrador />}
      <form onSubmit={(e) => void pedir(e)} noValidate className="max-w-xl space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={id}>Observación</Label>
          <Textarea
            id={id}
            rows={2}
            maxLength={OBSERVACION.maximo}
            placeholder="Por qué se reimprime"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            {...conError(id, error)}
          />
          <ErrorDelCampo id={id} error={error} />
        </div>
        {general && <Alert tone="danger">{general}</Alert>}
        {/* while it is asked, the reprint is already on its way: cancelling would only lose the PDF, or its refusal */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={enviando}
            onClick={() => {
              cancelar()
              onCerrar()
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Pidiendo el duplicado…' : 'Pedir el duplicado'}
          </Button>
        </div>
      </form>
    </section>
  )
}
