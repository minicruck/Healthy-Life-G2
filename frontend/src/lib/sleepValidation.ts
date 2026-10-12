import { isRealCalendarDate } from './activityValidation'
import { getMadridToday } from './sleepCalendar'
import {
  isSleepType,
  type SleepFormValues,
  type SleepPayload,
} from '../types/sleep'

// Number() alone also accepts hexadecimal and exponent notation, unlike this field.
const DECIMAL_HOURS = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

export function validateSleep(
  values: SleepFormValues,
  today = getMadridToday(),
): Partial<Record<keyof SleepFormValues, string>> {
  const errors: Partial<Record<keyof SleepFormValues, string>> = {}

  if (!values.sleepDate) {
    errors.sleepDate = 'Indica la fecha del sueño.'
  } else if (!isRealCalendarDate(values.sleepDate)) {
    errors.sleepDate = 'Introduce una fecha real con formato día, mes y año.'
  } else if (values.sleepDate > today) {
    errors.sleepDate =
      'No puedes registrar horas de sueño para una fecha futura.'
  }

  if (!isSleepType(values.sleepType)) {
    errors.sleepType = 'Selecciona un tipo de descanso.'
  }

  const rawHours = values.hoursSlept.trim()
  const hours = Number(rawHours)
  if (!rawHours) {
    errors.hoursSlept = 'Indica cuántas horas has dormido.'
  } else if (!DECIMAL_HOURS.test(rawHours) || !Number.isFinite(hours)) {
    errors.hoursSlept =
      'Introduce un número de horas válido. Puedes usar decimales.'
  } else if (hours <= 0 || hours > 24) {
    errors.hoursSlept =
      'Las horas dormidas deben ser mayores que 0 y como máximo 24.'
  }

  return errors
}

export function toSleepPayload(values: SleepFormValues): SleepPayload {
  if (
    Object.keys(validateSleep(values)).length > 0 ||
    !isSleepType(values.sleepType)
  ) {
    throw new Error(
      'No se puede enviar un registro de sueño con datos inválidos.',
    )
  }

  return {
    sleepDate: values.sleepDate,
    hoursSlept: Number(values.hoursSlept.trim()),
    sleepType: values.sleepType,
  }
}
