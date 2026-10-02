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
    lo dice. Hoy están las seis: Caja tributaria, Caja de tasas y derechos administrativos, Duplicado de recibo, Cierre y
    arqueo de caja, Avance de recaudación y Recaudación por área.
  - Un módulo que se queda sin hojas tampoco se dibuja.
  - **La pantalla se guarda con el mismo `seOfreceCon`** (`GuardaDeHoja`): quien llega por la URL sin permiso lee qué
    le falta («Su cuenta no puede abrir «Caja tributaria»: le falta lectura de orden_de_cobro.»), en vez de una
    pantalla llena de 403. Si los permisos no se pudieron leer, lo dice y no la abre. Test: `src/portal/guarda.test.tsx`.
- **Una hoja que revienta no tumba la raíz**: cada pantalla se dibuja dentro de un límite de error (`LimiteDeHoja`)
  que se reinicia al cambiar la ruta. La barra y el árbol siguen, con la frase del fallo, y otra hoja se dibuja.
- **El estado del árbol** se guarda por pestaña del navegador (`sessionStorage['caja.nav']`).
- **Pestañas de trabajo: todavía no.** La barra de pestañas (`TabBar` y `WorkspaceTabs`, copiadas de srtm-ui) está
  montada, pero ninguna pantalla abre la suya (nadie llama a `useWorkspaceTab`), así que solo muestra «Inicio».
  `sessionStorage['caja.tabs']` no guarda ninguna, y cerrar sesión lo borra.
- **Hueco conocido: salir de una hoja con un acto a medio teclear lo pierde sin avisar.** Ninguna pantalla monta
  `useUnsavedChanges` del kit: lo tecleado en una anulación, un cierre, una reversión, una explicación o un cobro se
  pierde al ir a otra hoja (o a otro recibo, turno o pago). Solo un 401 lo guarda (`useEscritura`, más abajo).
- **Tema**: sistema, claro, oscuro o _Portal tributario_, en el menú de tema de la cabecera.
  - El tema es de `@wasichai/*`: `PORTAL_TRIBUTARIO_THEME` de `@wasichai/core` y la hoja
    `@wasichai/ui/themes/portal-tributario.css`. caja-ui añade los parciales de sus piezas
    (`src/themes/portal-tributario/`). `CAJA_THEMES` (`src/themes`) lo registra en el portal y en el admin.
  - Con _Portal tributario_ cambia también la estructura del portal (barra de marca, árbol plegable, pie):
    `useVarianteTema()` dice `'portal'` o `'clasico'`.
  - La elección se guarda en `caja.theme` y, con un backend que tenga `PUT /auth/me/preferences`, también para el
    usuario. `index.html` aplica el tema antes de cargar la app, para que no parpadee.
- Las piezas copiadas de `srtm-ui@a1df33a` (shell, login, temas, `Alerta`, `BandaTitulo`, `KitDelPortal`) llevan
  arriba la cabecera «copiado de srtm-ui…»: suben a wasichai-ui en la fase 2 (wasichai-ui#14). Las que se reescribieron
  dicen además en qué divergen («adaptado: diverge de srtm-ui en …»: `api.ts`, `shell/navTree.ts`, `PortalApp.tsx`,
  `shell/AppShell.tsx`, `shell/comun.tsx` y `shell/Breadcrumbs.tsx`; `PdfDialog.tsx` con su «DIVERGE»), para no
  tomarlas por la copia de srtm al unir las dos.
- **Las etiquetas de los enums** de caja-backend (`forma_pago`, `estado_orden`, `estado_recibo`, `tipo_pago`,
  `tipo_evento_pago`, `estado_evento`, `estado_del_turno` y el `origen` del avance) están en `src/portal/forms/etiquetas.ts`, porque wasichai todavía no las tiene. Un valor que no
  conoce se escribe tal cual.

El admin (`src/admin`) no cambia: sus pantallas salen de lo que caja-backend carga en Core. El enlace
"Administración" del portal solo aparece para ADMIN.

## Pantallas de Tesorería (`src/portal/cobro`, `src/portal/tasas`, `src/portal/recibo`, `src/portal/turno`, `src/portal/buzon`, `src/portal/recaudacion`)

Las dos cajas comparten sus piezas, que viven en `src/portal/cobro`:

- `ElegirCaja.tsx`: la caja elegida en la ruta (`useCajaDeLaRuta`), solo las activas, y por qué no hay caja.
- `Formulario.tsx`: la forma de pago, la observación, el total de la vista previa con sus motivos, el botón «Cobrar»
  que dice por qué no puede y la confirmación.
- `envio.ts`: la validación común y `useEnvioDelCobro` (la `Idempotency-Key` de `intento.ts`, el borrador de
  `useEscritura` ante un 401, y el 400 bajo su campo o encima del botón).
- `ReciboEmitido.tsx`: el recibo emitido y su PDF, y cómo se lee una línea de órdenes (`LINEA_DE_ORDEN`) y una de
  tasas (`LINEA_DE_TASA`), que también usa la ficha de «Duplicado de recibo».

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
  - **Un cobro sin respuesta puede haberse cobrado.** Si la red falla, la respuesta no se puede leer, o contesta un 5xx
    o un 408, el formulario dice «No se sabe si se cobró: vuelva a pulsar Cobrar sin cambiar nada (se reconoce el mismo
    intento), o busque el recibo en Duplicado de recibo.», con lo que pasó. **Mientras lo dice, todo cobro sale con la
    `Idempotency-Key` de ese intento, aunque se cambie algo** (lo marcado, las líneas, un campo): caja-backend contesta
    una clave que ya nombra un recibo con ese recibo (200, `emitido: false`), sea cual sea el cuerpo. Así el primero
    nunca se cobra dos veces, y si no se cobró, lo que está en pantalla se cobra una vez. No se bloquea la edición: no se
    pierde lo tecleado, y una clave fija no deja ningún cambio que pueda cobrar otra vez. Solo un cobro contestado (2xx)
    resuelve la duda; un 400 de un intento posterior no dice nada del primero, y el aviso sigue. «Ya lo revisé: es un
    cobro nuevo» suelta la clave a propósito, para cuando en Duplicado de recibo se vio que no se cobró, o que se anuló
    (la clave de un recibo anulado el backend ya no la acepta). Hueco conocido: la clave vive en el cobro en pantalla;
    cambiar de caja o de pagador, salir de la hoja, recargar o un 401 la pierden, y por eso el aviso remite a Duplicado
    de recibo. Lo comparten las dos cajas (`cobro/envio.ts`).
  - **El botón «Cobrar» nunca está mudo**: si no se puede (sin CREATE de `recibo` o UPDATE de `orden_de_cobro`, sin
    caja, sin nada marcado, sin el total, o con motivos del backend) dice por qué a su lado. Si las cajas no se
    pudieron leer (un 403, un error), dice eso con su motivo, no «Elija la caja».
  - Un 400 se dice bajo su campo, o encima del botón si el formulario no tiene ese campo. Un 403, 404 o 409, con su
    `detail`.
  - Un 401 guarda la forma de pago y la observación con `useEscritura`, con la clave `caja-tributaria.<caja>.<documento>`,
    y al volver a entrar con la misma cuenta el formulario se rellena.
- **El recibo emitido**: número, emitido en (hora de Lima), forma de pago, total, pagador y líneas, en `FieldGrid` con
  el `kind` `importe`. El pagador es el que guardó el backend (`recibo.pagador_*`: el documento recortado y en
  mayúsculas), nunca el tecleado; sin pagador dice «No se identificó al pagador», como el PDF. Si fue el reenvío de un intento ya cobrado (200, `emitido: false`), lo dice. «Ver el recibo» abre
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
  `motivos`, su monto dice que el backend no la cobra, y el cobro queda impedido. Mientras una cantidad es inválida no
  se pide la vista previa, y el total no desaparece: lo sustituye `SinDato` con «Corrija las cantidades para ver el
  total».
- **Cobrar**: forma de pago, pagador opcional (documento y nombre: si no se escribe, no se manda) y observación. Se
  confirma con `ConfirmDialog`, con las líneas y el total de la vista previa y el pagador («no se identificó» si no
  hay). `POST /api/caja/cobros/tasas` va con su `Idempotency-Key`, la misma en el reintento, y la misma mientras no se
  sabe si un intento se cobró, aunque cambien las líneas (como en la tributaria: aquí una clave nueva emitiría un segundo
  recibo).
  - **El botón «Cobrar» nunca está mudo**: sin CREATE de `recibo`, sin caja (o sin las cajas, con su motivo), sin
    tasas, con una cantidad inválida, sin el total o con motivos del backend, dice por qué a su lado.
  - Un 400 se dice bajo su campo, o encima del botón (el de una línea, con su código: «Cantidad de T-001: …»). Un 403,
    el 404 de una tasa sin tarifa vigente y el 409 de una tarifa en cero, con su `detail`.
  - Un 401 guarda la forma de pago, el pagador, la observación y **las líneas como código y cantidad** (nunca un
    precio ni un monto), con la clave `caja-tasas.<caja>`; al volver a entrar con la misma cuenta, todo se rellena. El
    cobro se vuelve a montar al cambiar de caja (`key`), como el tributario: el borrador que lee es el de la caja
    elegida, no el de la anterior.
- **El recibo emitido**, con las piezas de la tributaria: número, emitido en, forma de pago, total, el pagador tal como
  lo guardó el backend (`recibo.pagador_*`; un recibo anónimo dice «No se identificó al pagador», como el PDF) y cada
  línea con concepto, código, cantidad, precio unitario y monto. «Ver el recibo» abre su PDF.

Tests: `src/portal/cajaTasas.test.tsx`.

### Duplicado de recibo (`/duplicado-recibo`)

Busca los recibos emitidos, muestra el elegido, entrega su duplicado en PDF y lo **anula donde está** (caja ADR-0044).
Se ofrece con lectura de `recibo` **o** con creación de `anulacion_recibo` (lo que ya decía el árbol), y con lo mismo se
guarda su ruta.

- **El recibo elegido viaja en la ruta**, y los filtros en la query:
  `/duplicado-recibo/001-0000123?documento=12345678&estado=EMITIDO`. Recargar o pasar el enlace muestra el mismo recibo
  con la misma lista. La hoja lo declara con `conSujeto` (`navTree.ts`), y su ruta es `/duplicado-recibo/:sujeto?`.
- **La lista**: `GET /api/caja/recibos` con los filtros de documento, caja, cajero (el correo), desde, hasta (días de
  Lima) y estado, y la página con `PageSizePagination` (`page` y `size` en la URL, 25 por defecto). Columnas: número,
  emitido (hora de Lima), documento, pagador, importe (`Importe`; si todas las cifras son del mismo día, la fecha va una
  vez en la cabecera con `FechaDeLasCifras`), medio de pago, duplicados y estado, con su etiqueta. «Ver» lleva a la ruta
  del recibo, sin perder los filtros. Un 400 se dice bajo su filtro; cualquier otro fallo (un 403) se dice en el hueco
  de la lista, y la ficha sigue.
- **El recibo elegido**: `GET /api/caja/recibos/{numero}`, en `FieldGrid`: número, estado, caja, cajero, emitido en,
  forma y tipo de pago, pagador, duplicados emitidos, total (`kind: 'importe'`) y la observación del cobro; sus líneas
  como las lee su tipo (órdenes o tasas, con código, cantidad y precio unitario); y, si está anulado, la anulación:
  fecha, motivo, quién la autorizó, el memorando y quién la hizo.
- **Duplicado en PDF** (solo PDF): pedir un duplicado **escribe**, porque registra la reimpresión. Por eso nunca se pide
  al abrir la ficha: el botón abre un formulario que pide la observación (de 5 a 500), y solo entonces va
  `POST /api/caja/recibos/{numero}/duplicados` (`blob`, con el cuerpo en JSON). El PDF que contestó se abre en
  `PdfDialog` sin volver a pedirlo (su `load` opcional, que diverge de la copia de srtm-ui y lo anota en su cabecera), y la ficha se vuelve a leer (sus duplicados). Un 409 dice que el recibo ya no se
  dibuja igual que en su reimpresión anterior y que no se entregó ni se registró nada; un 400, bajo la observación; un
  403, con su `detail`. Un 401 guarda la observación con la clave `duplicado.<numero>`.
- **Anular** es un acto con `RecordForm`: motivo (obligatorio, hasta 80: el sustento del acto, que se imprime en el
  duplicado), autorizado por (hasta 80), N.° de memorando (hasta 40) y observación (de 5 a 500, para la bitácora).
  Antes de enviar se confirma con `ConfirmDialog`, que nombra el recibo, el pagador, el total y el motivo, porque no se
  deshace. Luego `POST /api/caja/recibos/{numero}/anulacion`, con el número de la ruta y nunca uno tecleado; lo opcional
  solo va si se escribió.
  - Con éxito se dice «El recibo … quedó anulado.», y la ficha y la lista se vuelven a leer: el estado y la anulación son
    los que contesta el backend. No se calcula nada.
  - Un 400 se dice bajo su campo. El 403 (de otro cajero), el 409 (ya anulado) y el 422 (fuera del día), con su
    `detail`. Tras un 409 la ficha se vuelve a leer: si otro lo anuló entretanto, «Anular» deja de estar pulsable y dice
    por qué.
  - Un 401 guarda los cuatro campos con `useEscritura`, con la clave **`anulacion.<numero>`**: al volver a entrar con la
    misma cuenta, el acto de **ese** recibo se abre relleno, y el de otro recibo no lo ve. Cancelar el acto lo olvida.
- **Ningún botón mudo.** «Anular» y «Duplicado en PDF» dicen a su lado por qué no pueden, y gana el primer motivo, en el
  orden en que se arreglan (`recibo/impedimentos.ts`):
  - «Anular»: sin creación de `anulacion_recibo`; con ella pero sin poder leer el recibo (nombra las lecturas que faltan
    de `recibo`, `linea_recibo`, `caja`, `tasa`, `anulacion_recibo` y `reimpresion_recibo`); sin recibo elegido; si el
    recibo no se pudo leer; si ya se anuló (con su fecha); si no se emitió hoy en Lima (corresponde una devolución; el
    backend mira el día de su turno, y su 422 también se dice); y si lo cobró otro cajero y la cuenta no tiene el rol
    `SUPERVISOR_CAJA` (ni es ADMIN): el privilegio ESPECIAL. Los roles y el correo son los de la cuenta que dice
    wasichai (`useAuth`), nunca inventados.
  - «Duplicado en PDF»: sin creación de `reimpresion_recibo`; sin recibo elegido; si el recibo no se pudo leer.

**ADR-0044 tal como se cumple aquí** — «Lo que ve quien sólo puede anular», con los permisos de caja-backend:

| Lo que tiene la cuenta                                                     | Lo que ve                                                                                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lectura del recibo y lo que lee su ficha, y creación de `anulacion_recibo` | La hoja, su lista, la ficha del recibo que elija y «Anular» **pulsable**. «Duplicado en PDF» impedido: le falta creación de `reimpresion_recibo` |
| Solo creación de `anulacion_recibo`                                        | La misma hoja. La lista contesta 403 y se dice en su hueco; «Anular» sale **impedido** y nombra las lecturas que pedir                           |
| Solo lectura (`recibo` y lo que lee su ficha)                              | La hoja entera, y «Anular» impedido: le falta creación de `anulacion_recibo`                                                                     |
| Ninguna de las dos                                                         | La hoja no se ofrece, y su URL dice qué le falta a la cuenta (`GuardaDeHoja`)                                                                    |

Tests: `src/portal/duplicadoRecibo.test.tsx` (una prueba por fila de la tabla y una por motivo de cada botón impedido).

### Cierre y arqueo de caja (`/cierre-caja`)

El turno del día del cajero, su arqueo por forma de pago, el cierre con lo que contó y su reversión. Se ofrece con
lectura de `turno` (lo que ya decía el árbol), y con lo mismo se guarda su ruta. Debajo del arqueo, el bloque **«Pagos
sin entregar»** y su explicación (más abajo), y al final la **«Conciliación del día»** (más abajo).

- **El turno del día**: `GET /api/caja/turnos/del-dia` (el cajero de la sesión, hoy en Lima; no abre ningún turno). La
  situación se dice en palabras: `SIN_ABRIR` (el turno se abre con el primer cobro), `ABIERTO`, `CERRADO` (para seguir
  cobrando no se abre otro: se reversa) o `VARIOS_ABIERTOS` (abierto en más de una caja: hay que elegir). Debajo, sus
  turnos con la caja (código y nombre), cuándo se abrió (hora de Lima) y su estado, cada uno con «Arquear».
- **El turno elegido vive en la ruta**: `/cierre-caja?turno=<turno_id>`. Con un solo turno se toma ese; con varios y
  ninguno en la ruta, se pide elegir; uno de la ruta que no es de hoy se dice y no se elige. Recargar o pasar el enlace
  muestra el mismo.
- **El arqueo lo calcula el backend**: `GET /api/caja/turnos/{turno_id}/arqueo`. Una tabla por forma de pago (con su
  `etiqueta`) con cobrado, anulado, neto, declarado y diferencia, y la fila del total; cada cifra es un `Importe`, con
  la fecha una vez en el título de la tabla si todas la comparten. El arqueo en vivo trae lo declarado, la diferencia
  y si cuadra en null para cualquier turno, y lo que se dice depende de su estado, nunca un 0: con el turno abierto
  nadie ha contado, y dicen **«sin declarar»** (`SinDato`), que el backend los da al cerrar; con el turno cerrado, que el
  arqueo en vivo no guarda lo declarado, que quedó en el acta del cierre (`porQueSinDeclarar` en `turno/Arqueo.tsx`). Además: los recibos emitidos y anulados, lo cobrado con
  evento y sin evento, el estado del turno y, si los hay, los **pagos sin entregar** (`lo_que_impide_cerrar`) uno a
  uno, con su `pago_id`, su tipo y su estado (`PENDIENTE` o `MUERTO`); los que no se pudieron entregar se explican en el
  bloque «Pagos sin entregar».
- **Cerrar** (`turno/CerrarElTurno.tsx`): lo declarado por forma de pago, las cinco, **como texto**: sin signo, con
  punto y a lo sumo 2 decimales y 13 enteros, validado como texto y enviado tal cual se tecleó (recortado), nunca como
  `Number` ni con los `kind` `money` o `decimal` del kit. Lo que se deja en blanco no se envía, y el backend lo cierra
  en cero: el formulario y la confirmación lo dicen, y un campo vacío dice «en blanco: cero», nunca «sin declarar». Por
  eso **las formas de pago con movimiento en el arqueo en vivo piden un valor explícito**, aunque sea `0`: un EFECTIVO
  olvidado no se cierra en silencio como `-neto`. Observación de 5 a 500. Se confirma con `ConfirmDialog` y va
  `POST /api/caja/turnos/cierre` con la caja y la fecha del turno.
  - **La diferencia no la calcula el cliente**: antes de cerrar se dice que la da el backend; después se muestra el
    acta que contestó (secuencia, registrado el, por quién, observación, si cuadra, lo cobrado con y sin evento, y su
    arqueo con lo declarado y la diferencia). Un descuadre no impide cerrar: queda en el acta.
  - Después, el turno del día y el arqueo se vuelven a leer: el estado es el del backend, nunca se cambia aquí.
- **El acta del cierre vigente**: con el turno cerrado, el arqueo trae `cierre_vigente`, el acta del último cierre
  vigente tal como se guardó (a la fecha del turno). La hoja la muestra con el título «Acta del cierre vigente del …»:
  secuencia, registrado el, por quién, observación, lo cobrado con y sin evento, si cuadra y su arqueo con lo declarado
  y la diferencia. **También después de recargar**, sin recalcular ni restar nada. Con el turno abierto (también después
  de reversar) viene en null y no hay acta. Tras cerrar aquí se ve una sola acta: la de la respuesta del cierre, hasta que
  el arqueo releído trae la vigente. Tras reversar, el acta del cierre que el backend dijo reversado (`cierre_revertido`) no se
  muestra más, ni siquiera mientras se relee el arqueo de antes.
  - Un 400 de `declarado` se dice bajo «Lo declarado», el de `observacion` bajo su campo, y otro (`caja`, `fecha`)
    encima del botón. Un 409 («ya está cerrado», «Hay pagos sin entregar», un choque) se dice con su `detail` y vuelve a
    leer el turno y el arqueo, que lista los pagos. Si el arqueo releído trae alguno `MUERTO`, el aviso del 409 lleva un
    enlace, «Ir a los pagos sin entregar», que pone el foco en el bloque. Un 403 y un 404, con su `detail`.
  - Un 401 guarda lo declarado y la observación con `useEscritura`, con la clave **`cierre.<turno_id>`**: al volver a
    entrar con la misma cuenta, el cierre de **ese** turno se rellena, y el de otro turno no lo ve.
- **Reversar** (`turno/ReversarElCierre.tsx`): motivo (obligatorio, hasta 80) y observación (de 5 a 500), confirmación y
  `POST /api/caja/turnos/reversion`. **Solo se reversa el cierre del propio turno**, desde la cuenta del cajero que lo
  cerró y con creación de `reversion_cierre`: el backend da 403 a la reversión del turno de otro, también a un
  supervisor, así que la pantalla nunca remite a otra cuenta. El cierre no se borra: se agrega la reversión y el turno se vuelve a abrir. Que
  vuelva a `ABIERTO` se ve porque el turno se relee; si el backend dijera otra cosa, la pantalla diría lo que dice el
  backend. Errores como en el cierre; un 401 guarda el borrador con la clave `reversion.<turno_id>`.
- **Ningún botón mudo** (`turno/impedimentos.ts`, `components/BotonConMotivo.tsx`). Gana el primer motivo, en el orden
  en que se arreglan:
  - «Cerrar el turno»: sin creación de `cierre_turno` y `cierre_turno_linea`; el turno del día no se pudo leer; hoy no
    hay turno; no se eligió ninguno; el backend no mandó su caja; el arqueo no se pudo leer; ya está cerrado; hay pagos
    sin entregar; el backend dice que no se puede cerrar (`puede_cerrar`) sin otro motivo.
  - «Reversar el cierre»: sin creación de `reversion_cierre` (un CAJERO: el cierre solo se reversa desde la cuenta del
    cajero del turno, y otra cuenta no puede hacerlo por él); el turno del
    día no se pudo leer; hoy no hay turno; no se eligió ninguno; el backend no mandó su caja; el turno está abierto.

Tests: `src/portal/cierreCaja.test.tsx` (una prueba por situación y una por motivo de cada botón impedido).

#### Pagos sin entregar (en la hoja `cierre-caja`, `src/portal/buzon`)

Un pago que agotó sus reintentos (`MUERTO`) impide cerrar su turno. Quien tiene el permiso lo **explica**, y entonces
el turno cierra. Es el bloque «Pagos pendientes de entrega» de caja-web, dentro de «Cierre y arqueo de caja».

- **La lista**: `GET /api/caja/pagos/sin-entregar` (una lista, no una página: los `MUERTO`, del más antiguo al más
  reciente). Una tabla con pago, turno, tipo (`etiqueta`), destino, recibo, intentos, último error, creado (hora de
  Lima) y estado (`etiqueta`). La lista trae los de todos los turnos: el turno de cada fila se nombra por su caja y su
  día si es uno de los del cajero de hoy (el que va a cerrar, marcado), o por su id si no; y **los del turno que va a
  cerrar van primero**, en el orden del backend, igual que los demás. Lo que falta dice por qué (`SinDato`): el recibo que no se pudo leer, un error que no se
  registró. Sin pagos: «No hay pagos sin entregar». Los `PENDIENTE` no salen aquí: se entregan solos, y el arqueo los
  nombra. Un 403 (sin lectura de `pago_evento` o `recibo`) se dice en el hueco del bloque, y la hoja sigue.
- **Explicar** (`buzon/ExplicarElPago.tsx`): la explicación (qué pasó y qué se hizo, de 5 a 500, con su cuenta de
  caracteres: una más larga nunca se corta, se dice por qué no se envía; queda en el evento) y
  la observación (de 5 a 500; queda en la auditoría). Se confirma con `ConfirmDialog`, porque no se deshace, y va
  `POST /api/caja/pagos/{pago_id}/explicacion` con el `pago_id` de la fila, nunca uno tecleado.
  - **El estado no se cambia en el cliente**: con éxito se dice lo que contestó el backend («Se explicó el pago …: el
    backend lo dejó «Explicado».»), y se vuelven a leer los pagos **y** el arqueo, para que «puede cerrar» lo diga el
    backend. Si el backend lo siguiera listando, la pantalla lo seguiría mostrando.
  - Un 400 se dice bajo su campo (`explicacion`, `observacion`), y otro (`pago_id`) encima del botón. El 409 (ya no está
    `MUERTO`: se entregó o alguien ya lo explicó) se dice con su `detail` en el bloque, no en el acto, porque al releer
    el pago sale de la lista y el acto con él; luego relee los pagos y el arqueo. Un 403 y un
    404, con su `detail`.
  - Un 401 guarda la explicación y la observación con `useEscritura`, con la clave **`explicacion.<pago_id>`**: al
    volver a entrar con la misma cuenta, el acto de **ese** pago se abre relleno, y el de otro pago no lo ve. Cancelar
    lo olvida.
- **Ningún botón mudo** (`buzon/impedimentos.ts`). «Explicar» dice por qué no puede: sin modificación de `pago_evento`
  (solo la tiene `SUPERVISOR_CAJA`) o sin lectura de `recibo`, una vez encima de la tabla y como descripción de cada
  botón; y, a su lado, si el pago no está `MUERTO`.

Tests: `src/portal/pagosSinEntregar.test.tsx` (la lista con su turno, los del turno que va a cerrar primero, sin pagos,
el 403, explicar y releer, el estado que no se cambia aquí, cada error, el 409 que sobrevive a la relectura, la
explicación de más de 500 que no se corta, el borrador por pago, una prueba por motivo de «Explicar» y el enlace desde el 409 del cierre).

#### Conciliación del día (en la hoja `cierre-caja`, `src/portal/recaudacion`)

Lo cobrado en ventanilla contra lo que cada sistema de origen dice haber aplicado, un día. Son los bloques
«Conciliación del día» y «El cuadre del día» de caja-web, al final de «Cierre y arqueo de caja».

- **El día lo elige quien concilia y vive en la ruta**: `/cierre-caja?turno=…&fecha=2026-10-02`. El selector de día y
  «Conciliar» escriben `?fecha=` sin tocar el turno elegido (y elegir un turno no borra el día). Recargar o pasar el
  enlace muestra la misma conciliación. **No hay «hoy» por omisión**: sin día, el bloque dice «Elija arriba el día que
  quiere conciliar y aquí saldrá su cuadre.», no pide nada y no muestra ninguna cifra (**ni un cero antes de tiempo**).
- **`GET /api/caja/conciliacion?fecha=`**. El cuadre del día: el día conciliado, el día en que se leyó (`a_la_fecha`) y
  si cuadra (todas las líneas), como lo dice el backend. Una tabla «Por sistema de origen» con registrados, anulados,
  en tránsito, sin entregar (`muertos`), explicados, cobrado, anulado y neto (del buzón y los recibos), recibidos,
  aplicados y rechazados en el origen, importe aplicado y diferencia (del origen), si cuadra y la situación. Las cifras
  van a la fecha conciliada, una vez en el título de la tabla. **La diferencia es la del backend**: el cliente no resta.
- **Un origen que no contestó, que no se pudo leer o que no está configurado** trae sus cinco cifras en null: cada una
  de esas celdas dice `por_que_no_se_sabe` con `SinDato`, **nunca 0**, y la situación dice «No se sabe: …». Una línea
  que no cuadra dice por qué con lo que manda el backend (en tránsito, sin entregar, rechazados, con diferencia).
- Un día sin cobros: «Ese día no tiene ningún cobro registrado.», y el día cuadra.
- **Una fecha mal escrita es el 400 que es**: su `errors[].message` se dice bajo el selector y el bloque dice que el
  backend no aceptó ese día. Un 403 (sin lectura de `pago_evento` o `recibo`) se dice en el hueco del bloque, y la hoja
  sigue.

Tests: `src/portal/conciliacion.test.tsx` (sin día espera y no muestra ningún cero, el día en la ruta junto al turno y al
recargar, el origen caído y el no configurado celda por celda, la situación, la diferencia del backend, el día sin
cobros, el 400 y el 403).

### Avance de recaudación (`/avance-recaudacion`)

Lo recaudado en un rango de días del turno, por sistema de origen. Se ofrece con lectura de `recibo` y de `linea_recibo`,
**la misma compuerta que exige caja-backend** (`ConsultaDeRecaudacion`), y con lo mismo se guarda su ruta: una cuenta a
la que le falta una no abre una pantalla llena de 403, lee qué le falta. El 403 que core da al leer (por ejemplo, sin
lectura de `turno` o `anulacion_recibo`, que no son de la compuerta) se dice en el hueco de la recaudación.

- **Los filtros viven en la ruta**: `/avance-recaudacion?desde=2026-10-01&hasta=2026-10-02&origen=rentas&caja=C-01&cajero=…`.
  «Consultar» los escribe (los vacíos no van) y recargar o pasar el enlace pide lo mismo. Sin rango, el backend pone el
  suyo (sin `hasta`, hoy; sin `desde`, el 1 de enero de ese año) y la pantalla dice el que contestó: no lo calcula.
- **`GET /api/caja/recaudacion/avance`** (no pagina: es un agregado). Desde, hasta y a la fecha; una tabla «Por origen»
  con el origen (`TASA` con su etiqueta, los demás por su nombre; uno que el backend no mandó lo dice), cobrado, anulado
  y neto, y la fila del total, que es **la del backend**: el cliente no suma. Todas las cifras van a `a_la_fecha`, una
  vez en el título de la tabla. Sin cobros: «No se cobró nada en el periodo.», con los totales en cero que manda el
  backend (un cero de verdad).
- **El turno en vivo de hoy**: con `caja` **y** `cajero`, el backend manda su turno de hoy, y la pantalla muestra su
  estado, sus recibos y su arqueo en vivo con `TablaDeArqueo`: lo declarado, la diferencia y si cuadra dicen «sin
  declarar», nunca 0. Su 404 (ese cajero no abrió turno hoy en esa caja) se dice con su `detail`.
- Un 400 se dice bajo su filtro (`desde`, `hasta`); un 403 o un 404, en el hueco de la recaudación.

Tests: `src/portal/avanceRecaudacion.test.tsx`.

### Recaudación por área (`/recaudacion-area`)

Lo recaudado en un rango por área, partida y concepto. Se ofrece con lectura de `recibo`, `linea_recibo`, `area` y
`tasa`, **la misma compuerta que exige caja-backend**, y con lo mismo se guarda su ruta. El 403 que core da al leer se
dice en el hueco de la recaudación.

- **El área y el rango viven en la ruta**: `/recaudacion-area?area=A-113300&desde=2026-10-01&hasta=2026-10-02`. El área
  se escribe por su código (el backend también acepta la etiqueta «COD — nombre»): no hay desplegable con áreas
  inventadas.
- **`GET /api/caja/recaudacion/por-area`** (no pagina). Desde, hasta, a la fecha, el neto y el **neto sin partida**; una
  tabla «Por área y partida» con área (código y nombre), partida, concepto, cobrado, anulado y neto, y al pie el neto y
  el neto sin partida, **los del backend**. El backend no manda un total de lo cobrado ni de lo anulado, y la pantalla
  no lo inventa.
- **Lo cobrado por órdenes no tiene área ni partida** (`area`, `area_nombre` y `partida` en null: el dato no existe).
  Su fila lo dice en esas celdas («cobrado por órdenes: no tiene área»), con su sistema de origen como concepto, y la
  hoja dice que **se cuenta aparte, en el neto sin partida, y no se reparte entre las áreas**. No se esconde ni se
  rellena.
- **Con un área elegida**, el backend cuenta solo las tasas de esa área y manda `neto_sin_partida` en `"0.00"`: la hoja
  cambia esa frase por otra que dice que lo cobrado por órdenes queda fuera de la consulta y que por eso el neto sin
  partida es cero, para que el cero no se lea como «no se cobró nada por órdenes».
- Un 400 se dice bajo su filtro; un 403, en el hueco de la recaudación.

Tests: `src/portal/recaudacionArea.test.tsx`.

## El kit de formularios (`src/kit`)

Es una **copia temporal y marcada** del kit de `srtm-ui@a1df33a`: `RecordForm`, `FieldGrid`, `EditableList`,
`useUnsavedChanges`, `errorMessage` y lo que los configura (`KitProvider`). Cada archivo lleva la cabecera de la copia.
caja-ui es el segundo usuario que el kit necesita para subir a wasichai-ui en la fase 2 (wasichai-ui#14), **pero solo
de lo que usa**: `RecordForm` (la anulación), `FieldGrid` (el recibo emitido y el elegido, con `displayKinds`),
`NativeSelect`, `errorMessage`, `format.ts` y `KitProvider`. `EditableList` y `useUnsavedChanges` se copiaron y no
los usa ninguna pantalla: no cuentan como segundo usuario. Vive tras
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
- **Volver a buscar pregunta otra vez.** «Buscar» (Caja tributaria y Duplicado de recibo), «Consultar» (Avance de
  recaudación y Recaudación por área) y «Conciliar» con lo mismo que ya dice la ruta vuelven a pedirlo al backend: la
  misma URL es la misma consulta, y sin esto el botón no haría nada. Tests: uno por pantalla («… pressed with the same
  …»).

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
yarn test            # vitest: admin, login, árbol, guarda de hoja, límite de error, cuenta, temas, kit, cifras, borrador, PDF, caja tributaria, caja de tasas, duplicado de recibo, cierre y arqueo, pagos sin entregar, conciliación, avance, recaudación por área y guardas
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
