// copiado de srtm-ui@a1df33a (src/portal/KitDelPortal.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import type { ReactNode } from 'react'
import { KitProvider } from '../kit/KitProvider'
import { Alerta } from './components/Alerta'
import { etiqueta } from './forms/etiquetas'
import { FICHA_DEL_PORTAL } from './forms/importe'

// what the kit's forms and fichas take from the portal: how caja writes an option (forms/etiquetas.ts), the box a
// form's error shows in, and how a ficha draws an amount (kind importe: forms/importe.tsx, with Importe)
const alertaDelFormulario = (mensaje: string) => (
  <Alerta tono="error" className="rounded-md bg-danger/10 px-3 py-2">
    {mensaje}
  </Alerta>
)

export function KitDelPortal({ children }: { children: ReactNode }) {
  return (
    <KitProvider enumLabel={etiqueta} renderAlert={alertaDelFormulario} displayKinds={FICHA_DEL_PORTAL}>
      {children}
    </KitProvider>
  )
}
