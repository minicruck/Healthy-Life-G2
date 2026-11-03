import { isRealCalendarDate } from '../lib/activityValidation'
import type { WaterDailyTotal, WaterEntry, WaterPayload } from '../types/water'

type WaterApiErrorKind = 'network' | 'http' | 'unexpected'

export class WaterApiError extends Error {
  readonly kind: WaterApiErrorKind
  readonly status?: number

  constructor(kind: WaterApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'WaterApiError'
    this.kind = kind
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getBaseUrl() {
  return (
    import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001'
  ).replace(/\/+$/, '')
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parts =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|\+00:00)$/.exec(
      value,
    )
  return (
    parts !== null &&
    isRealCalendarDate(parts[1]) &&
    Number(parts[2]) <= 23 &&
    Number(parts[3]) <= 59 &&
    Number(parts[4]) <= 59
  )
}

function isDailyTotal(value: unknown): value is WaterDailyTotal {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    isRealCalendarDate(value.date) &&
    typeof value.totalMl === 'number' &&
    Number.isSafeInteger(value.totalMl) &&
    value.totalMl >= 0
  )
}

function isWaterEntry(value: unknown): value is WaterEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.amountMl === 'number' &&
    Number.isSafeInteger(value.amountMl) &&
    value.amountMl > 0 &&
    typeof value.consumedDate === 'string' &&
    isRealCalendarDate(value.consumedDate) &&
    isUtcTimestamp(value.createdAt)
  )
}

function httpError(status: number): WaterApiError {
  const message =
    status === 400
      ? 'El servidor no ha aceptado la cantidad de agua. Revisa el valor e inténtalo de nuevo.'
      : status >= 500
        ? 'El servidor no ha podido completar la operación. Inténtalo de nuevo más tarde.'
        : 'No se ha podido completar la operación de agua.'
  return new WaterApiError('http', message, status)
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    if (!response.ok) throw httpError(response.status)
    throw new WaterApiError(
      'unexpected',
      'El servidor ha devuelto una respuesta de agua inesperada.',
      response.status,
    )
  }
}

export async function getWaterToday(
  signal?: AbortSignal,
): Promise<WaterDailyTotal> {
  let response: Response
  try {
    response = await fetch(`${getBaseUrl()}/api/water/today`, {
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch {
    throw new WaterApiError(
      'network',
      'No se ha podido cargar el consumo de agua. Comprueba que el backend esté disponible.',
    )
  }

  const body = await readJson(response)
  if (!response.ok) throw httpError(response.status)
  if (!isDailyTotal(body)) {
    throw new WaterApiError(
      'unexpected',
      'El servidor ha devuelto un total diario de agua inválido.',
      response.status,
    )
  }
  return body
}

export async function listWaterEntries(
  signal?: AbortSignal,
): Promise<WaterEntry[]> {
  let response: Response
  try {
    response = await fetch(`${getBaseUrl()}/api/water`, {
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch {
    throw new WaterApiError(
      'network',
      'No se ha podido cargar el historial de agua. Comprueba que el backend esté disponible.',
    )
  }

  const body = await readJson(response)
  if (!response.ok) throw httpError(response.status)
  if (!Array.isArray(body) || !body.every(isWaterEntry)) {
    throw new WaterApiError(
      'unexpected',
      'El servidor ha devuelto un historial de agua inválido.',
      response.status,
    )
  }
  return body
}

export async function createWaterEntry(
  payload: WaterPayload,
  options: { signal?: AbortSignal } = {},
): Promise<WaterEntry> {
  if (!Number.isSafeInteger(payload.amountMl) || payload.amountMl <= 0) {
    throw new Error(
      'No se puede enviar un consumo de agua con datos inválidos.',
    )
  }
  if (options.signal?.aborted) {
    throw new WaterApiError('network', 'La solicitud se ha cancelado.')
  }

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })
  let response: Response
  try {
    response = await fetch(`${getBaseUrl()}/api/water`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountMl: payload.amountMl }),
      signal: controller.signal,
    })
  } catch {
    if (options.signal?.aborted) {
      throw new WaterApiError('network', 'La solicitud se ha cancelado.')
    }
    throw new WaterApiError(
      'network',
      'No se ha podido conectar con el servidor. Comprueba la conexión e inténtalo de nuevo.',
    )
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
  }

  const body = await readJson(response)
  if (!response.ok) throw httpError(response.status)
  if (
    response.status !== 201 ||
    !isRecord(body) ||
    typeof body.id !== 'number' ||
    !Number.isSafeInteger(body.id) ||
    body.id <= 0 ||
    body.amountMl !== payload.amountMl ||
    typeof body.consumedDate !== 'string' ||
    !isRealCalendarDate(body.consumedDate) ||
    !isUtcTimestamp(body.createdAt) ||
    typeof body.dailyTotalMl !== 'number' ||
    !Number.isSafeInteger(body.dailyTotalMl) ||
    body.dailyTotalMl < payload.amountMl
  ) {
    throw new WaterApiError(
      'unexpected',
      'El servidor ha devuelto una respuesta inesperada. No podemos confirmar el registro de agua.',
      response.status,
    )
  }
  return {
    id: body.id,
    amountMl: body.amountMl,
    consumedDate: body.consumedDate,
    createdAt: body.createdAt,
  }
}
