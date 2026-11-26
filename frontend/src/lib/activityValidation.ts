import {
  ACTIVITY_OPTIONS,
  INTENSITY_OPTIONS,
  type ActivityFormValues,
  type ActivityPayload,
} from '../types/activity'

export type EditableActivityFields = ActivityFormValues
export type ActivityChanges = Omit<ActivityPayload, 'intensity'> & {
  intensity?: ActivityPayload['intensity']
}

/** Calendar-only dates deliberately never pass through Date or UTC conversion. */
export function isRealCalendarDate(value: string): boolean {
  if (value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const monthLengths = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  return day <= monthLengths[month - 1]
}

export function localToday(date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function validateActivityFields(
  values: ActivityFormValues,
): Partial<Record<keyof ActivityFormValues, string>> {
  const errors: Partial<Record<keyof ActivityFormValues, string>> = {}

  if (!ACTIVITY_OPTIONS.some(({ value }) => value === values.activityType)) {
    errors.activityType = 'Selecciona un tipo de actividad.'
  }
  if (!values.activityDate) {
    errors.activityDate = 'Indica la fecha de la actividad.'
  } else if (!isRealCalendarDate(values.activityDate)) {
    errors.activityDate = 'Introduce una fecha real con formato día, mes y año.'
  }
  if (values.intensity !== '' && !INTENSITY_OPTIONS.some(({ value }) => value === values.intensity)) {
    errors.intensity = 'Selecciona la intensidad del entrenamiento.'
  }
  if (values.notes.length > 500) {
    errors.notes = 'Las observaciones no pueden superar los 500 caracteres.'
  }

  return errors
}

export function validateActivity(
  values: ActivityFormValues,
): Partial<Record<keyof ActivityFormValues, string>> {
  const errors = validateActivityFields(values)
  if (values.intensity === '') {
    errors.intensity = 'Selecciona la intensidad del entrenamiento.'
  }
  return errors
}

export function toActivityChanges(values: EditableActivityFields): ActivityChanges {
  if (Object.keys(validateActivityFields(values)).length > 0 || values.activityType === '') {
    throw new Error('No se puede enviar una actividad con datos inválidos.')
  }
  const notes = values.notes.trim()
  return {
    activityType: values.activityType,
    activityDate: values.activityDate,
    ...(values.intensity ? { intensity: values.intensity } : {}),
    ...(notes ? { notes } : {}),
  }
}

export function toActivityPayload(values: ActivityFormValues): ActivityPayload {
  if (
    Object.keys(validateActivity(values)).length > 0 ||
    values.activityType === '' ||
    values.intensity === ''
  ) {
    throw new Error('No se puede enviar una actividad con datos inválidos.')
  }

  // Match the backend's trim before comparing the persisted response.
  const notes = values.notes.trim()

  return {
    activityType: values.activityType,
    activityDate: values.activityDate,
    intensity: values.intensity,
    ...(notes ? { notes } : {}),
  }
}
