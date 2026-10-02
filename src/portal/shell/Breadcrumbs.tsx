// copiado de srtm-ui@a1df33a (src/portal/shell/Breadcrumbs.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// adaptado: diverge de srtm-ui en que el rastro sale del árbol que se le ofrece a la cuenta (rastro, useArbol), no de
// una tabla fija de rutas de srtm con su raíz. el dibujo es el de srtm
import { ChevronRight } from 'lucide-react'
import { useLocation } from 'react-router'
import { rastro, useArbol } from './navTree'

// the trail over each screen: its module, then its leaf ("tesorería > duplicado de recibo"), from the tree the account
// is offered. the module is a group of the menu, not a page: plain text. home and pages off the tree have none
export function Breadcrumbs() {
  const { pathname } = useLocation()
  const pasos = rastro(useArbol(), pathname)
  if (!pasos.length) return null
  return (
    <nav aria-label="Ruta" className="border-b border-border bg-surface px-6 py-2 text-xs text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {pasos.map((paso, i) => (
          <li
            key={paso}
            aria-current={i === pasos.length - 1 ? 'page' : undefined}
            className={i === pasos.length - 1 ? 'flex items-center gap-1 font-semibold text-ink' : 'flex items-center gap-1'}
          >
            {i > 0 && <ChevronRight aria-hidden className="size-3 text-ink-muted" />}
            {paso}
          </li>
        ))}
      </ol>
    </nav>
  )
}
