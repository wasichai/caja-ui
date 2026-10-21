# Órdenes retiradas y pagos a cuenta en el portal: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el cajero no cobre una orden que el sistema de origen retiró, y que el supervisor vea en el cierre y en la conciliación los pagos que el origen recibió a cuenta.

**Architecture:** tres cambios en el portal, uno por pantalla:
- en Caja tributaria, la orden retirada y la que reemplaza a otra (#27);
- en Cierre y arqueo y en la conciliación, los pagos a cuenta y los cobros sin verificar (#28);
- una consulta nueva de las órdenes retiradas (#28).

Se usan los campos y las rutas del plan de caja-backend `docs/superpowers/plans/2026-10-22-ordenes-que-cambian-en-el-origen.md`.

**Tech Stack:** React, TypeScript, @tanstack/react-query, @wasichai/core y @wasichai/ui, y vitest con testing-library y `mockFetch` de @wasichai/testing.

**Spec:** caja-ui #27 y #28, más el plan de caja-backend citado, que define los contratos.

## Global Constraints

- **Textos:** en castellano, de usted. Un botón deshabilitado dice por qué. Un valor que falta es `<SinDato motivo=…/>`, nunca un 0. El `detail` del backend se muestra tal cual con `errorMessage`.
- **Importes:** son `Cifra`, cadenas. Nada de `parseFloat`, `toFixed` ni `Number(`: lo vigila `src/garantias.test.tsx`.
- **Tipos:** se escriben a mano en `src/portal/types.ts`, en snake_case. Cada interfaz lleva un comentario con su ruta.
- **Pantalla nueva:** va en `ClaveDeHoja`, `NAV_TREE` y `PANTALLAS`, y se documenta en el README.
- **Commits:** `tipo(alcance): asunto en minúsculas`, de hasta 120 caracteres. El alcance es `cobro`, `cierre` o `portal`.
- **CI:** `yarn lint`, `yarn typecheck`, `yarn test` y `yarn build`. `yarn install` necesita `NODE_AUTH_TOKEN` con lectura de `@wasichai/*`.
- **Nombres de los tests:** en inglés, como los demás.

## Review Focus

1. **Una orden retirada entre la búsqueda y la confirmación.** El cajero ya abrió el diálogo de confirmar cuando la orden pasa a ANULADA. El backend responde 422. Se esperan dos cosas: el mensaje del backend y el botón «Volver a buscar», sin perder el recibo de un cobro anterior. Lo cubre el Task 1, Step 1.
2. **Volver a la pestaña con una orden marcada que ya no está pendiente.** Se desmarca y se avisa una sola vez, no en cada refresco. Lo cubre el Task 1, Step 1.
3. **La conciliación de un origen viejo**, sin `recibidos_a_cuenta`: los campos llegan `null` o faltan. La columna muestra `SinDato` y no rompe la línea. Lo cubre el Task 2, Step 1.
4. **Un supervisor sin lectura de `pago_evento`.** La sección de pagos a cuenta del cierre dice qué le falta, en lugar de fallar. Lo cubre el Task 2, Step 1.
5. **Una lista de retiradas sin filtro de fecha**, en una caja con muchas. Se pagina con `TAMANO_DE_PAGINA` y la fecha del día por defecto. Lo cubre el Task 3, Step 1.

---

### Task 1: Caja tributaria y la orden retirada (#27)

**Files:**
- Modify:
  - `src/portal/types.ts:36-49`: `OrdenDeCobro.sustituye_a: string | null`, `motivo_retiro: string | null` y `retirada_en: string | null`;
  - `src/portal/cobro/OrdenesPendientes.tsx:54-87,141`;
  - `src/portal/cobro/Cobro.tsx:57-79`;
  - `src/portal/cobro/envio.ts:50-115`;
  - `src/portal/cobro/Formulario.tsx:47-91`;
  - `src/portal/cobro/api.ts`: `cobro.orden(referencia)` no hace falta. Se vuelven a leer las pendientes y se compara.
  - `README.md`, en la sección Caja tributaria.
- Test: `src/portal/cajaTributaria.test.tsx`.

**Interfaces:**
- Consumes del backend (Task 1 y Task 2 de caja-backend):
  - el cobro de una ANULADA responde **422**;
  - `OrdenDeCobro.sustituye_a`;
  - la lista de pendientes ya no trae las ANULADAS.
- Produces:
  - `useEnvioDelCobro` devuelve, además, `retirada: boolean`, verdadero cuando el rechazo fue un 422;
  - `Cobro` recibe `releer: () => Promise<string[]>` y `volverABuscar: () => void`. `releer` devuelve los `orden_id` que siguen pendientes.

- [ ] **Step 1: Write the failing tests** in `cajaTributaria.test.tsx`, con un `describe('withdrawn orders')`:
  - `rereads the pending orders before showing the total, and unmarks a withdrawn one with a warning`:
    - se marcan dos;
    - `rutaDe('GET','/caja/ordenes-de-cobro').body` deja solo una;
    - se pulsa Cobrar;
    - se espera `findByText('La orden RENTAS-2 fue retirada por el sistema de origen.')`, y la casilla de RENTAS-2 ya no está.
  - `says the 422 of the cobro with its detail and offers «Volver a buscar»`:
    - con `{status:422, detail:'… el sistema que la emitió la retiró …'}`, el alert contiene el `detail`;
    - el botón «Volver a buscar» vuelve a pedir `GET /caja/ordenes-de-cobro`.
  - `refetches on window focus on this screen`: con `fireEvent.focus(window)`, se espera una segunda llamada a la lista.
  - `warns once, not on every refetch`: se pide el foco dos veces y hay un solo aviso.
  - `labels «reemplaza a» an order that substitutes another`: con `sustituye_a: 'RENTAS-1-v1'`, se espera el texto «reemplaza a RENTAS-1-v1» en la celda Referencia.

- [ ] **Step 2: Run** `yarn test src/portal/cajaTributaria.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`OrdenesPendientes`:**
    - `refetchOnWindowFocus: true` solo en su `useQuery`;
    - un efecto compara `marcadas` con las filas. Las que faltan se quitan de `marcadas` y se anotan en un estado `retiradas: string[]`, con las referencias, que se muestra como un `Alert tone="warning"` y se limpia al marcar otra.
  - **`releer`:** es `queryClient.fetchQuery({queryKey:['caja','ordenes',documento], staleTime:0})`. `Cobro.pedir` lo llama antes de abrir la confirmación, y si falta alguna, no abre.
  - **El 422:** `envio.ts` lo trata como `general` con `retirada: true`. `PieDelCobro` muestra el botón «Volver a buscar», que llama `volverABuscar`: invalida la lista y limpia las marcas.

- [ ] **Step 4: Run** `yarn test && yarn typecheck && yarn lint`. Expected: PASS.

- [ ] **Step 5: README y commit.** En el README, el comportamiento y los tests nuevos. Commit: `git commit -m "feat(cobro): avisar y desmarcar la orden que el sistema de origen retiró"`.

### Task 2: pagos a cuenta en el cierre y en la conciliación (#28)

**Files:**
- Modify:
  - `src/portal/types.ts:423-440`: `LineaDeConciliacion.recibidos_a_cuenta: number | null` e `importe_a_cuenta: Cifra | null`. Además, `PagoACuenta {pago_id, recibo, sistema_destino, total: Cifra, motivo_a_cuenta, entregado_en}` y `CobroSinVerificar {recibo, sistema, advertencia_origen, emitido_en}`.
  - `src/portal/recaudacion/ConciliacionDelDia.tsx:28-39,158-206`: la columna «A cuenta». `situacion` no la cuenta como motivo de no cuadre.
  - `src/portal/buzon/api.ts`: `pagos.aCuenta(fecha)`, que es `GET /caja/pagos/a-cuenta?fecha=`.
  - `src/portal/cobro/api.ts`: `cobro.sinVerificar(fecha)`, que es `GET /caja/cobros/sin-verificar?fecha=`.
  - `src/portal/turno/CierreCajaPage.tsx:154-178`: después de `ActaDelCierre` van dos secciones, «Recibidos a cuenta por el origen» y «Cobrados sin verificar con el origen». Cada una es un `<ul aria-label>`, como `PagosSinEntregar`.
  - `README.md`.
- Test:
  - `src/portal/conciliacion.test.tsx`;
  - `src/portal/cierreCaja.test.tsx`.

**Interfaces:**
- Consumes (Task 3 y Task 4 de caja-backend):
  - `GET /api/caja/pagos/a-cuenta?fecha=`;
  - `GET /api/caja/cobros/sin-verificar?fecha=`;
  - los campos nuevos de la conciliación.

- [ ] **Step 1: Write the failing tests.**
  - **`conciliacion.test.tsx`:**
    - `shows the a cuenta column with count and amount`: con `recibidos_a_cuenta: 2` e `importe_a_cuenta: {importe:'30.00',…}`, la celda dice «2 · S/ 30.00»;
    - `a line with a cuenta and no rechazos says Cuadra`;
    - `an old origin without a cuenta fields shows SinDato` (Review Focus 3).
  - **`cierreCaja.test.tsx`:**
    - `lists the payments received a cuenta with motivo and importe`;
    - `lists the cobros without verification with their advertencia`;
    - `says what is missing without pago_evento READ` (Review Focus 4).

- [ ] **Step 2: Run** `yarn test src/portal/conciliacion.test.tsx src/portal/cierreCaja.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Files, with the existing patterns (`PorSistema`, `PagosSinEntregar`, `SinDato`).

- [ ] **Step 4: Run** `yarn test && yarn typecheck && yarn lint`. Expected: PASS.

- [ ] **Step 5: README y commit.** Commit: `git commit -m "feat(cierre): los pagos a cuenta y los cobros sin verificar en el cierre y la conciliación"`.

### Task 3: la consulta de órdenes retiradas (#28)

**Files:**
- Create:
  - `src/portal/cobro/OrdenesRetiradasPage.tsx`;
  - `src/portal/ordenesRetiradas.test.tsx`.
- Modify:
  - `src/portal/shell/navTree.ts:15,45-76`: la hoja `ordenes-retiradas`, en «/ordenes-retiradas», con `lee('orden_de_cobro')`;
  - `src/portal/pantallas.ts:12-19`;
  - `src/portal/cobro/api.ts`: `cobro.ordenes({estado, pagador_documento, page})`, que es `GET /caja/ordenes-de-cobro?estado=ANULADA&…`;
  - `src/portal/forms/etiquetas.ts:12-16`: la etiqueta de ANULADA pasa a ser «Retirada por el origen»;
  - `README.md`.

**Interfaces:**
- Consumes: `GET /api/caja/ordenes-de-cobro?estado=ANULADA`, con `motivo_retiro`, `retirada_en`, `sustituida_por` y la paginación `Pagina<OrdenDeCobro>`.

- [ ] **Step 1: Write the failing tests.**
  - `lists the withdrawn orders with motivo and date`;
  - `filters by pagador documento in the URL`;
  - `pages with TAMANO_DE_PAGINA`;
  - `shows «sustituida por» when it has one`;
  - `is offered to SUPERVISOR_CAJA with READ on orden_de_cobro and hidden without it`.

- [ ] **Step 2: Run** `yarn test src/portal/ordenesRetiradas.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement**, copying the pattern of `recibo/ListaDeRecibos.tsx` (pages) and `recaudacion/AvanceDeRecaudacionPage.tsx` (filters in the URL).

- [ ] **Step 4: Run** `yarn test && yarn typecheck && yarn lint && yarn build`. Expected: PASS.

- [ ] **Step 5: README y commit.** Commit: `git commit -m "feat(portal): la consulta de las órdenes retiradas por el origen"`.

## Entrega

Hay un PR por task:
- el 1 va después de los Task 1 y 2 de caja-backend;
- el 2, después de los Task 3 y 4;
- el 3, después del Task 1.

Cada PR cierra su parte de #27 o #28, con el CI en verde.
