import {
  isRealCalendarDate,
  toActivityPayload,
} from '../lib/activityValidation'
import {
  ACTIVITY_OPTIONS,
  type Activity,
  type ActivityPayload,
} from '../types/activity'

type ApiErrorKind = 'network' | 'http' | 'unexpected' | 'timeout'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

const TIMEOUT_MS = 15_000
const UNEXPECTED_MESSAGE =
  'El servidor ha devuelto una respuesta inesperada. No podemos confirmar el registro de la actividad.'
const CANCELLED_MESSAGE =
  'La solicitud se ha cancelado. No podemos confirmar el registro.'

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

function isActivity(
  value: unknown,
  submitted: ActivityPayload,
): value is Activity {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    ACTIVITY_OPTIONS.some(({ value: type }) => type === value.activityType) &&
    value.activityType === submitted.activityType &&
    typeof value.activityDate === 'string' &&
    isRealCalendarDate(value.activityDate) &&
    value.activityDate === submitted.activityDate &&
    (value.notes === null ||
      (typeof value.notes === 'string' && value.notes.length <= 500)) &&
    value.notes === (submitted.notes ?? null) &&
    isUtcTimestamp(value.createdAt)
  )
}

function httpError(status: number, body: unknown): ApiError {
  let message =
    'No se ha podido registrar la actividad. El servidor ha rechazado la petición.'

  if (status === 400) {
    message =
      'El servidor no ha aceptado los datos. Revisa la actividad y vuelve a intentarlo.'
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
    message =
      'No se ha encontrado el servicio de registro. Comprueba la configuración de la API.'
  } else if (status === 413) {
    message =
      'La petición es demasiado grande. Revisa las observaciones e inténtalo de nuevo.'
  } else if (status >= 500) {
    message =
      'El servidor no ha podido completar el registro. Inténtalo de nuevo más tarde.'
  }

  return new ApiError('http', message, status)
}

function getBaseUrl() {
  return (
    import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001'
  ).replace(/\/+$/, '')
}

export async function listActivities(
  userId = 'demo-user',
): Promise<Activity[]> {
  const response = await fetch(`${getBaseUrl()}/api/activities`, {
    headers: {
      Accept: 'application/json',
      'X-User-Id': userId,
    },
  })

  if (!response.ok) {
    throw new ApiError(
      'http',
      'No se ha podido cargar el historial de actividades.',
      response.status,
    )
  }

  const body: unknown = await response.json()
  if (!Array.isArray(body)) {
    throw new ApiError(
      'unexpected',
      'El servidor ha devuelto un historial de actividades inesperado.',
    )
  }

  return body.map((item) => {
    if (!isRecord(item)) {
      throw new ApiError('unexpected', 'El historial contiene registros inválidos.')
    }

    const activityType = item.activityType
    if (
      typeof item.id !== 'number' ||
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      typeof activityType !== 'string' ||
      !ACTIVITY_OPTIONS.some(({ value }) => value === activityType) ||
      typeof item.activityDate !== 'string' ||
      !isRealCalendarDate(item.activityDate) ||
      (item.notes !== null && typeof item.notes !== 'string') ||
      !isUtcTimestamp(item.createdAt)
    ) {
      throw new ApiError('unexpected', 'El historial contiene registros inválidos.')
    }

    return {
      id: item.id,
      activityType: activityType as Activity['activityType'],
      activityDate: item.activityDate,
      notes: item.notes as string | null,
      createdAt: item.createdAt,
    }
  })
}

async function sendActivity(
  payload: ActivityPayload,
  signal: AbortSignal,
): Promise<Activity> {
  const response = await fetch(`${getBaseUrl()}/api/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  let body: unknown
  try {
    body = await response.json()
  } catch {
    // An HTTP failure remains actionable even when a reverse proxy returns HTML.
    if (!response.ok) throw httpError(response.status, undefined)
    throw new ApiError('unexpected', UNEXPECTED_MESSAGE, response.status)
  }

  if (!response.ok) throw httpError(response.status, body)
  if (response.status !== 201 || !isActivity(body, payload)) {
    throw new ApiError('unexpected', UNEXPECTED_MESSAGE, response.status)
  }
  return body
}

/** A POST is never retried automatically: the first request might already be stored. */
export async function createActivity(
  payload: ActivityPayload,
  options: { signal?: AbortSignal } = {},
): Promise<Activity> {
  // Explicit construction also keeps extra runtime fields (including userId) off the wire.
  const submitted = toActivityPayload({
    activityType: payload.activityType,
    activityDate: payload.activityDate,
    notes: payload.notes ?? '',
  })
  if (options.signal?.aborted) throw new ApiError('network', CANCELLED_MESSAGE)

  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined

  const interrupted = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new ApiError(
          'timeout',
          'El servidor está tardando demasiado. No podemos confirmar el registro; comprueba la conexión antes de volver a enviarlo.',
        ),
      )
      controller.abort()
    }, TIMEOUT_MS)

    onAbort = () => {
      reject(new ApiError('network', CANCELLED_MESSAGE))
      controller.abort()
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
  })

  try {
    return await Promise.race([
      sendActivity(submitted, controller.signal),
      interrupted,
    ])
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      'network',
      'No se ha podido conectar con el servidor. Comprueba la conexión y que el backend esté disponible.',
    )
  } finally {
    clearTimeout(timeout)
    if (onAbort) options.signal?.removeEventListener('abort', onAbort)
  }
}
