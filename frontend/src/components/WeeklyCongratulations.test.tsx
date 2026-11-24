import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isCongratulationTime } from './WeeklyCongratulations'

vi.mock('../services/trainingGoal', () => ({
  getTrainingGoal: vi.fn(),
}))
vi.mock('../services/sleepGoal', () => ({
  getSleepGoal: vi.fn(),
}))
vi.mock('../services/sleep', () => ({
  getSleepRecords: vi.fn(),
}))
vi.mock('../services/hydrationGoal', () => ({
  getHydrationGoal: vi.fn(),
}))
vi.mock('../services/water', () => ({
  getWaterToday: vi.fn(),
  listWaterEntries: vi.fn(),
}))

import WeeklyCongratulations from './WeeklyCongratulations'
import { getTrainingGoal } from '../services/trainingGoal'
import { getSleepGoal } from '../services/sleepGoal'
import { getSleepRecords } from '../services/sleep'
import { getHydrationGoal } from '../services/hydrationGoal'
import { getWaterToday, listWaterEntries } from '../services/water'

beforeEach(() => {
  vi.mocked(getTrainingGoal).mockResolvedValue({
    daysPerWeek: null,
    completedDays: 0,
    remainingDays: null,
    weekStart: '2026-11-23',
    weekEnd: '2026-11-29',
    updatedAt: null,
  })
  vi.mocked(getSleepGoal).mockResolvedValue({
    minHours: 8,
    updatedAt: null,
    fromDate: '2026-11-18',
    toDate: '2026-11-24',
    days: [],
    latest: null,
    checked: null,
    alert: false,
  })
  vi.mocked(getSleepRecords).mockResolvedValue([
    { id: 1, sleepDate: '2026-11-24', hoursSlept: 8, sleepType: 'night', createdAt: '2026-11-24T10:00:00Z' },
  ])
  vi.mocked(getHydrationGoal).mockResolvedValue({ litersPerDay: 2, updatedAt: null })
  vi.mocked(getWaterToday).mockResolvedValue({ date: '2026-11-24', totalMl: 2000 })
  vi.mocked(listWaterEntries).mockResolvedValue([
    { id: 1, amountMl: 2000, consumedDate: '2026-11-24', createdAt: '2026-11-24T10:00:00Z' },
  ])
})

afterEach(() => cleanup())

describe('WeeklyCongratulations', () => {
  it('uses the configurable Monday noon schedule', () => {
    expect(isCongratulationTime(new Date(2026, 10, 23, 12, 0))).toBe(true)
    expect(isCongratulationTime(new Date(2026, 10, 24, 12, 0))).toBe(false)
  })

  it('reloads sleep and water goals before showing manual achievements', async () => {
    const user = userEvent.setup()
    render(<WeeklyCongratulations />)

    await user.click(screen.getByRole('button', { name: 'Abrir felicitación semanal' }))

    expect(await screen.findByText(/Sueño: 1 día cumplido/i)).toBeInTheDocument()
    expect(screen.getByText(/Hidratación diaria: 2 litros cumplidos hoy/i)).toBeInTheDocument()
    expect(getSleepGoal).toHaveBeenCalledTimes(1)
    expect(getSleepRecords).toHaveBeenCalledTimes(1)
    expect(getHydrationGoal).toHaveBeenCalledTimes(1)
    expect(getWaterToday).toHaveBeenCalledTimes(1)
  })
})
