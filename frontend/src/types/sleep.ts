export const SLEEP_TYPE_OPTIONS = [
  { value: 'night', label: 'Sueño nocturno' },
  { value: 'nap', label: 'Siesta' },
  { value: 'other', label: 'Otro' },
] as const

export type SleepType = (typeof SLEEP_TYPE_OPTIONS)[number]['value']

export function isSleepType(value: unknown): value is SleepType {
  return SLEEP_TYPE_OPTIONS.some((option) => option.value === value)
}

export interface SleepFormValues {
  sleepDate: string
  hoursSlept: string
  sleepType: SleepType | ''
}

export interface SleepPayload {
  sleepDate: string
  hoursSlept: number
  sleepType: SleepType
}

export interface SleepRecord {
  id: number
  sleepDate: string
  hoursSlept: number
  sleepType: SleepType | null
  createdAt: string
}
