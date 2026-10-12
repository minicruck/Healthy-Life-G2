import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { getMadridToday, millisecondsUntilNextMadridDay } from './sleepCalendar'
import { useSleepToday } from '../hooks/useSleepToday'

afterEach(() => vi.useRealTimers())

describe('calendario de sueño en Europe/Madrid', () => {
  it.each([
    ['2026-10-11T21:59:59.999Z', '2026-10-11'],
    ['2026-10-11T22:00:00.000Z', '2026-10-12'],
    ['2026-12-31T22:59:59.999Z', '2026-12-31'],
    ['2026-12-31T23:00:00.000Z', '2027-01-01'],
    ['2026-03-29T00:59:59.999Z', '2026-03-29'],
    ['2026-03-29T01:00:00.000Z', '2026-03-29'],
    ['2026-10-25T00:59:59.999Z', '2026-10-25'],
    ['2026-10-25T01:00:00.000Z', '2026-10-25'],
    ['2024-02-28T23:00:00.000Z', '2024-02-29'],
  ])(
    'interpreta %s como %s sin depender de la zona del proceso',
    (instant, day) => {
      expect(getMadridToday(new Date(instant))).toBe(day)
    },
  )

  it.each([
    ['2026-03-28T23:00:00.000Z', 23 * 60 * 60 * 1000],
    ['2026-10-24T22:00:00.000Z', 25 * 60 * 60 * 1000],
    ['2026-10-11T21:59:59.000Z', 1000],
  ])('calcula la próxima medianoche desde %s', (instant, duration) => {
    expect(millisecondsUntilNextMadridDay(new Date(instant))).toBe(duration)
  })

  it('actualiza el día sin recargar y cancela el temporizador al desmontar', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T21:59:59.000Z'))
    const { result, unmount } = renderHook(() => useSleepToday())
    expect(result.current).toBe('2026-10-11')
    act(() => vi.advanceTimersByTime(1020))
    expect(result.current).toBe('2026-10-12')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
