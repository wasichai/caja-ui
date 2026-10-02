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
- Las piezas copiadas de `srtm-ui@a1df33a` (shell, login, temas, `Alerta`, `BandaTitulo`, `KitDelPortal`) llevan
  arriba la cabecera «copiado de srtm-ui…»: suben a wasichai-ui en la fase 2 (wasichai-ui#14).
- **Las etiquetas de los enums** de caja-backend (`forma_pago`, `estado_orden`, `tipo_pago`, `tipo_evento_pago` y
  `estado_evento`) están en `src/portal/forms/etiquetas.ts`, porque wasichai todavía no las tiene. Un valor que no
  conoce se escribe tal cual.

El admin (`src/admin`) no cambia: sus pantallas salen de lo que caja-backend carga en Core. El enlace
"Administración" del portal solo aparece para ADMIN.

## El kit de formularios (`src/kit`)

Es una **copia temporal y marcada** del kit de `srtm-ui@a1df33a`: `RecordForm`, `FieldGrid`, `EditableList`,
`useUnsavedChanges`, `errorMessage` y lo que los configura (`KitProvider`). Cada archivo lleva la cabecera de la copia,
y la copia es el segundo usuario que el kit necesita para subir a wasichai-ui en la fase 2 (wasichai-ui#14). Vive tras
una frontera que comprueba `src/kit/boundaries.test.tsx`: solo importa el propio kit y los paquetes de los que ya
dependen los de wasichai-ui, no habla el vocabulario de caja ni el de srtm, y cada archivo lleva su cabecera. El
portal le da sus etiquetas y su caja de error con `KitDelPortal`. Las reglas, qué pieza usa cada pantalla y cómo no
divergir, en [`src/kit/README.md`](src/kit/README.md).

## Garantías transversales

Lo que caja-web cumplía en cada pantalla, como primitivas que cada pantalla usa y tests que lo comprueban:

- **Toda cifra va con su fecha, y el cliente formatea sin calcular.** `Importe` (`src/portal/cifras`) recibe el par
  `{ importe, actualizado_a }` del backend, formatea en soles pasándole a `Intl` la cadena (nunca un `Number`: no se
  pierde un céntimo) y dice «al DD/MM/AAAA». En una tabla, la fecha va una vez en la cabecera (`FechaDeLasCifras`).
  Test: `src/portal/cifras/Importe.test.tsx`.
  - **En una ficha** (`FieldGrid`), un importe va con `kind: 'importe'`: `KitDelPortal` se lo da al kit por sus
    `displayKinds` (`src/portal/forms/importe.tsx`) y lo dibuja `Importe`, con su fecha y, si falta, con el motivo
    (el `placeholder` en función del campo, o el genérico). Test: `src/portal/kit.test.tsx`.
  - **Los `kind: 'money'` y `kind: 'decimal'` del kit no se usan en `src/portal`**: `RecordForm` los envía como
    `Number`, que redondea lo tecleado. Un importe que se escribe va como texto, con su propia validación. Test:
    `src/garantias.test.tsx`.
- **Un dato que falta dice por qué, nunca un 0.** `SinDato` dibuja «—» y el motivo. `Importe` con `importe: null`
  exige el motivo por los tipos (lo comprueba un `@ts-expect-error` en el test) y nunca dibuja `0` ni `S/ 0.00`. Un nulo
  que llega sin motivo (el backend mandó `null` donde los tipos prometían un importe) dice «El backend no mandó el
  importe», nunca «—» solo. Test: `src/portal/cifras/Importe.test.tsx`.
- **Ningún total sale del cliente.** Un barrido de `src/` sin los tests: `parseFloat(`, `toFixed(` y `Number(` solo
  donde lo dice una lista blanca exacta, con el motivo de cada entrada. Test: `src/garantias.test.tsx`.
- **Un 401 al escribir pide volver a entrar y guarda lo escrito** (ADR-0044 §Decisión·4 de caja). `useEscritura` y
  `borrador.ts` (`src/portal/escritura`): ante un 401 se guardan en `sessionStorage['caja.borrador.<acto>']` solo los
  campos tecleados y la cuenta, nunca el token ni lo que contestó el backend, y el login dice «La sesión caducó: vuelve
  a entrar. Lo que escribiste quedó guardado.». Con la misma cuenta el acto se rellena; con otra se descarta. Se borra
  al escribir con éxito, al cancelar el acto y al cerrar sesión. Tests: `src/portal/escritura/borrador.test.tsx`, y
  `src/garantias.test.tsx` para que ningún otro archivo guarde borradores.
- **El kit no conoce el dominio.** Test: `src/kit/boundaries.test.tsx`.

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
yarn test            # vitest: admin, login, árbol, límite de error, cuenta, temas, kit, cifras, borrador y guardas
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
