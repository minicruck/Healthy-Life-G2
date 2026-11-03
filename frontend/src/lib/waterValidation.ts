import type { WaterFormValues, WaterPayload } from '../types/water'

const WHOLE_NUMBER = /^-?\d+$/

export function validateWater(
  values: WaterFormValues,
): Partial<Record<keyof WaterFormValues, string>> {
  const errors: Partial<Record<keyof WaterFormValues, string>> = {}
  const rawAmount = values.amountMl.trim()

  if (!rawAmount) {
    errors.amountMl = 'Indica la cantidad de agua consumida.'
  } else if (!WHOLE_NUMBER.test(rawAmount)) {
    errors.amountMl = 'Introduce una cantidad válida en mililitros.'
  } else {
    const amountMl = Number(rawAmount)
    if (!Number.isSafeInteger(amountMl) || amountMl <= 0) {
      errors.amountMl =
        'La cantidad debe ser un número entero de mililitros mayor que 0.'
    }
  }

  return errors
}

export function toWaterPayload(values: WaterFormValues): WaterPayload {
  if (Object.keys(validateWater(values)).length > 0) {
    throw new Error(
      'No se puede enviar un consumo de agua con datos inválidos.',
    )
  }
  return { amountMl: Number(values.amountMl.trim()) }
}
