// copiado de srtm-ui@a1df33a (src/portal/components/PdfDialog.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { ApiError } from '@wasichai/core'
import { PdfDialog as PdfDialogBase, type PdfFile } from '@wasichai/ui'
import { errorMessage } from '../../kit/ui/errorMessage'
import { blob } from '../api'

export interface PdfDialogProps {
  // under /api: '/caja/recibos/001-0000001/pdf'
  path: string
  // the dialog's and the embedded PDF's name: 'Recibo 001-0000001'
  titulo: string
  onClose: () => void
  // what the screen says of an error, before the backend's detail: a 409 of the original remits to the duplicate
  explicar?: (error: ApiError) => string | null
  // the file, when the screen got it itself (blob by default). a PDF whose asking writes (a duplicate) is asked once,
  // by the screen, never by the dialog's mounting
  load?: (path: string) => Promise<PdfFile>
}

const comoError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, errorMessage(e, 'No se pudo generar el documento')))

// a PDF of caja-backend embedded to see, print or download it: the library's dialog, fetched with the session's token
// (blob), and the backend's error as the portal writes it: what the screen says of it, and the detail
export function PdfDialog({ path, titulo, onClose, explicar, load = (p) => blob(p) }: PdfDialogProps) {
  return (
    <PdfDialogBase
      title={titulo}
      source={path}
      load={load}
      onClose={onClose}
      renderError={(e) => {
        const error = comoError(e)
        const explicacion = explicar?.(error)
        return (
          <>
            <p className="font-semibold">{explicacion ?? error.message}</p>
            {explicacion && <p>{error.message}</p>}
          </>
        )
      }}
    />
  )
}
