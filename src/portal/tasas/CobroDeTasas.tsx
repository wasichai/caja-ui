import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Input, Label } from '@wasichai/ui'
import { useMemo, useState, type FormEvent } from 'react'
import { Importe, SinDato } from '../cifras/Importe'
import type { CajaDeLaRuta } from '../cobro/ElegirCaja'
import { useEnvioDelCobro, validarCobro } from '../cobro/envio'
import {
  CampoFormaDePago,
  CampoObservacion,
  conError,
  ConfirmarCobro,
  ErrorDelCampo,
  impedimentoDeLaVistaPrevia,
  PieDelCobro,
  TotalDeLaVistaPrevia,
  TotalSinPedir
} from '../cobro/Formulario'
import { AvisoDeBorrador } from '../escritura/useEscritura'
import { loQueFalta, type Par } from '../shell/navTree'
import type { CobroHecho, NuevoCobroDeTasas, TasaVigente } from '../types'
import { tasas } from './api'
import { cantidadValida, comoConcepto, lineasComoTexto, lineasDeTexto, type LineaPedida } from './lineas'
import { LineasDeTasas } from './LineasDeTasas'
import { TasasVigentes } from './TasasVigentes'

// the cobro of tasas: the lines (a tasa in force and its quantity), the total the backend previews (never one of the
// client's), the forma de pago, the payer (optional) and the observación, a confirmation (it is not undone) and
// POST /caja/cobros/tasas with its Idempotency-Key. the button is never mute: while it cannot cobrar, it says why. the
// form's pieces are the cobro's shared ones (cobro/Formulario.tsx, cobro/envio.ts)

// what POST /caja/cobros/tasas asks of the account before it starts (caja-backend's 403)
const PARA_COBRAR: Par[][] = [[{ objeto: 'recibo', accion: 'CREATE' }]]

// the fields the form has a control for, where a 400 goes; the draft of a 401 keeps them and the lines
const CONTROLES = ['forma_pago', 'observacion', 'pagador_documento', 'pagador_nombre'] as const
const BORRADOR = [...CONTROLES, 'lineas'] as const

// caja-backend's pagador: up to 20 characters of document and 150 of name
const LARGO = { documento: 20, nombre: 150 }

// how a field of the cobro reads when the backend refuses one the form has no control for. a concepto's, by the code
// of its line: «Cantidad de T-001», as its field is named
const ROTULOS: Record<string, string> = {
  caja: 'Caja',
  conceptos: 'Tasas',
  fecha_de_cobro: 'Fecha de cobro',
  pagador_externo_id: 'Pagador',
  'Idempotency-Key': 'Clave del intento'
}
const DE_CONCEPTO: Record<string, string> = { cantidad: 'Cantidad', codigo: 'Código' }

// the payer as the recibo and the confirmation name it, or null when none was typed
function pagadorComoTexto(documento: string, nombre: string): string | null {
  if (documento && nombre) return `${nombre} (${documento})`
  return nombre || documento || null
}

export function CobroDeTasas({
  caja,
  vigentes,
  onCobrado
}: {
  caja: CajaDeLaRuta
  vigentes: UseQueryResult<TasaVigente[]>
  // the recibo, and the payer it was cobrado to (the recibo the backend answers does not carry it)
  onCobrado: (hecho: CobroHecho, pagador: string | null) => void
}) {
  const { can } = useAuth()
  const { borrador, errores, general, enviando, revisar, enviar } = useEnvioDelCobro({
    acto: `caja-tasas.${caja.deLaRuta}`,
    borradorDe: BORRADOR,
    controles: CONTROLES,
    rotular
  })
  // a draft brings its lines back: a 401 kept them as code and quantity
  const [lineas, setLineas] = useState<LineaPedida[]>(() => lineasDeTexto(borrador?.lineas))
  const [forma, setForma] = useState(borrador?.forma_pago ?? '')
  const [documento, setDocumento] = useState(borrador?.pagador_documento ?? '')
  const [nombre, setNombre] = useState(borrador?.pagador_nombre ?? '')
  const [observacion, setObservacion] = useState(borrador?.observacion ?? '')
  const [confirmando, setConfirmando] = useState(false)

  const porCodigo = useMemo(() => new Map((vigentes.data ?? []).map((t) => [t.codigo, t])), [vigentes.data])
  // a line's code missing from the list: a draft's tasa no longer in force, or a list not read (yet)
  const sinTasa = vigentes.isPending
    ? 'Leyendo las tasas vigentes…'
    : vigentes.isError
      ? 'No se pudieron leer las tasas vigentes'
      : 'No está entre las tasas vigentes de hoy'
  const invalidas = lineas.some((l) => !cantidadValida(l.cantidad))
  // what the preview and the cobro send: only when every quantity is one, so a refused one never reaches the backend
  const conceptos = !invalidas && lineas.length > 0 ? lineas.map(comoConcepto) : null

  const vista = useQuery({
    queryKey: ['caja', 'vista-previa-tasas', conceptos],
    queryFn: () => tasas.vistaPrevia(conceptos ?? []),
    enabled: conceptos !== null
  })
  const previa = conceptos ? vista.data : undefined

  const falta = loQueFalta(PARA_COBRAR, can)
  const impedido = falta
    ? `Su cuenta no puede cobrar: le falta ${falta}.`
    : !caja.activa
      ? caja.sinCaja
      : lineas.length === 0
        ? 'Agregue las tasas que va a cobrar.'
        : invalidas
          ? 'Corrija las cantidades: cada una es un entero de al menos 1.'
          : impedimentoDeLaVistaPrevia(vista.isError, previa)

  // a field of a concepto by its line's code (the lines sent are the ones on screen: the dialog keeps them still)
  function rotular(campo: string): string {
    const concepto = /^conceptos\[(\d+)\]\.(.+)$/.exec(campo)
    const codigo: string | undefined = concepto ? lineas[Number.parseInt(concepto[1], 10)]?.codigo : undefined
    if (concepto && codigo) return `${DE_CONCEPTO[concepto[2]] ?? concepto[2]} de ${codigo}`
    return ROTULOS[campo] ?? campo
  }

  // a line's amount: the preview's, never price × quantity
  const monto = (linea: LineaPedida) => {
    if (!cantidadValida(linea.cantidad)) return <SinDato motivo="Corrija la cantidad para ver el monto." />
    if (invalidas) return <SinDato motivo="Corrija las otras cantidades para ver el monto." />
    if (vista.isError) return <SinDato motivo="No se pudo pedir al backend." />
    if (!previa) return <span className="text-sm text-ink-muted">pidiéndolo al backend…</span>
    const cotizada = previa.lineas.find((l) => l.codigo === linea.codigo)
    return cotizada ? <Importe cifra={cotizada.monto} /> : <SinDato motivo="El backend no la cobra: vea los motivos." />
  }

  const agregar = (codigo: string) => setLineas((antes) => (antes.some((l) => l.codigo === codigo) ? antes : [...antes, { codigo, cantidad: '1' }]))
  const cambiar = (codigo: string, cantidad: string) => setLineas((antes) => antes.map((l) => (l.codigo === codigo ? { ...l, cantidad } : l)))
  const quitar = (codigo: string) => setLineas((antes) => antes.filter((l) => l.codigo !== codigo))

  const pagador = pagadorComoTexto(documento.trim(), nombre.trim())

  const pedir = (event: FormEvent) => {
    event.preventDefault()
    if (impedido) return
    if (revisar(validarCobro(forma, observacion))) setConfirmando(true)
  }

  const cobrar = async () => {
    if (!caja.activa || !previa || !conceptos) return
    const cuerpo: NuevoCobroDeTasas = {
      caja: caja.activa,
      forma_pago: forma,
      conceptos,
      observacion,
      ...(documento.trim() ? { pagador_documento: documento.trim() } : {}),
      ...(nombre.trim() ? { pagador_nombre: nombre.trim() } : {})
    }
    const tecleado = { forma_pago: forma, observacion, pagador_documento: documento, pagador_nombre: nombre, lineas: lineasComoTexto(lineas) }
    const hecho = await enviar(cuerpo, tecleado, (clave) => tasas.cobrar(cuerpo, clave))
    setConfirmando(false)
    if (hecho) onCobrado(hecho, pagador)
  }

  return (
    <>
      <TasasVigentes vigentes={vigentes} agregadas={new Set(lineas.map((l) => l.codigo))} onAgregar={agregar} />

      <LineasDeTasas lineas={lineas} porCodigo={porCodigo} sinTasa={sinTasa} monto={monto} onCantidad={cambiar} onQuitar={quitar} />

      <section aria-labelledby="cobro-titulo" className="space-y-4">
        <h2 id="cobro-titulo" className="text-xs font-semibold tracking-wide text-ink uppercase">
          Cobro
        </h2>
        {borrador && <AvisoDeBorrador />}

        {conceptos ? (
          <TotalDeLaVistaPrevia
            cargando={vista.isPending}
            error={vista.isError ? vista.error : null}
            previa={previa}
            sinTotal="Ninguna de las tasas se puede cobrar: vea los motivos."
          />
        ) : (
          invalidas && <TotalSinPedir motivo="Corrija las cantidades para ver el total." />
        )}

        <form onSubmit={pedir} noValidate className="max-w-xl space-y-4">
          <CampoFormaDePago value={forma} onChange={setForma} error={errores.forma_pago} />
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <CampoDelPagador
              id="cobro-pagador-documento"
              rotulo="Documento del pagador (opcional)"
              largo={LARGO.documento}
              value={documento}
              onChange={setDocumento}
              error={errores.pagador_documento}
            />
            <CampoDelPagador
              id="cobro-pagador-nombre"
              rotulo="Nombre del pagador (opcional)"
              largo={LARGO.nombre}
              value={nombre}
              onChange={setNombre}
              error={errores.pagador_nombre}
            />
          </div>
          <CampoObservacion value={observacion} onChange={setObservacion} error={errores.observacion} />
          <PieDelCobro general={general} impedido={impedido} enviando={enviando} />
        </form>

        {confirmando && previa && caja.activa && (
          <ConfirmarCobro
            que="estas tasas"
            caja={caja.activa}
            forma={forma}
            previa={previa}
            enviando={enviando}
            onConfirm={() => void cobrar()}
            onCancel={() => setConfirmando(false)}
            extra={<span className="block text-ink">Pagador: {pagador ?? 'no se identificó'}</span>}
          >
            {previa.lineas.map((linea) => (
              <span role="listitem" key={linea.codigo ?? linea.concepto} className="block text-ink">
                {linea.codigo} · {linea.concepto} · cantidad {linea.cantidad} · <Importe cifra={linea.monto} />
              </span>
            ))}
          </ConfirmarCobro>
        )}
      </section>
    </>
  )
}

// the payer is optional: a document, a name, both or neither
function CampoDelPagador({
  id,
  rotulo,
  largo,
  value,
  onChange,
  error
}: {
  id: string
  rotulo: string
  largo: number
  value: string
  onChange: (valor: string) => void
  error: string | undefined
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} maxLength={largo} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} {...conError(id, error)} />
      <ErrorDelCampo id={id} error={error} />
    </div>
  )
}
