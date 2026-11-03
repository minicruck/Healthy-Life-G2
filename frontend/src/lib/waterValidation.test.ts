import { describe, expect, it } from 'vitest'
import { toWaterPayload, validateWater } from './waterValidation'

describe('validateWater', () => {
  it.each(['', '   ', '0', '-1', 'abc', '1.5', '1e3'])(
    'rejects invalid amount %j',
    (amountMl) => {
      expect(validateWater({ amountMl }).amountMl).toBeDefined()
    },
  )

  it.each(['1', '250', '2000'])(
    'accepts positive integer milliliters %s',
    (amountMl) => {
      expect(validateWater({ amountMl })).toEqual({})
    },
  )

  it('creates a numeric API payload', () => {
    expect(toWaterPayload({ amountMl: ' 250 ' })).toEqual({ amountMl: 250 })
  })
})
