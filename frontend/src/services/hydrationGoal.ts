import type { HydrationGoal } from '../types/hydrationGoal'

const getBaseUrl = () =>
  (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001').replace(
    /\/+$/,
    '',
  )

function isGoal(value: unknown): value is HydrationGoal {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const body = value as Record<string, unknown>
  return (
    (body.litersPerDay === null ||
      (typeof body.litersPerDay === 'number' &&
        Number.isFinite(body.litersPerDay) &&
        body.litersPerDay > 0)) &&
    (body.updatedAt === null || typeof body.updatedAt === 'string')
  )
}

function errorMessage(body: unknown, fallback: string) {
  if (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as Record<string, unknown>).error === 'object' &&
    (body as { error?: { message?: unknown } }).error &&
    typeof (body as { error: { message?: unknown } }).error.message === 'string'
  ) {
    return (body as { error: { message: string } }).error.message
  }
  return fallback
}

async function readJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export async function getHydrationGoal(): Promise<HydrationGoal> {
  const response = await fetch(`${getBaseUrl()}/api/hydration-goal`)
  const body: unknown = await readJson(response)
  if (!response.ok) {
    throw new Error(errorMessage(body, 'No se ha podido cargar la meta de agua.'))
  }
  if (!isGoal(body)) {
    throw new Error('El servidor ha devuelto una meta de agua inesperada.')
  }
  return body
}

export async function saveHydrationGoal(
  litersPerDay: number,
): Promise<HydrationGoal> {
  const response = await fetch(`${getBaseUrl()}/api/hydration-goal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ litersPerDay }),
  })
  const body: unknown = await readJson(response)
  if (!response.ok) {
    throw new Error(errorMessage(body, 'No se ha podido guardar la meta de agua.'))
  }
  if (!isGoal(body) || body.litersPerDay === null) {
    throw new Error('El servidor ha devuelto una meta de agua inesperada.')
  }
  return body
}

