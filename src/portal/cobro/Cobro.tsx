import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { useState, type FormEvent } from 'react'
import { Importe } from '../cifras/Importe'
import { AvisoDeBorrador } from '../escritura/useEscritura'
import { loQueFalta, type Par } from '../shell/navTree'
import type { CobroHecho, NuevoCobro } from '../types'
import { cobro } from './api'
import { useEnvioDelCobro, validarCobro } from './envio'
import { CampoFormaDePago, CampoObservacion, ConfirmarCobro, impedimentoDeLaVistaPrevia, PieDelCobro, TotalDeLaVistaPrevia } from './Formulario'

// the cobro of the orders marked: the total the backend previews (never one of the client's), the forma de pago and
// the observación, a confirmation (it is not undone) and POST /caja/cobros with its Idempotency-Key. the button is
// never mute: while it cannot cobrar, it says why. the pieces are the cobro's shared ones (Formulario.tsx, envio.ts)

// what POST /caja/cobros asks of the account before it starts (caja-backend's 403)
const PARA_COBRAR: Par[][] = [
  [
    { objeto: 'recibo', accion: 'CREATE' },
    { objeto: 'orden_de_cobro', accion: 'UPDATE' }
  ]
]

// what the clerk types: what a 401 keeps (useEscritura), and the fields a 400 goes under
const CAMPOS = ['forma_pago', 'observacion'] as const

// how a field of the cobro reads when the backend refuses one the form has no control for
const ROTULOS: Record<string, string> = { caja: 'Caja', ordenes: 'Órdenes', fecha_de_pago: 'Fecha de pago', 'Idempotency-Key': 'Clave del intento' }

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
  const { borrador, errores, general, enviando, revisar, enviar } = useEnvioDelCobro({
    acto,
    borradorDe: CAMPOS,
    controles: CAMPOS,
    rotular: (campo) => ROTULOS[campo] ?? campo
  })
  const [forma, setForma] = useState(borrador?.forma_pago ?? '')
  const [observacion, setObservacion] = useState(borrador?.observacion ?? '')
  const [confirmando, setConfirmando] = useState(false)

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
        : impedimentoDeLaVistaPrevia(vista.isError, previa)

  const pedir = (event: FormEvent) => {
    event.preventDefault()
    if (impedido) return
    if (revisar(validarCobro(forma, observacion))) setConfirmando(true)
  }

  const cobrar = async () => {
    if (!caja || !previa) return
    const cuerpo: NuevoCobro = { caja, forma_pago: forma, ordenes, observacion }
    const hecho = await enviar(cuerpo, { forma_pago: forma, observacion }, (clave) => cobro.cobrar(cuerpo, clave))
    setConfirmando(false)
    if (hecho) onCobrado(hecho)
  }

  return (
    <section aria-labelledby="cobro-titulo" className="space-y-4">
      <h2 id="cobro-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
        Cobro
      </h2>
      {borrador && <AvisoDeBorrador />}

      {ordenes.length > 0 && (
        <TotalDeLaVistaPrevia
          cargando={vista.isPending}
          error={vista.isError ? vista.error : null}
          previa={previa}
          sinTotal="Ninguna de las órdenes marcadas se pudo leer: vea los motivos."
        />
      )}

      <form onSubmit={pedir} noValidate className="max-w-xl space-y-4">
        <CampoFormaDePago value={forma} onChange={setForma} error={errores.forma_pago} />
        <CampoObservacion value={observacion} onChange={setObservacion} error={errores.observacion} />
        <PieDelCobro general={general} impedido={impedido} enviando={enviando} />
      </form>

      {confirmando && previa && caja && (
        <ConfirmarCobro
          que="estas órdenes"
          caja={caja}
          forma={forma}
          previa={previa}
          enviando={enviando}
          onConfirm={() => void cobrar()}
          onCancel={() => setConfirmando(false)}
        >
          {previa.lineas.map((linea) => (
            <span role="listitem" key={linea.orden_id ?? linea.concepto} className="block text-ink">
              {linea.concepto} · {linea.referencia_externa} · <Importe cifra={linea.monto} />
            </span>
          ))}
        </ConfirmarCobro>
      )}
    </section>
  )
}
