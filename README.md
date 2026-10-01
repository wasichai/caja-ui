# caja-ui

Web de la **caja** (la ventanilla de Tesorería) para [caja-backend](../caja-backend), sobre **wasichai-ui**. Reescribe
la ventanilla de `caja` (`frontend/`) con la misma forma que `srtm-ui`: una sola app Vite + React con dos partes, que
comparten el login (el mismo token en `localStorage['caja.*']`):

| Ruta     | Para quién                | Qué es                                                                                                |
| -------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/`      | el personal de ventanilla | el **portal**: el árbol de Tesorería, con una pantalla por hoja                                       |
| `/admin` | administradores           | el `WasichaiApp` de wasichai-ui con los módulos que corre caja-backend: vistas, formularios y páginas |

|                     |                                                                |
| ------------------- | -------------------------------------------------------------- |
| Puerto              | 5181 (`yarn dev` y `yarn preview`)                             |
| API                 | proxy de `/api` a `http://localhost:8091` (`WASICHAI_API_URL`) |
| Login de desarrollo | `admin@wasichai.local` / `admin` (seed de caja-backend)        |

## Portal (`src/portal`)

- **Sesión**: la de core (`useAuth`), la misma del admin. `RequireSession` lleva a `/login?next=…` sin sesión, y el
  login vuelve a `next` (solo rutas del mismo sitio).
- **La cuenta de la barra** es la que contesta wasichai (`GET /api/auth/me`, con el nombre que core recibió al iniciar
  sesión). Si esa lectura falla, la barra dice «No se conoce la cuenta»: nunca inventa un nombre ni usa el correo
  tecleado.
- **El árbol de Tesorería** (`src/portal/shell/navTree.ts`) tiene las seis hojas de `caja` con su clave y su rótulo.
  Cada hoja declara cuándo se ofrece: una lista de alternativas, y cada alternativa es una lista de pares objeto/acción
  que hay que tener todos. Se cruza con `GET /api/auth/me/permissions` (ADR-020) por `useAuth().can`: ADMIN las ve
  todas.
  - **Una hoja sin pantalla no se dibuja** (caja ADR-0044): una entrada de menú que no lleva a ninguna parte es un
    defecto. Las pantallas se registran en `src/portal/pantallas.ts`, una por PR. Mientras no haya ninguna, el Inicio
    lo dice.
  - Un módulo que se queda sin hojas tampoco se dibuja.
- **Una hoja que revienta no tumba la raíz**: cada pantalla se dibuja dentro de un límite de error (`LimiteDeHoja`)
  que se reinicia al cambiar la ruta. La barra y el árbol siguen, con la frase del fallo, y otra hoja se dibuja.
- **Pestañas de trabajo** por pestaña del navegador (`sessionStorage['caja.tabs']`), y el estado del árbol
  (`sessionStorage['caja.nav']`).
- **Tema**: sistema, claro, oscuro o _Portal tributario_, en el menú de tema de la cabecera.
  - El tema es de `@wasichai/*`: `PORTAL_TRIBUTARIO_THEME` de `@wasichai/core` y la hoja
    `@wasichai/ui/themes/portal-tributario.css`. caja-ui añade los parciales de sus piezas
    (`src/themes/portal-tributario/`). `CAJA_THEMES` (`src/themes`) lo registra en el portal y en el admin.
  - Con _Portal tributario_ cambia también la estructura del portal (barra de marca, árbol plegable, pie):
    `useVarianteTema()` dice `'portal'` o `'clasico'`.
  - La elección se guarda en `caja.theme` y, con un backend que tenga `PUT /auth/me/preferences`, también para el
    usuario. `index.html` aplica el tema antes de cargar la app, para que no parpadee.
- Las piezas copiadas de `srtm-ui@a1df33a` (shell, login, temas) llevan arriba la cabecera «copiado de srtm-ui…»:
  suben a wasichai-ui en la fase 2 (wasichai-ui#14).

El admin (`src/admin`) no cambia: sus pantallas salen de lo que caja-backend carga en Core. El enlace
"Administración" del portal solo aparece para ADMIN.

## Requisitos

- Node 26 y yarn 1.
- Acceso de lectura a GitHub Packages: los paquetes `@wasichai/*` se instalan de `npm.pkg.github.com` (el scope está en
  el `.npmrc` del proyecto). El token va en `~/.npmrc`, fuera del repo:
  ```
  //npm.pkg.github.com/:_authToken=<token con read:packages>
  ```
  Sirve un PAT classic con solo `read:packages`, o el de `gh` (`gh auth refresh -s read:packages`, luego `gh auth token`).

## Arrancar

```bash
yarn install
yarn dev             # http://localhost:5181, con caja-backend corriendo en :8091
```

Backend y datos: ver el README de `caja-backend`.

## Comandos

```bash
yarn test            # vitest: admin, login, árbol por permisos, límite de error, cuenta y temas, con fetch simulado
yarn typecheck
yarn lint            # prettier --check (yarn format lo corrige)
yarn build           # dist/, luego yarn preview
```

## Notas

- Versión de wasichai-ui: `@wasichai/*` 0.4.0, igual en todos los paquetes (`core`, `forms`, `pages`, `ui`, `views` y
  `testing`). Para actualizar, cambiar la versión de todos a la vez en `package.json`, alinear las dependencias que
  comparten (react-query, testing-library…) y correr `yarn install`. Luego reiniciar el servidor con `yarn dev --force`:
  Vite guarda los paquetes pre-empaquetados y, si no, sigue sirviendo la versión anterior.
- Para probar cambios de un checkout local de wasichai-ui antes de publicarlos, `yarn link` no basta: React y
  react-query quedarían duplicados. Mejor `yarn pack` en cada paquete e instalar los `.tgz`.
- El CI (`.github/workflows/ci.yml`) instala `@wasichai/*` con el secreto `PACKAGES_TOKEN` del repositorio (un PAT con
  `read:packages`). Sin ese secreto, el CI falla al instalar.
