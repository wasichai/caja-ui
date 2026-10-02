// how caja writes an option caja-backend keeps plain (EFECTIVO, PAGO_REGISTRADO): only what a select, a ficha or a
// list shows changes, the records keep the backend's value. wasichai has no labels for enums yet (gap 9.5 of the
// plan), so they are here, by field: one value can read differently in two fields (PENDIENTE)
const POR_CAMPO: Record<string, Record<string, string>> = {
  forma_pago: {
    EFECTIVO: 'Efectivo',
    CHEQUE: 'Cheque',
    DEPOSITO: 'Depósito',
    TARJETA: 'Tarjeta',
    TRANSFERENCIA: 'Transferencia'
  },
  estado_orden: {
    PENDIENTE: 'Pendiente',
    PAGADA: 'Pagada',
    ANULADA: 'Anulada'
  },
  tipo_pago: {
    NORMAL: 'Orden de cobro',
    TASA: 'Tasa'
  },
  tipo_evento_pago: {
    PAGO_REGISTRADO: 'Pago registrado',
    PAGO_ANULADO: 'Pago anulado'
  },
  estado_recibo: {
    EMITIDO: 'Emitido',
    ANULADO: 'Anulado'
  },
  estado_evento: {
    PENDIENTE: 'Pendiente de entrega',
    ENTREGADO: 'Entregado',
    MUERTO: 'No se pudo entregar',
    EXPLICADO: 'Explicado'
  }
}

// what an option of a field shows: its label, or the value as it is when caja does not know it
export function etiqueta(campo: string, valor: string): string {
  const delCampo = Object.hasOwn(POR_CAMPO, campo) ? POR_CAMPO[campo] : undefined
  return delCampo && Object.hasOwn(delCampo, valor) ? delCampo[valor] : valor
}
