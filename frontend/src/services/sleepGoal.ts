// HU10 — Objetivo mínimo de horas de sueño. Contrato en docs/hu10-api.md.
import type { SleepDayCompliance, SleepGoalSummary } from '../types/sleepGoal'

const getBaseUrl = () =>
  (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001').replace(
    /\/+$/,
    '',
  )

const DECIMAL = /^\d+(?:[.,]\d+)?$/

/** Convierte lo escrito (admite coma decimal) en horas, o null si no es un número. */
export function parseSleepGoalHours(raw: string): number | null {
  const value = raw.trim()
  if (!DECIMAL.test(value)) return null
  const hours = Number(value.replace(',', '.'))
  return Number.isFinite(hours) ? hours : null
}

export function validateSleepGoalHours(raw: string): string | null {
  if (!raw.trim()) return 'Indica cuántas horas quieres dormir como mínimo.'
  const hours = parseSleepGoalHours(raw)
  if (hours === null) return 'Introduce un número de horas, por ejemplo 8 o 7,5.'
  if (hours <= 0 || hours > 24) {
    return 'El objetivo debe ser mayor que 0 y como máximo 24 horas.'
  }
  return null
}

const isDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

function isDay(value: unknown): value is SleepDayCompliance {
  if (typeof value !== 'object' || value === null) return false
  const day = value as Record<string, unknown>
  return (
    isDate(day.date) &&
    typeof day.totalHours === 'number' &&
    Number.isFinite(day.totalHours) &&
    (day.met === null || typeof day.met === 'boolean')
  )
}

function isSummary(value: unknown): value is SleepGoalSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  return (
    (data.minHours === null ||
      (typeof data.minHours === 'number' && data.minHours > 0 && data.minHours <= 24)) &&
    (data.updatedAt === null || typeof data.updatedAt === 'string') &&
    isDate(data.fromDate) &&
    isDate(data.toDate) &&
    Array.isArray(data.days) &&
    data.days.every(isDay) &&
    (data.latest === null || isDay(data.latest)) &&
    (data.checked === null || isDay(data.checked)) &&
    typeof data.alert === 'boolean'
  )
}

async function readSummary(response: Response): Promise<SleepGoalSummary> {
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error('La API ha devuelto una respuesta que no se puede leer.')
  }
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'object' &&
      data.error !== null &&
      'message' in data.error &&
      typeof data.error.message === 'string'
        ? data.error.message
        : 'No se ha podido consultar el objetivo de sueño.'
    throw new Error(message)
  }
  if (!isSummary(data)) {
    throw new Error('La API ha devuelto datos de sueño inesperados.')
  }
  return data
}

/**
 * Consulta el objetivo. Con `checkDate` (YYYY-MM-DD) el aviso se evalúa sobre ese día,
 * por ejemplo el del registro de sueño recién guardado.
 */
export async function getSleepGoal(checkDate?: string): Promise<SleepGoalSummary> {
  const query = checkDate ? `?date=${encodeURIComponent(checkDate)}` : ''
  const response = await fetch(`${getBaseUrl()}/api/sleep-goal${query}`)
  return readSummary(response)
}

export async function saveSleepGoal(rawHours: string): Promise<SleepGoalSummary> {
  const error = validateSleepGoalHours(rawHours)
  if (error) throw new Error(error)
  const response = await fetch(`${getBaseUrl()}/api/sleep-goal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minHours: parseSleepGoalHours(rawHours) }),
  })
  return readSummary(response)
}

/** 7.5 → "7,5 h"; 8 → "8 h". */
export function formatHours(hours: number): string {
  return `${String(Math.round(hours * 100) / 100).replace('.', ',')} h`
}

/** 2026-11-05 → "5/11/2026", sin conversiones de zona horaria. */
export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${day}/${month}/${year}`
}

/** Texto del aviso cuando el día evaluado (`checked`) no alcanza el objetivo. */
export function sleepAlertMessage(summary: SleepGoalSummary): string | null {
  const day = summary.checked
  if (!summary.alert || day === null || summary.minHours === null) return null
  const missing = summary.minHours - day.totalHours
  return `El ${formatDay(day.date)} dormiste ${formatHours(
    day.totalHours,
  )}, ${formatHours(missing)} menos que tu objetivo de ${formatHours(summary.minHours)}.`
}
