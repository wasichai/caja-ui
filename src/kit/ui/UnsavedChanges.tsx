// copiado de srtm-ui@a1df33a (src/kit/ui/UnsavedChanges.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { ConfirmDialog } from '@wasichai/ui'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router'
import { useKit } from '../KitProvider'

// what a page has not saved yet, by the names the user knows it by (its tabs). leaving the page, or the browser tab,
// asks first. moving inside the page (only the url's search changes) does not. `allow` lets the page's own next
// navigation through (a wizard, once it has saved). needs a data router (useBlocker)
export function useUnsavedChanges(pending: string[]): { dialog: ReactNode; allow: () => void } {
  const { texts } = useKit()
  const any = pending.length > 0
  const allowed = useRef(false)
  const block = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => any && !allowed.current && currentLocation.pathname !== nextLocation.pathname,
    [any]
  )
  const blocker = useBlocker(block)

  // closing or reloading the browser tab: the browser's own question, the only one it allows
  useEffect(() => {
    if (!any) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [any])

  const dialog =
    blocker.state === 'blocked' ? (
      <ConfirmDiscard
        title={texts.leaveTitle}
        pending={pending}
        consequence={texts.leaveConsequence}
        confirmLabel={texts.leaveConfirm}
        onConfirm={() => blocker.proceed()}
        onKeep={() => blocker.reset()}
      />
    ) : null
  const allow = useCallback(() => {
    allowed.current = true
  }, [])
  return { dialog, allow }
}

// "lose these changes?": go on without them, or keep editing (also on Escape or the X)
export function ConfirmDiscard({
  title,
  pending,
  consequence,
  confirmLabel,
  onConfirm,
  onKeep
}: {
  title: string
  pending: string[]
  consequence: string
  confirmLabel: string
  onConfirm: () => void
  onKeep: () => void
}) {
  const { texts } = useKit()
  return (
    <ConfirmDialog
      variant="danger"
      title={title}
      description={`${texts.pendingIn(pending.join(', '))} ${consequence}`}
      confirmLabel={confirmLabel}
      cancelLabel={texts.keepEditing}
      onConfirm={onConfirm}
      onCancel={onKeep}
    />
  )
}
