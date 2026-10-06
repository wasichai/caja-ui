// @vitest-environment node
import { ApiError } from '@wasichai/core'
import { describe, expect, it } from 'vitest'
import { repartirElRechazo } from './campos'

// how every act tells the backend's refusal: under its fields, above its button, or the backend's own words

const ROTULOS: Record<string, string> = { caja: 'Caja' }
const repartir = (e: unknown) => repartirElRechazo(e, ['motivo', 'observacion'] as const, (campo) => ROTULOS[campo] ?? campo, 'No se pudo reversar')

describe('repartirElRechazo', () => {
  it('puts a 400 under the fields the form has, joining several of one', () => {
    const e = new ApiError(400, 'Bad Request', [
      { field: 'motivo', message: 'no puede estar en blanco' },
      { field: 'motivo', message: 'a lo sumo 80 caracteres' },
      { field: 'observacion', message: 'de 5 a 500 caracteres' }
    ])
    expect(repartir(e)).toEqual({
      errores: { motivo: 'no puede estar en blanco · a lo sumo 80 caracteres', observacion: 'de 5 a 500 caracteres' },
      general: null
    })
  })

  it('says above the button the fields the form has no control for, as they read', () => {
    const e = new ApiError(400, 'Bad Request', [
      { field: 'caja', message: 'no existe' },
      { field: 'fecha', message: 'no es de hoy' },
      { field: 'motivo', message: 'a lo sumo 80 caracteres' }
    ])
    expect(repartir(e)).toEqual({ errores: { motivo: 'a lo sumo 80 caracteres' }, general: 'Caja: no existe · fecha: no es de hoy' })
  })

  it('says what the backend said when it names no field, or what the act could not do', () => {
    expect(repartir(new ApiError(409, 'El cierre ya se reversó'))).toEqual({ errores: {}, general: 'El cierre ya se reversó' })
    expect(repartir(new ApiError(500, ''))).toEqual({ errores: {}, general: 'No se pudo reversar' })
  })
})
