import { describe, expect, it } from 'vitest'
import { etiqueta } from './etiquetas'

// how caja writes the options caja-backend keeps plain. wasichai has no labels for enums yet (gap 9.5 of the plan)
describe('etiqueta', () => {
  it.each([
    ['forma_pago', 'EFECTIVO', 'Efectivo'],
    ['forma_pago', 'CHEQUE', 'Cheque'],
    ['forma_pago', 'DEPOSITO', 'Depósito'],
    ['forma_pago', 'TARJETA', 'Tarjeta'],
    ['forma_pago', 'TRANSFERENCIA', 'Transferencia'],
    ['estado_orden', 'PENDIENTE', 'Pendiente'],
    ['estado_orden', 'PAGADA', 'Pagada'],
    ['estado_orden', 'ANULADA', 'Anulada'],
    ['estado_recibo', 'EMITIDO', 'Emitido'],
    ['estado_recibo', 'ANULADO', 'Anulado'],
    ['tipo_pago', 'NORMAL', 'Orden de cobro'],
    ['tipo_pago', 'TASA', 'Tasa'],
    ['tipo_evento_pago', 'PAGO_REGISTRADO', 'Pago registrado'],
    ['tipo_evento_pago', 'PAGO_ANULADO', 'Pago anulado'],
    ['estado_del_turno', 'ABIERTO', 'Abierto'],
    ['estado_del_turno', 'CERRADO', 'Cerrado'],
    ['estado_evento', 'PENDIENTE', 'Pendiente de entrega'],
    ['estado_evento', 'ENTREGADO', 'Entregado'],
    ['estado_evento', 'MUERTO', 'No se pudo entregar'],
    ['estado_evento', 'EXPLICADO', 'Explicado'],
    ['origen', 'TASA', 'Tasas y derechos administrativos']
  ])('writes %s %s as «%s»', (campo, valor, esperada) => {
    expect(etiqueta(campo, valor)).toBe(esperada)
  })

  // PENDIENTE is two things: an order not paid yet, and an event not delivered yet
  it('reads a value by its field', () => {
    expect(etiqueta('estado_orden', 'PENDIENTE')).not.toBe(etiqueta('estado_evento', 'PENDIENTE'))
  })

  it('gives back as it is a value it does not know, or one of a field it does not know', () => {
    expect(etiqueta('forma_pago', 'YAPE')).toBe('YAPE')
    expect(etiqueta('otro_campo', 'EFECTIVO')).toBe('EFECTIVO')
    // nothing an object has of its own reads as a label
    expect(etiqueta('forma_pago', 'constructor')).toBe('constructor')
    expect(etiqueta('constructor', 'EFECTIVO')).toBe('EFECTIVO')
  })
})
