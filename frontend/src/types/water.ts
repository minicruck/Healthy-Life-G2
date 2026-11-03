export interface WaterFormValues {
  amountMl: string
}

export interface WaterPayload {
  amountMl: number
}

export interface WaterEntry extends WaterPayload {
  id: number
  consumedDate: string
  createdAt: string
}

export interface WaterDailyTotal {
  date: string
  totalMl: number
}
