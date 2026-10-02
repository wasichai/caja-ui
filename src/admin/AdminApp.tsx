import { WasichaiApp } from '@wasichai/core'
import { formsModule } from '@wasichai/forms'
import { pagesModule } from '@wasichai/pages'
import { viewsModule } from '@wasichai/views'
import { CAJA_THEMES } from '../themes'

// the admin: core plus the modules caja-backend runs (views, forms, pages), under /admin. storagePrefix 'caja' is the
// portal's too, so one sign-in serves both. caja's themes are the portal's, so a theme picked on one side shows on
// the other
export function AdminApp() {
  return (
    <WasichaiApp
      config={{
        apiBaseUrl: '/api',
        appName: 'Caja',
        appTagline: 'Administración',
        storagePrefix: 'caja',
        basename: '/admin',
        defaultLoginEmail: 'admin@wasichai.local',
        themes: CAJA_THEMES
      }}
      modules={[viewsModule(), formsModule(), pagesModule()]}
    />
  )
}
