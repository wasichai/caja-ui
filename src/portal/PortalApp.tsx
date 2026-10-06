// copiado de srtm-ui@a1df33a (src/portal/PortalApp.tsx): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// adaptado: diverge de srtm-ui en las rutas: no se enumeran, salen de las hojas del árbol con pantalla (PANTALLAS),
// cada una dentro de GuardaDeHoja y con /:sujeto? si es conSujeto; y en la configuración (prefijo 'caja', appName,
// CAJA_THEMES). el QueryClient, los proveedores de core, el i18n y KitDelPortal son los de srtm
import { QueryClient } from '@tanstack/react-query'
import { ApiError, createRegistry, createWasichaiI18n, EmptyState, navTreeLeaves, resolveConfig, WasichaiProviders } from '@wasichai/core'
import { useState } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router'
import { CAJA_THEMES } from '../themes'
import { client } from './api'
import { LoginPage } from './auth/LoginPage'
import { RequireSession } from './auth/RequireSession'
import { ajustarI18n } from './i18n'
import { KitDelPortal } from './KitDelPortal'
import { InicioPage } from './pages/InicioPage'
import { PANTALLAS } from './pantallas'
import { AppShell } from './shell/AppShell'
import { GuardaDeHoja } from './shell/GuardaDeHoja'
import { NAV_TREE } from './shell/navTree'
import { WorkspaceTabsProvider } from './shell/WorkspaceTabs'

// a 4xx will not change by asking again; a network blip or a 5xx might
const retry = (count: number, error: unknown) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2

// a data router: a page with changes not saved can hold a navigation (useBlocker). a leaf of the tree gets its route
// with its screen, and only then (PANTALLAS): one with none is no page, as it is no menu entry. the screen is kept by
// the leaf's seOfreceCon (GuardaDeHoja), as the tree offers it. one conSujeto takes what is chosen as its last segment
const rutas = () =>
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireSession>
            <WorkspaceTabsProvider>
              <AppShell />
            </WorkspaceTabsProvider>
          </RequireSession>
        }
      >
        <Route index element={<InicioPage />} />
        {navTreeLeaves(NAV_TREE).flatMap((hoja) => {
          const Pantalla = hoja.clave && PANTALLAS[hoja.clave]
          return Pantalla
            ? [
                <Route
                  key={hoja.to}
                  path={hoja.conSujeto ? `${hoja.to}/:sujeto?` : hoja.to}
                  element={
                    <GuardaDeHoja hoja={hoja}>
                      <Pantalla />
                    </GuardaDeHoja>
                  }
                />
              ]
            : []
        })}
        <Route path="*" element={<EmptyState title="Esta página no existe" />} />
      </Route>
    </>
  )

// the clerk's portal: the ventanilla of tesorería. under core's providers, like the admin: one session, and the theme
// the user picked (stored for them) on both sides. no modules: the portal draws its own screens. it registers caja's
// themes like the admin does (their labels are in core's i18n). spanish only, so a locale picked in the admin is left
// alone, with the portal's wording and figures over core's strings (ajustarI18n). the login starts empty: the seed's
// admin is /admin's development login, never a cash desk's. the kit's forms take the portal's labels and error box
// (KitDelPortal)
export function PortalApp() {
  const [app] = useState(() => {
    const config = resolveConfig({
      apiBaseUrl: '/api',
      storagePrefix: 'caja',
      appName: 'Caja',
      languages: ['es'],
      themes: CAJA_THEMES
    })
    const registry = createRegistry([])
    const i18n = createWasichaiI18n({ languages: config.languages, storageKey: client.keys.lang, modules: registry.modules })
    ajustarI18n(i18n)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry, refetchOnWindowFocus: false } } })
    return { config, registry, i18n, queryClient, router: createBrowserRouter(rutas()) }
  })

  return (
    <WasichaiProviders config={app.config} registry={app.registry} apiClient={client} i18n={app.i18n} queryClient={app.queryClient}>
      <KitDelPortal>
        <RouterProvider router={app.router} />
      </KitDelPortal>
    </WasichaiProviders>
  )
}
