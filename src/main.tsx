import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from './admin/AdminApp'
import { PortalApp } from './portal/PortalApp'
import './index.css'

// two apps, one bundle: /admin is wasichai's admin, everything else the clerk's portal
const admin = /^\/admin(\/|$)/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(<StrictMode>{admin ? <AdminApp /> : <PortalApp />}</StrictMode>)
