import { useQuery } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Button, ConfirmDialog, Label, Textarea } from '@wasichai/ui'
import { useRef, useState, type FormEvent } from 'react'
import { NativeSelect } from '../../kit/forms/NativeSelect'
import { errorMessage } from '../../kit/ui/errorMessage'
import { Importe } from '../cifras/Importe'
import { Alerta } from '../components/Alerta'
import { AvisoDeBorrador, SesionCaducada, useEscritura } from '../escritura/useEscritura'
import { etiqueta } from '../forms/etiquetas'
import { loQueFalta, type Par } from '../shell/navTree'
import { FORMAS_DE_PAGO, type CobroHecho, type NuevoCobro, type VistaPrevia } from '../types'
import { cobro } from './api'
import { claveDelIntento, type Intento } from './intento'

// the cobro of the orders marked: the total the backend previews (never one of the client's), the forma de pago and
// the observación, a confirmation (it is not undone) and POST /caja/cobros with its Idempotency-Key. the button is
// never mute: while it cannot cobrar, it says why

// what POST /caja/cobros asks of the account before it starts (caja-backend's 403)
const PARA_COBRAR: Par[][] = [
  [
    { objeto: 'recibo', accion: 'CREATE' },
    { objeto: 'orden_de_cobro', accion: 'UPDATE' }
  ]
]

// what the clerk types: what a 401 keeps (useEscritura)
const CAMPOS = ['forma_pago', 'observacion'] as const
type Campo = (typeof CAMPOS)[number]

// caja-backend's Observacion: trimmed, 5 to 500 characters
const OBSERVACION = { minimo: 5, maximo: 500 }

// how a field of the cobro reads when the backend refuses one the form has no control for
const ROTULOS: Record<string, string> = { caja: 'Caja', ordenes: 'Órdenes', fecha_de_pago: 'Fecha de pago', 'Idempotency-Key': 'Clave del intento' }

type Errores = Partial<Record<Campo, string>>

function validar(forma: string, observacion: string): Errores {
  const largo = observacion.trim().length
  return {
    ...(forma ? {} : { forma_pago: 'Elija la forma de pago.' }),
    ...(largo >= OBSERVACION.minimo && largo <= OBSERVACION.maximo ? {} : { observacion: 'Explique el cobro: de 5 a 500 caracteres.' })
  }
}

export function Cobro({
  acto,
  caja,
  sinCaja,
  ordenes,
  onCobrado
}: {
  // the draft's key: the caja and the document of the route
  acto: string
  // the active caja chosen, or null, and then why
  caja: string | null
  sinCaja: string
  // the orden_id marked, in the table's order
  ordenes: string[]
  onCobrado: (hecho: CobroHecho) => void
}) {
  const { can } = useAuth()
  const { borrador, escribir } = useEscritura(acto, CAMPOS)
  const [forma, setForma] = useState(borrador?.forma_pago ?? '')
  const [observacion, setObservacion] = useState(borrador?.observacion ?? '')
  const [errores, setErrores] = useState<Errores>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const intento = useRef<Intento | null>(null)

  const vista = useQuery({
    queryKey: ['caja', 'vista-previa', ordenes],
    queryFn: () => cobro.vistaPrevia(ordenes),
    enabled: ordenes.length > 0
  })
  const previa = ordenes.length > 0 ? vista.data : undefined

  const falta = loQueFalta(PARA_COBRAR, can)
  const impedido = falta
    ? `Su cuenta no puede cobrar: le falta ${falta}.`
    : !caja
      ? sinCaja
      : ordenes.length === 0
        ? 'Marque las órdenes que va a cobrar.'
        : vista.isError
          ? 'No se pudo pedir el total al backend: sin él no se cobra.'
          : !previa
            ? 'Esperando el total del backend.'
            : !previa.cobrable
              ? 'El backend dice que no se puede cobrar: vea los motivos de arriba.'
              : null

  const pedir = (event: FormEvent) => {
    event.preventDefault()
    if (impedido) return
    const halladas = validar(forma, observacion)
    setErrores(halladas)
    setGeneral(null)
    if (Object.keys(halladas).length === 0) setConfirmando(true)
  }

  const cobrar = async () => {
    if (!caja || !previa) return
    const cuerpo: NuevoCobro = { caja, forma_pago: forma, ordenes, observacion }
    intento.current = claveDelIntento(intento.current, cuerpo)
    const { clave } = intento.current
    setEnviando(true)
    try {
      const hecho = await escribir({ forma_pago: forma, observacion }, () => cobro.cobrar(cuerpo, clave))
      onCobrado(hecho)
    } catch (e) {
      // the session expired: the draft is kept and the login says so
      if (e instanceof SesionCaducada) return
      contar(e)
    } finally {
      setEnviando(false)
      setConfirmando(false)
    }
  }

  // a 400 under its field, or above the button when the form has no control for it; any other, with its detail
  const contar = (e: unknown) => {
    const violaciones = e instanceof ApiError ? e.violations : []
    const propias = violaciones.filter((v): v is { field: Campo; message: string } => (CAMPOS as readonly string[]).includes(v.field))
    const ajenas = violaciones.filter((v) => !(CAMPOS as readonly string[]).includes(v.field))
    setErrores(Object.fromEntries(propias.map((v) => [v.field, v.message])))
    if (ajenas.length > 0) setGeneral(ajenas.map((v) => `${ROTULOS[v.field] ?? v.field}: ${v.message}`).join(' · '))
    else if (propias.length === 0) setGeneral(errorMessage(e, 'No se pudo cobrar'))
  }

  return (
    <section aria-labelledby="cobro-titulo" className="space-y-4">
      <h2 id="cobro-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
        Cobro
      </h2>
      {borrador && <AvisoDeBorrador />}

      {ordenes.length > 0 && <TotalDeLaVistaPrevia cargando={vista.isPending} error={vista.isError ? vista.error : null} previa={previa} />}

      <form onSubmit={pedir} noValidate className="max-w-xl space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cobro-forma-pago">Forma de pago</Label>
          <NativeSelect
            id="cobro-forma-pago"
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            aria-invalid={errores.forma_pago ? true : undefined}
            aria-describedby={errores.forma_pago ? 'cobro-forma-pago-error' : undefined}
          >
            <option value="">Elija la forma de pago</option>
            {FORMAS_DE_PAGO.map((valor) => (
              <option key={valor} value={valor}>
                {etiqueta('forma_pago', valor)}
              </option>
            ))}
          </NativeSelect>
          {errores.forma_pago && (
            <p id="cobro-forma-pago-error" className="text-xs text-danger">
              {errores.forma_pago}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cobro-observacion">Observación</Label>
          <Textarea
            id="cobro-observacion"
            rows={2}
            maxLength={OBSERVACION.maximo}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            aria-invalid={errores.observacion ? true : undefined}
            aria-describedby={errores.observacion ? 'cobro-observacion-error' : undefined}
          />
          {errores.observacion && (
            <p id="cobro-observacion-error" className="text-xs text-danger">
              {errores.observacion}
            </p>
          )}
        </div>
        {general && <Alerta tono="error">{general}</Alerta>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {impedido && (
            <p id="cobro-impedido" className="text-sm text-ink-muted">
              {impedido}
            </p>
          )}
          <Button type="submit" disabled={impedido !== null || enviando} aria-describedby={impedido ? 'cobro-impedido' : undefined}>
            Cobrar
          </Button>
        </div>
      </form>

      {confirmando && previa && caja && (
        <ConfirmDialog
          title="Confirmar el cobro"
          description={<Confirmacion previa={previa} caja={caja} forma={forma} />}
          confirmLabel="Cobrar"
          cancelLabel="Cancelar"
          variant="primary"
          busy={enviando}
          onConfirm={() => void cobrar()}
          onCancel={() => setConfirmando(false)}
        />
      )}
    </section>
  )
}

// the total of what is marked, as the backend previews it, and what keeps it from being cobrable, said as it comes
function TotalDeLaVistaPrevia({ cargando, error, previa }: { cargando: boolean; error: unknown; previa: VistaPrevia | undefined }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        Total a cobrar:{' '}
        <span data-ui="total-a-cobrar" className="font-semibold">
          {error ? (
            <span className="font-normal text-danger">No se pudo pedir el total: {errorMessage(error, 'el backend no contestó')}</span>
          ) : cargando || !previa ? (
            <span className="font-normal text-ink-muted">pidiéndolo al backend…</span>
          ) : previa.total ? (
            <Importe cifra={previa.total} />
          ) : (
            <Importe cifra={{ importe: null, actualizado_a: null }} motivo="Ninguna de las órdenes marcadas se pudo leer: vea los motivos." />
          )}
        </span>
      </p>
      {previa && previa.motivos.length > 0 && (
        <Alerta tono="atencion" titulo="No se puede cobrar.">
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {previa.motivos.map((motivo) => (
              <li key={motivo}>{motivo}</li>
            ))}
          </ul>
        </Alerta>
      )}
    </div>
  )
}

// what the confirmation lists: the orders and the total of the preview, and the forma de pago. spans, not a list:
// the dialog's description is a paragraph
function Confirmacion({ previa, caja, forma }: { previa: VistaPrevia; caja: string; forma: string }) {
  return (
    <>
      <span className="block">Se cobran estas órdenes en la caja {caja}:</span>
      <span role="list" className="mt-2 block space-y-1">
        {previa.lineas.map((linea) => (
          <span role="listitem" key={linea.orden_id ?? linea.concepto} className="block text-ink">
            {linea.concepto} · {linea.referencia_externa} · <Importe cifra={linea.monto} />
          </span>
        ))}
      </span>
      {previa.total && (
        <span className="mt-2 block font-semibold text-ink">
          Total: <Importe cifra={previa.total} />
        </span>
      )}
      <span className="block text-ink">Forma de pago: {etiqueta('forma_pago', forma)}</span>
      <span className="mt-2 block">Un cobro no se deshace: para devolverlo hay que anular el recibo.</span>
    </>
  )
}
