// copiado de srtm-ui@a1df33a (src/portal/shell/WorkspaceTabs.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { TABS_KEY } from '../auth/session'

// the workspace tabs: every screen one opens stays a tab until it is closed, so the clerk at the cash desk keeps a
// duplicate, the day's close and the pending payments a click away. kept per browser tab (sessionStorage)

export interface WorkspaceTab {
  path: string
  label: string
}

interface WorkspaceTabs {
  tabs: WorkspaceTab[]
  open: (tab: WorkspaceTab) => void
  close: (path: string) => void
}

const Context = createContext<WorkspaceTabs | null>(null)

function load(): WorkspaceTab[] {
  try {
    const raw = sessionStorage.getItem(TABS_KEY)
    return raw ? (JSON.parse(raw) as WorkspaceTab[]) : []
  } catch {
    return []
  }
}

export function WorkspaceTabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>(load)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    try {
      sessionStorage.setItem(TABS_KEY, JSON.stringify(tabs))
    } catch {
      // storage full or blocked: tabs just do not survive a reload
    }
  }, [tabs])

  const open = useCallback((tab: WorkspaceTab) => {
    setTabs((current) => {
      const index = current.findIndex((t) => t.path === tab.path)
      if (index === -1) return [...current, tab]
      if (current[index].label === tab.label) return current
      return current.map((t, i) => (i === index ? tab : t))
    })
  }, [])

  // closing the tab on screen moves to its right neighbour, else the left one, else home. the tab goes once the move
  // happens: a page with changes not saved may keep the clerk there (useUnsavedChanges), with its tab
  const close = useCallback(
    (path: string) => {
      const index = tabs.findIndex((t) => t.path === path)
      if (index === -1) return
      const rest = tabs.filter((t) => t.path !== path)
      if (location.pathname === path) navigate(rest[index]?.path ?? rest[index - 1]?.path ?? '/', { state: { cerrar: path } })
      else setTabs(rest)
    },
    [tabs, location.pathname, navigate]
  )
  // once per arrival: back on that history entry later, a page opened again since stays
  const cerrar = (location.state as { cerrar?: string } | null)?.cerrar
  const cerradas = useRef(new Set<string>())
  useEffect(() => {
    if (!cerrar || cerradas.current.has(location.key)) return
    cerradas.current.add(location.key)
    setTabs((current) => current.filter((t) => t.path !== cerrar))
  }, [cerrar, location.key])

  const value = useMemo(() => ({ tabs, open, close }), [tabs, open, close])
  return <Context value={value}>{children}</Context>
}

export function useWorkspaceTabs(): WorkspaceTabs {
  const context = use(Context)
  if (!context) throw new Error('useWorkspaceTabs must be used inside WorkspaceTabsProvider')
  return context
}

// a page registers itself once its label is known
export function useWorkspaceTab(tab: WorkspaceTab | null) {
  const { open } = useWorkspaceTabs()
  const path = tab?.path
  const label = tab?.label
  useEffect(() => {
    if (path && label) open({ path, label })
  }, [open, path, label])
}
