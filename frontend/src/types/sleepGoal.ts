export type SleepDayCompliance = {
  date: string
  totalHours: number
  /** null cuando todavía no hay objetivo configurado. */
  met: boolean | null
}

export type SleepGoalSummary = {
  minHours: number | null
  updatedAt: string | null
  fromDate: string
  toDate: string
  days: SleepDayCompliance[]
  latest: SleepDayCompliance | null
  /** Día sobre el que se evalúa el aviso (el pedido con ?date= o, si no, `latest`). */
  checked: SleepDayCompliance | null
  alert: boolean
}
