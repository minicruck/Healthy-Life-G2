import type { TrainingGoalSummary } from '../types/trainingGoal'

const getBaseUrl = () =>
  (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001').replace(
    /\/+$/,
    '',
  )

export function validateTrainingDays(raw: string): string | null {
  if (!/^[1-7]$/.test(raw.trim())) {
    return 'Introduce un número entero de días entre 1 y 7.'
  }
  return null
}

function isSummary(value: unknown): value is TrainingGoalSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const data = value as Record<string, unknown>
  const goal = data.daysPerWeek
  const completed = data.completedDays
  const remaining = data.remainingDays
  if (
    goal !== null &&
    (typeof goal !== 'number' || !Number.isInteger(goal) || goal < 1 || goal > 7)
  ) return false
  if (
    typeof completed !== 'number' ||
    !Number.isInteger(completed) ||
    completed < 0 ||
    completed > 7
  ) return false
  if (
    remaining !== null &&
    (typeof remaining !== 'number' ||
      !Number.isInteger(remaining) ||
      remaining < 0 ||
      remaining > 7)
  ) return false
  if (
    goal === null
      ? remaining !== null
      : remaining !== Math.max(0, goal - completed)
  ) return false
  return (
    typeof data.weekStart === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.weekStart) &&
    typeof data.weekEnd === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.weekEnd) &&
    (data.updatedAt === null || typeof data.updatedAt === 'string')
  )
}

async function readSummary(response: Response): Promise<TrainingGoalSummary> {
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error('La API ha devuelto una respuesta que no se puede leer.')
  }
  if (!response.ok) {
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'object' &&
      data.error !== null &&
      'message' in data.error &&
      typeof data.error.message === 'string'
    ) {
      throw new Error(data.error.message)
    }
    throw new Error('No se ha podido consultar el objetivo de entrenamiento.')
  }
  if (!isSummary(data)) {
    throw new Error('La API ha devuelto datos de entrenamiento inesperados.')
  }
  return data
}

export async function getTrainingGoal(): Promise<TrainingGoalSummary> {
  const response = await fetch(`${getBaseUrl()}/api/training-goal`)
  return readSummary(response)
}

export async function saveTrainingGoal(rawDays: string): Promise<TrainingGoalSummary> {
  const error = validateTrainingDays(rawDays)
  if (error) throw new Error(error)
  const response = await fetch(`${getBaseUrl()}/api/training-goal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daysPerWeek: Number(rawDays.trim()) }),
  })
  return readSummary(response)
}
