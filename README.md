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
    lo dice. Hoy hay dos: Caja tributaria y Caja de tasas y derechos administrativos.
  - Un módulo que se queda sin hojas tampoco se dibuja.
  - **La pantalla se guarda con el mismo `seOfreceCon`** (`GuardaDeHoja`): quien llega por la URL sin permiso lee qué
    le falta («Su cuenta no puede abrir «Caja tributaria»: le falta lectura de orden_de_cobro.»), en vez de una
    pantalla llena de 403. Si los permisos no se pudieron leer, lo dice y no la abre. Test: `src/portal/guarda.test.tsx`.
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

## Pantallas de Tesorería (`src/portal/cobro`, `src/portal/tasas`)

Las dos cajas comparten sus piezas, que viven en `src/portal/cobro`:

- `ElegirCaja.tsx`: la caja elegida en la ruta (`useCajaDeLaRuta`), solo las activas, y por qué no hay caja.
- `Formulario.tsx`: la forma de pago, la observación, el total de la vista previa con sus motivos, el botón «Cobrar»
  que dice por qué no puede y la confirmación.
- `envio.ts`: la validación común y `useEnvioDelCobro` (la `Idempotency-Key` de `intento.ts`, el borrador de
  `useEscritura` ante un 401, y el 400 bajo su campo o encima del botón).
- `ReciboEmitido.tsx`: el recibo emitido y su PDF; cada pantalla dice cómo se lee una línea.

### Caja tributaria (`/caja-tributaria`)

Cobra las órdenes pendientes que envían los sistemas de origen y emite el recibo. Se ofrece con lectura de
`orden_de_cobro`, y con el mismo par se guarda su ruta.

- **Lo elegido vive en la ruta**, como en caja-web: `/caja-tributaria?caja=C-01&documento=12345678`. Recargar o pasar
  el enlace muestra lo mismo. Lo marcado no va en la URL: es de ese momento, y se olvida al cambiar de pagador.
- **La caja**: `GET /api/caja/cajas`, solo las activas. Una caja de la URL que está de baja, o que no existe, se dice
  y no se elige.
- **Las órdenes pendientes del pagador**: `GET /api/caja/ordenes-de-cobro?pagador_documento=…&estado=PENDIENTE`, con
  concepto, detalle, referencia, sistema de origen, fecha de exigibilidad e importe (`Importe`, con su fecha), y una
  casilla por fila. Una orden que no se puede marcar dice por qué: la que todavía no es exigible (hoy en Lima) y la de
  otro sistema que el de lo marcado, porque un recibo se anula entero (una orden sin sistema marcada también impide las
  de otro). Sin órdenes: «Este documento no tiene órdenes pendientes».
- **El total lo da el backend**: al cambiar lo marcado, `POST /api/caja/cobros/vista-previa` devuelve el total, que se
  dibuja tal cual con `Importe`, y los `motivos` por los que no se puede cobrar, que se dicen como vienen. El cliente
  no suma nada.
- **Cobrar**: forma de pago (las cinco, con su `etiqueta`) y observación (de 5 a 500 caracteres). Se confirma con
  `ConfirmDialog`, que lista las órdenes y el total de la vista previa, porque no se deshace. `POST /api/caja/cobros`
  va con un `Idempotency-Key`: un UUID por intento, el mismo si se reenvía ese intento y otro si cambia lo que se manda
  (`cobro/intento.ts`).
  - **El botón «Cobrar» nunca está mudo**: si no se puede (sin CREATE de `recibo` o UPDATE de `orden_de_cobro`, sin
    caja, sin nada marcado, sin el total, o con motivos del backend) dice por qué a su lado. Si las cajas no se
    pudieron leer (un 403, un error), dice eso con su motivo, no «Elija la caja».
  - Un 400 se dice bajo su campo, o encima del botón si el formulario no tiene ese campo. Un 403, 404 o 409, con su
    `detail`.
  - Un 401 guarda la forma de pago y la observación con `useEscritura`, con la clave `caja-tributaria.<caja>.<documento>`,
    y al volver a entrar con la misma cuenta el formulario se rellena.
- **El recibo emitido**: número, emitido en (hora de Lima), forma de pago, total y líneas, en `FieldGrid` con el
  `kind` `importe`. Si fue el reenvío de un intento ya cobrado (200, `emitido: false`), lo dice. «Ver el recibo» abre
  `GET /api/caja/recibos/{numero_impreso}/pdf` en `PdfDialog` (`blob` de `src/portal/api.ts`). Un 409 dice que el
  original ya no se puede pedir y que hay que pedir un duplicado.

Tests: `src/portal/cajaTributaria.test.tsx`, `src/portal/guarda.test.tsx` y `src/portal/pdf.test.tsx`.

### Caja de tasas y derechos administrativos (`/caja-tasas`)

Cobra tasas y derechos del TUPA al precio de su tarifa vigente, y emite el recibo. Se ofrece con lectura de `tasa`, y
con el mismo par se guarda su ruta. La caja vive en la ruta como en la tributaria (`/caja-tasas?caja=C-01`).

- **Las tasas vigentes**: `GET /api/caja/tasas?vigentes_a=<hoy en Lima>`, con código, descripción, área, partida y
  precio (`Importe`, con su fecha). El buscador filtra esa lista por código o descripción, sin acentos ni mayúsculas:
  no le pregunta nada al backend.
- **Las tasas a cobrar** viven en la pantalla hasta cobrar. «Agregar» pone la tasa con cantidad 1; una que ya está no
  se agrega otra vez, y lo dice. Cada línea muestra lo que dijo `GET /tasas`, la cantidad y el monto, y se quita con
  «Quitar».
  - **La cantidad** se escribe como texto y se valida: un entero de al menos 1, de hasta nueve cifras (el backend la
    lee como `Int`). Una que no lo es se dice bajo su campo y no llega al backend. Nunca va con `kind: 'money'` ni
    `'decimal'`.
  - Es una tabla propia, no el `EditableList` del kit: `EditableList` lee sus filas solo de una consulta
    (`queryKey` + `load`), su «+» abre siempre un formulario que sería otra forma de agregar una tasa sin la lista de
    vigentes, y su confirmación de borrado dice «El historial del registro lo conserva», que es falso para una línea
    que el backend nunca vio. Usarlo así habría pedido cambiar el kit, y el kit no se cambia.
- **El precio, los montos y el total son del backend.** El precio unitario es el de `GET /tasas`; el monto de cada
  línea y el total, los de `POST /api/caja/cobros/tasas/vista-previa`, que se vuelve a pedir al cambiar las líneas o
  una cantidad. El cliente no multiplica ni suma. Una tasa sin tarifa vigente o con tarifa en cero aparece en los
  `motivos`, su monto dice que el backend no la cobra, y el cobro queda impedido.
- **Cobrar**: forma de pago, pagador opcional (documento y nombre: si no se escribe, no se manda) y observación. Se
  confirma con `ConfirmDialog`, con las líneas y el total de la vista previa y el pagador («no se identificó» si no
  hay). `POST /api/caja/cobros/tasas` va con su `Idempotency-Key`, la misma en el reintento.
  - **El botón «Cobrar» nunca está mudo**: sin CREATE de `recibo`, sin caja (o sin las cajas, con su motivo), sin
    tasas, con una cantidad inválida, sin el total o con motivos del backend, dice por qué a su lado.
  - Un 400 se dice bajo su campo, o encima del botón (el de una línea, con su código: «Cantidad de T-001: …»). Un 403,
    el 404 de una tasa sin tarifa vigente y el 409 de una tarifa en cero, con su `detail`.
  - Un 401 guarda la forma de pago, el pagador, la observación y **las líneas como código y cantidad** (nunca un
    precio ni un monto), con la clave `caja-tasas.<caja>`; al volver a entrar con la misma cuenta, todo se rellena.
- **El recibo emitido**, con las piezas de la tributaria: número, emitido en, forma de pago, total, el pagador con el
  que se cobró (el recibo que contesta el backend no lo trae; sin pagador dice «No se identificó al pagador», como el
  PDF) y cada línea con concepto, código, cantidad, precio unitario y monto. «Ver el recibo» abre su PDF.

Tests: `src/portal/cajaTasas.test.tsx`.

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
yarn test            # vitest: admin, login, árbol, guarda de hoja, límite de error, cuenta, temas, kit, cifras, borrador, PDF, caja tributaria, caja de tasas y guardas
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
