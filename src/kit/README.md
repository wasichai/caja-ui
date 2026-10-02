# `src/kit`: la copia temporal del kit de srtm-ui

Es la copia del kit de formularios de `srtm-ui`, tomada en **`a1df33a`** (`src/kit`): el motor de formularios, la ficha
de solo lectura, la lista editable, el aviso de cambios sin guardar, el mensaje de error y los textos y el proveedor que
los configuran. No se subió antes a wasichai-ui: esta copia es el «segundo usuario concreto» que pide el README del kit
de srtm-ui para subirlo en la fase 2 ([wasichai-ui#14](https://github.com/wasichai/wasichai-ui/issues/14)), **solo de
las piezas que caja-ui usa** (la tabla de abajo). La lista editable y el aviso de cambios sin guardar se copiaron y no
tienen usuario aquí.

Cada archivo que no es un test empieza con la cabecera

```ts
// copiado de srtm-ui@a1df33a (src/kit/<ruta original>): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
```

y el código va tal cual: solo se adaptaron los tests que nombraban piezas de srtm-ui (`RecordForm.test.tsx` usa un tema
propio del test y `boundaries.test.tsx` tiene el vocabulario de caja).

## Reglas de la frontera (`boundaries.test.tsx`)

1. **Imports.** Un archivo del kit que no es un test solo importa otro archivo del kit, `react`, `react-dom`,
   `react-hook-form`, `react-router`, `@tanstack/react-query`, `@wasichai/core`, `@wasichai/ui` o `lucide-react`. Se
   miran `from '…'`, `import '…'` e `import('…')`.
2. **Sin dominio.** Ninguno dice el vocabulario de caja (`recibo`, `orden de cobro`, `cobr…`, `tasa`, `turno`,
   `cierre`, `arqueo`, `cajer…`, `tesorer…`, `ventanilla`, `conciliaci…`) ni el de srtm (`contribuyente`, `predio`,
   `declaraci…`, `srtm`, `rentas`, `ubigeo`, `reniec`, `padrón`, `catastro`, `perené`, `dj`), comentarios incluidos. La
   cabecera es la única línea que puede nombrar srtm-ui.
3. **La cabecera.** Todo archivo que no es un test la lleva en la primera línea, con su propia ruta.
4. Lo que el kit sabe de caja le llega por `KitProvider`: el portal lo monta en `src/portal/KitDelPortal.tsx` con las
   etiquetas de los enums (`src/portal/forms/etiquetas.ts`), su `Alerta` de error y el `kind` de ficha `importe`
   (`displayKinds`, `src/portal/forms/importe.tsx`), que dibuja el importe con `Importe`.

## Qué se copió y para qué lo usa caja-ui

| Pieza                      | Dónde la usa caja-ui                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RecordForm`               | solo la anulación de «Duplicado de recibo» (`recibo/ActoDeAnulacion.tsx`). El cierre, la reversión, la explicación, el duplicado y los cobros son formularios propios              |
| `FieldGrid`                | el recibo emitido de las dos cajas (`cobro/ReciboEmitido.tsx`) y el recibo elegido de «Duplicado de recibo» (`recibo/ReciboElegido.tsx`), con el `kind` `importe` (`displayKinds`) |
| `NativeSelect`             | la caja, la forma de pago y el estado de la lista de recibos                                                                                                                       |
| `errorMessage`             | todas                                                                                                                                                                              |
| `format.ts` (`formatDate`) | las fechas que se dibujan, en casi todas las pantallas (cobro, recibos, turno, pagos, recaudación y conciliación)                                                                  |
| `EditableList`             | **ninguna**. Se pensó para las líneas de tasas, que son una tabla propia (por qué, en el README raíz). Queda en la copia, con su test, sin usuario                                 |
| `useUnsavedChanges`        | **ninguna**. Ninguna pantalla lo monta: salir de una hoja con un acto a medio teclear lo pierde (hueco conocido, en el README raíz)                                                |

Con ellas vienen `KitProvider`, `texts.ts` y `format.ts`, y lo que `RecordForm` importa: `spec.ts`, `kinds.tsx`,
`fieldId.ts`, `styles.ts`, `NativeSelect.tsx`, `group.ts`, `locked.ts`, `geometry.ts` y `SuggestInput.tsx`.

## Cambios sobre la copia

- **`displayKinds`** (`KitProvider`, `FieldGrid`): una app le da al kit cómo dibuja en una ficha sus propios `kind`, por
  nombre, para un valor que el kit no sabe formatear (un objeto, una cifra con su fecha). Sin ellos, `FieldGrid`
  dibuja como antes. Test: `src/kit/forms/FieldGrid.test.tsx`. Hay que llevarlo a srtm-ui (o a wasichai-ui#14).

## Para no divergir

Cualquier cambio a una pieza del kit se lleva también a srtm-ui o, cuando ya haya subido, a wasichai-ui: la copia
desaparece en la fase 2 ([wasichai-ui#14](https://github.com/wasichai/wasichai-ui/issues/14)), y lo que solo cambió aquí
se perdería.
