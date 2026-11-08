export interface SleepQualityRecord {
  id: number
  sleepDate: string
  rating: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveSleepQualityInput {
  sleepDate: string
  rating: number
  notes?: string | null
  overwrite?: boolean
}

export interface SleepQualityConflictResponse {
  error: {
    code: 'ALREADY_EXISTS'
    message: string
  }
  existing: SleepQualityRecord
}
