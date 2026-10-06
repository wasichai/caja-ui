// copiado de srtm-ui@a1df33a (src/portal/auth/LoginPage.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
import { ApiError, useWasichaiConfig } from '@wasichai/core'
import { Alert, Button, Card, CardBody, Input, Label } from '@wasichai/ui'
import { Landmark } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { hayBorradores } from '../escritura/borrador'
import { SESION_CADUCADA } from '../escritura/useEscritura'
import { safeNext } from './RequireSession'
import { useSession } from './session'

export function LoginPage() {
  const { user, signIn } = useSession()
  const { appName, defaultLoginEmail } = useWasichaiConfig()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // a write that got a 401 sent the clerk here, and kept what they typed (escritura/useEscritura.tsx): only that
  // leaves a draft in the tab
  const [caducada] = useState(hayBorradores)
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState(defaultLoginEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={next} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate(next, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Correo o contraseña incorrectos' : 'No se pudo iniciar sesión. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-6 py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Landmark className="size-6" />
            </span>
            <h1 className="text-xl font-semibold">{appName}</h1>
            <p className="text-sm text-ink-muted">Ventanilla de Tesorería</p>
          </div>
          {caducada && <Alert tone="warning">{SESION_CADUCADA}</Alert>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
