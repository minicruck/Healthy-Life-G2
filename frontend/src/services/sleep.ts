import { isRealCalendarDate } from '../lib/activityValidation'
import { getMadridToday } from '../lib/sleepCalendar'
import { isSleepType } from '../types/sleep'
import type { SleepPayload, SleepRecord } from '../types/sleep'

type SleepApiErrorKind = 'network' | 'http' | 'unexpected' | 'timeout'

export class SleepApiError extends Error {
  readonly kind: SleepApiErrorKind
  readonly status?: number

  constructor(kind: SleepApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'SleepApiError'
    this.kind = kind
    this.status = status
  }
}

const TIMEOUT_MS = 15_000
const UNEXPECTED_MESSAGE =
  'El servidor ha devuelto una respuesta inesperada. No podemos confirmar el registro de las horas de sueño.'
const CANCELLED_MESSAGE =
  'La solicitud se ha cancelado. No podemos confirmar el registro.'
const LIST_UNEXPECTED_MESSAGE =
  'El servidor ha devuelto datos de sueño inesperados. No se ha podido cargar el seguimiento.'
const UPDATE_UNEXPECTED_MESSAGE =
  'El servidor ha devuelto una respuesta inesperada. No podemos confirmar los cambios del registro de sueño.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parts =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|\+00:00)$/.exec(
      value,
    )
  return (
    parts !== null &&
    parts[0] === value &&
    isRealCalendarDate(parts[1]) &&
    Number(parts[2]) <= 23 &&
    Number(parts[3]) <= 59 &&
    Number(parts[4]) <= 59
  )
}

function isHoursSlept(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 24
  )
}

function isSleepRecord(
  value: unknown,
  submitted?: SleepPayload,
): value is SleepRecord {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.sleepDate === 'string' &&
    isRealCalendarDate(value.sleepDate) &&
    isHoursSlept(value.hoursSlept) &&
    (value.sleepType === null || isSleepType(value.sleepType)) &&
    isUtcTimestamp(value.createdAt) &&
    (submitted === undefined ||
      (value.sleepDate === submitted.sleepDate &&
        value.hoursSlept === submitted.hoursSlept &&
        value.sleepType === submitted.sleepType))
  )
}

function httpError(
  status: number,
  body: unknown,
  editing = false,
): SleepApiError {
  let message = editing
    ? 'No se han podido guardar los cambios del registro de sueño. El servidor ha rechazado la petición.'
    : 'No se han podido registrar las horas de sueño. El servidor ha rechazado la petición.'

  if (status === 400) {
    message =
      'El servidor no ha aceptado los datos. Revisa la fecha, las horas y el tipo de sueño y vuelve a intentarlo.'
    if (
      isRecord(body) &&
      isRecord(body.error) &&
      body.error.code === 'VALIDATION_ERROR' &&
      typeof body.error.message === 'string' &&
      body.error.message.trim().length > 0 &&
      body.error.message.length <= 500
    ) {
      message = body.error.message
    }
  } else if (status === 404) {
    message = editing
      ? 'No se ha encontrado el registro de sueño. Actualiza el seguimiento antes de volver a intentarlo.'
      : 'No se ha encontrado el servicio de registro de sueño. Comprueba la configuración de la API.'
  } else if (status === 413) {
    message =
      'La petición es demasiado grande. Revisa los datos e inténtalo de nuevo.'
  } else if (status >= 500) {
    message = editing
      ? 'El servidor no ha podido guardar los cambios. Inténtalo de nuevo más tarde.'
      : 'El servidor no ha podido completar el registro. Inténtalo de nuevo más tarde.'
  }

  return new SleepApiError('http', message, status)
}

async function sendSleep(
  payload: SleepPayload,
  signal: AbortSignal,
  original?: Pick<SleepRecord, 'id' | 'createdAt'>,
): Promise<SleepRecord> {
  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001'
  ).replace(/\/+$/, '')
  const editing = original !== undefined
  const unexpectedMessage = editing
    ? UPDATE_UNEXPECTED_MESSAGE
    : UNEXPECTED_MESSAGE
  const path = editing ? `/api/sleep/${original.id}` : '/api/sleep'
  const response = await fetch(`${baseUrl}${path}`, {
    method: editing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (!response.ok) throw httpError(response.status, undefined, editing)
    throw new SleepApiError('unexpected', unexpectedMessage, response.status)
  }

  if (!response.ok) throw httpError(response.status, body, editing)
  if (
    response.status !== (editing ? 200 : 201) ||
    !isSleepRecord(body, payload) ||
    (editing &&
      (body.id !== original.id || body.createdAt !== original.createdAt))
  ) {
    throw new SleepApiError('unexpected', unexpectedMessage, response.status)
  }
  return body
}

function prepareSleepPayload(payload: SleepPayload): SleepPayload {
  if (
    typeof payload.sleepDate !== 'string' ||
    !isRealCalendarDate(payload.sleepDate) ||
    payload.sleepDate > getMadridToday() ||
    !isHoursSlept(payload.hoursSlept) ||
    !isSleepType(payload.sleepType)
  ) {
    throw new Error(
      'No se puede enviar un registro de sueño con datos inválidos.',
    )
  }
  // Explicit fields prevent userId or unrelated runtime values reaching the API.
  return {
    sleepDate: payload.sleepDate,
    hoursSlept: payload.hoursSlept,
    sleepType: payload.sleepType,
  }
}

/** Never retry a POST automatically: a lost response does not mean it was not saved. */
export async function createSleep(
  payload: SleepPayload,
  options: { signal?: AbortSignal } = {},
): Promise<SleepRecord> {
  const submitted = prepareSleepPayload(payload)

  return requestWithDeadline(
    (signal) => sendSleep(submitted, signal),
    options,
    {
      cancelled: CANCELLED_MESSAGE,
      timeout:
        'El servidor está tardando demasiado. No podemos confirmar el registro; comprueba la conexión antes de volver a enviarlo.',
    },
  )
}

/** A PATCH is confirmed only when its data and original identity match exactly. */
export async function updateSleep(
  original: SleepRecord,
  payload: SleepPayload,
  options: { signal?: AbortSignal } = {},
): Promise<SleepRecord> {
  if (!isSleepRecord(original)) {
    throw new Error('No se puede editar un registro de sueño inválido.')
  }
  const submitted = prepareSleepPayload(payload)
  const identity = { id: original.id, createdAt: original.createdAt }

  // Do not retry automatically: the server may have saved a lost response.
  return requestWithDeadline(
    (signal) => sendSleep(submitted, signal, identity),
    options,
    {
      cancelled:
        'La solicitud se ha cancelado. No podemos confirmar los cambios.',
      timeout:
        'El servidor está tardando demasiado. No podemos confirmar los cambios; comprueba la conexión antes de volver a enviarlos.',
    },
  )
}

async function requestWithDeadline<T>(
  send: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal },
  messages: { cancelled: string; timeout: string },
): Promise<T> {
  if (options.signal?.aborted)
    throw new SleepApiError('network', messages.cancelled)

  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined

  const interrupted = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new SleepApiError('timeout', messages.timeout))
      controller.abort()
    }, TIMEOUT_MS)

    onAbort = () => {
      reject(new SleepApiError('network', messages.cancelled))
      controller.abort()
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
  })

  try {
    return await Promise.race([send(controller.signal), interrupted])
  } catch (error) {
    if (error instanceof SleepApiError) throw error
    throw new SleepApiError(
      'network',
      'No se ha podido conectar con el servidor. Comprueba la conexión y que el backend esté disponible.',
    )
  } finally {
    clearTimeout(timeout)
    if (onAbort) options.signal?.removeEventListener('abort', onAbort)
  }
}

function listHttpError(status: number, body: unknown): SleepApiError {
  let message =
    'No se han podido consultar los registros de sueño. El servidor ha rechazado la petición.'

  if (
    status === 400 &&
    isRecord(body) &&
    isRecord(body.error) &&
    body.error.code === 'VALIDATION_ERROR' &&
    typeof body.error.message === 'string' &&
    body.error.message.trim().length > 0 &&
    body.error.message.length <= 500
  ) {
    message = body.error.message
  } else if (status === 404) {
    message =
      'No se ha encontrado el servicio de consulta de sueño. Comprueba la configuración de la API.'
  } else if (status >= 500) {
    message =
      'El servidor no ha podido cargar los registros de sueño. Inténtalo de nuevo más tarde.'
  }

  return new SleepApiError('http', message, status)
}

async function readSleepRecords(signal: AbortSignal): Promise<SleepRecord[]> {
  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001'
  ).replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/api/sleep`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (!response.ok) throw listHttpError(response.status, undefined)
    throw new SleepApiError(
      'unexpected',
      LIST_UNEXPECTED_MESSAGE,
      response.status,
    )
  }

  if (!response.ok) throw listHttpError(response.status, body)
  if (
    response.status !== 200 ||
    !Array.isArray(body) ||
    !body.every((record: unknown) => isSleepRecord(record)) ||
    new Set(body.map((record) => record.id)).size !== body.length
  ) {
    throw new SleepApiError(
      'unexpected',
      LIST_UNEXPECTED_MESSAGE,
      response.status,
    )
  }
  return body
}

/** Malformed data is an error; only a confirmed HTTP 200 array can be empty. */
export async function getSleepRecords(
  options: { signal?: AbortSignal } = {},
): Promise<SleepRecord[]> {
  return requestWithDeadline(readSleepRecords, options, {
    cancelled: 'Se ha cancelado la consulta de los registros de sueño.',
    timeout:
      'El servidor está tardando demasiado en cargar los registros de sueño. Inténtalo de nuevo.',
  })
}
