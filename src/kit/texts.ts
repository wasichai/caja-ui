// copiado de srtm-ui@a1df33a (src/kit/texts.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// Default Spanish strings for kit forms and flows
export interface KitTexts {
  required: string // 'Este dato es obligatorio'
  integer: string // 'Debe ser un número entero'
  number: string // 'Debe ser un número'
  saving: string // 'Guardando…'
  saveFailed: string // 'No se pudo guardar'
  cancel: string // 'Cancelar'
  select: string // 'SELECCIONAR'
  datePlaceholder: string // 'DD/MM/AAAA'
  yes: string // 'SÍ'
  no: string // 'NO'
  months: readonly string[] // ENERO … DICIEMBRE (SETIEMBRE)
  leaveTitle: string // '¿Salir sin guardar?'
  leaveConsequence: string // 'Si sales, se pierden.'
  leaveConfirm: string // 'Salir sin guardar'
  keepEditing: string // 'Seguir editando'
  pendingIn: (list: string) => string // list joined: 'Hay cambios sin guardar en A, B.'
  // editable list (crud/EditableList): plural and singular name the rows
  listOf: (plural: string) => string // 'Listado de domicilios'
  add: (singular: string) => string // 'Agregar domicilio'
  edit: (singular: string) => string // 'Editar domicilio'
  remove: (singular: string) => string // 'Eliminar domicilio'
  newOne: (singular: string) => string // 'Nuevo domicilio' (dialog title)
  editOne: (singular: string) => string // 'Editar domicilio' (dialog title)
  dataOf: (singular: string) => string // 'Datos del domicilio' (dialog description, screen readers only)
  noResults: string // 'No se encontraron resultados!'
  removeTitle: (singular: string) => string // '¿Eliminar este domicilio?'
  removeBody: string // 'Se quita de la ficha. El historial del registro lo conserva.'
  removeFailed: string // 'No se pudo eliminar'
  save: string // 'Grabar'
  status: string // 'Estado': the status column's heading when status.label is absent
}

export const DEFAULT_TEXTS: KitTexts = {
  required: 'Este dato es obligatorio',
  integer: 'Debe ser un número entero',
  number: 'Debe ser un número',
  saving: 'Guardando…',
  saveFailed: 'No se pudo guardar',
  cancel: 'Cancelar',
  select: 'SELECCIONAR',
  datePlaceholder: 'DD/MM/AAAA',
  yes: 'SÍ',
  no: 'NO',
  months: ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'],
  leaveTitle: '¿Salir sin guardar?',
  leaveConsequence: 'Si sales, se pierden.',
  leaveConfirm: 'Salir sin guardar',
  keepEditing: 'Seguir editando',
  pendingIn: (list) => `Hay cambios sin guardar en ${list}.`,
  listOf: (plural) => `Listado de ${plural}`,
  add: (singular) => `Agregar ${singular}`,
  edit: (singular) => `Editar ${singular}`,
  remove: (singular) => `Eliminar ${singular}`,
  newOne: (singular) => `Nuevo ${singular}`,
  editOne: (singular) => `Editar ${singular}`,
  dataOf: (singular) => `Datos del ${singular}`,
  noResults: 'No se encontraron resultados!',
  removeTitle: (singular) => `¿Eliminar este ${singular}?`,
  removeBody: 'Se quita de la ficha. El historial del registro lo conserva.',
  removeFailed: 'No se pudo eliminar',
  save: 'Grabar',
  status: 'Estado'
}
