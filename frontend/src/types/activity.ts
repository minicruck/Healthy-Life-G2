export const ACTIVITY_OPTIONS = [
  { value: 'walking', label: 'Caminar' },
  { value: 'running', label: 'Correr' },
  { value: 'cycling', label: 'Bicicleta' },
  { value: 'gym', label: 'Gimnasio / entrenamiento' },
  { value: 'other', label: 'Otra' },
] as const

export type ActivityType = (typeof ACTIVITY_OPTIONS)[number]['value']

/** HU4 — Intensidad percibida del entrenamiento (docs/hu4-api.md). */
export const INTENSITY_OPTIONS = [
  { value: 'low', label: 'Baja', hint: 'Suave: podías hablar sin esfuerzo.' },
  { value: 'moderate', label: 'Moderada', hint: 'Exigente, pero a un ritmo cómodo.' },
  { value: 'high', label: 'Alta', hint: 'Muy exigente: te costaba hablar.' },
] as const

export type ActivityIntensity = (typeof INTENSITY_OPTIONS)[number]['value']

export interface ActivityFormValues {
  activityType: ActivityType | ''
  activityDate: string
  intensity: ActivityIntensity | ''
  notes: string
}

export interface ActivityPayload {
  activityType: ActivityType
  activityDate: string
  intensity: ActivityIntensity
  notes?: string
}

export interface Activity {
  id: number
  activityType: ActivityType
  activityDate: string
  notes: string | null
  /** null en registros anteriores a HU4. */
  intensity: ActivityIntensity | null
  createdAt: string
}
