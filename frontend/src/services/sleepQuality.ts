import { isRealCalendarDate } from '../lib/activityValidation'
import { getMadridToday } from '../lib/sleepCalendar'
import type {
  SaveSleepQualityInput,
  SleepQualityConflictResponse,
  SleepQualityRecord,
} from '../types/sleepQuality'

const getBaseUrl = () =>
  (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001').replace(
    /\/+$/,
    '',
  )

export class SleepQualityAlreadyExistsError extends Error {
  readonly existing: SleepQualityRecord

  constructor(message: string, existing: SleepQualityRecord) {
    super(message)
    this.name = 'SleepQualityAlreadyExistsError'
    this.existing = existing
  }
}

export const RATING_LABELS: Record<number, string> = {
  1: 'Muy mala',
  2: 'Mala',
  3: 'Regular',
  4: 'Buena',
  5: 'Excelente',
}

export function validateSleepQualityRating(rating: unknown): string | null {
  if (
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return 'La valoración es obligatoria y debe ser un valor entre 1 y 5.'
  }
  return null
}

export function validateSleepQualityDate(
  date: string,
  today = getMadridToday(),
): string | null {
  if (!date || !date.trim()) {
    return 'Indica la fecha de la noche de descanso.'
  }
  if (!isRealCalendarDate(date)) {
    return 'Introduce una fecha válida.'
  }
  if (date > today) {
    return 'No se permiten fechas futuras.'
  }
  return null
}

export function validateSleepQualityNotes(notes: string): string | null {
  if (notes.trim().length > 200) {
    return 'El comentario no puede superar los 200 caracteres.'
  }
  return null
}

export function formatDay(isoDate: string): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3) return isoDate
  const [year, month, day] = parts
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export async function getSleepQualityList(): Promise<SleepQualityRecord[]> {
  const response = await fetch(`${getBaseUrl()}/api/sleep-quality`)
  if (!response.ok) {
    throw new Error('No se ha podido consultar el historial de calidad del sueño.')
  }
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function saveSleepQuality(
  input: SaveSleepQualityInput,
): Promise<{ record: SleepQualityRecord; replaced: boolean }> {
  const ratingError = validateSleepQualityRating(input.rating)
  if (ratingError) throw new Error(ratingError)

  const dateError = validateSleepQualityDate(input.sleepDate)
  if (dateError) throw new Error(dateError)

  if (input.notes) {
    const notesError = validateSleepQualityNotes(input.notes)
    if (notesError) throw new Error(notesError)
  }

  const response = await fetch(`${getBaseUrl()}/api/sleep-quality`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sleepDate: input.sleepDate,
      rating: input.rating,
      notes: input.notes?.trim() || null,
      overwrite: input.overwrite ?? false,
    }),
  })

  const data = await response.json().catch(() => null)

  if (response.status === 409) {
    const conflict = data as SleepQualityConflictResponse
    throw new SleepQualityAlreadyExistsError(
      conflict?.error?.message ||
        'Ya existe una valoración para esta noche. ¿Deseas sustituirla?',
      conflict.existing,
    )
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'object' &&
      data.error !== null &&
      'message' in data.error &&
      typeof data.error.message === 'string'
        ? data.error.message
        : 'No se pudo guardar la calidad del sueño.'
    throw new Error(message)
  }

  return {
    record: data as SleepQualityRecord,
    replaced: Boolean(data?.replaced),
  }
}
