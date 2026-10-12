import { describe, expect, it } from 'vitest'
import { aggregateSleepDays, summarizeSleepDays } from './sleepDailyStatistics'
import { filterSleepRecords, summarizeSleep } from './sleepStatistics'
import type { SleepRecord } from '../types/sleep'

const entry = (
  id: number,
  date: string,
  hours: number,
  type: SleepRecord['sleepType'] = 'night',
): SleepRecord => ({
  id,
  sleepDate: date,
  hoursSlept: hours,
  sleepType: type,
  createdAt: '2026-10-12T10:00:00.000Z',
})
const sample = [
  entry(1, '2026-10-12', 7),
  entry(2, '2026-10-12', 1.5, 'nap'),
  entry(3, '2026-10-12', 1, 'other'),
  entry(4, '2026-10-11', 8),
]

describe('totales diarios sin perder registros individuales', () => {
  it('resuelve el ejemplo completo y distingue media por registro y por día', () => {
    const days = aggregateSleepDays(sample)
    expect(
      days.map(({ date, total, count }) => ({ date, total, count })),
    ).toEqual([
      { date: '2026-10-11', total: 8, count: 1 },
      { date: '2026-10-12', total: 9.5, count: 3 },
    ])
    expect(days[1].totals).toEqual({
      night: 7,
      nap: 1.5,
      other: 1,
      unclassified: 0,
    })
    expect(days[1].records).toEqual(sample.slice(0, 3))
    expect(summarizeSleep(sample)).toMatchObject({
      total: 17.5,
      count: 4,
      average: 4.375,
    })
    expect(summarizeSleepDays(sample)).toEqual({
      total: 17.5,
      dayCount: 2,
      average: 8.75,
    })
  })

  it('recalcula una siesta editada sin crear filas', () => {
    const edited = sample.map((record) =>
      record.id === 2 ? { ...record, hoursSlept: 2 } : record,
    )
    expect(aggregateSleepDays(edited)[1].total).toBe(10)
    expect(summarizeSleep(edited)).toMatchObject({
      total: 18,
      count: 4,
      average: 4.5,
    })
    expect(summarizeSleepDays(edited)).toEqual({
      total: 18,
      dayCount: 2,
      average: 9,
    })
    expect(sample[1].hoursSlept).toBe(1.5)
  })

  it('reagrupa al cambiar la fecha y actualiza los filtros sin eliminar la fila', () => {
    const edited = sample.map((record) =>
      record.id === 2 ? { ...record, sleepDate: '2026-09-01' } : record,
    )
    expect(aggregateSleepDays(edited).map((day) => day.total)).toEqual([
      1.5, 8, 8,
    ])
    const selected = filterSleepRecords(edited, '7', '2026-10-12')
    expect(selected).toHaveLength(3)
    expect(summarizeSleepDays(selected)).toEqual({
      total: 16,
      dayCount: 2,
      average: 8,
    })
    expect(filterSleepRecords(edited, 'all', '2026-10-12')).toHaveLength(4)
  })

  it('no inventa ceros ni medias en una lista vacía', () => {
    expect(aggregateSleepDays([])).toEqual([])
    expect(summarizeSleepDays([])).toEqual({
      total: 0,
      dayCount: 0,
      average: null,
    })
  })

  it('un registro antiguo se conserva sin clasificar y sin inventar su tipo', () => {
    const record = entry(8, '2026-01-01', 7.5, null)
    expect(aggregateSleepDays([record])[0]).toEqual({
      date: '2026-01-01',
      total: 7.5,
      count: 1,
      records: [record],
      totals: { night: 0, nap: 0, other: 0, unclassified: 7.5 },
    })
    expect(summarizeSleepDays([record]).average).toBe(7.5)
  })

  it('conserva varias siestas, identificadores y totales superiores a 24', () => {
    const records = [
      entry(3, '2026-10-12', 20, 'nap'),
      entry(2, '2026-10-12', 8, 'nap'),
    ]
    const [day] = aggregateSleepDays(records)
    expect(day.total).toBe(28)
    expect(day.totals.nap).toBe(28)
    expect(day.records.map((record) => record.id)).toEqual([2, 3])
    expect(records.map((record) => record.id)).toEqual([3, 2])
  })

  it.each([
    [[0.1, 0.2], 0.3],
    [[0.01, 0.02, 0.03], 0.06],
    [[1e-7, 2e-7], 3e-7],
    [[7, 1.5, 1], 9.5],
  ] as [number[], number][])(
    'suma decimales %j sin artefactos',
    (hours, total) => {
      const records = hours.map((value, index) =>
        entry(index + 1, '2026-10-12', value),
      )
      expect(aggregateSleepDays(records)[0].total).toBe(total)
      expect(summarizeSleepDays(records).total).toBe(total)
    },
  )

  it('ordena las fechas a través de años y no crea días intermedios', () => {
    const records = [
      entry(3, '2027-01-01', 8),
      entry(2, '2026-12-31', 7),
      entry(1, '0001-01-01', 1),
    ]
    expect(aggregateSleepDays(records).map((day) => day.date)).toEqual([
      '0001-01-01',
      '2026-12-31',
      '2027-01-01',
    ])
    expect(summarizeSleepDays(records).dayCount).toBe(3)
  })

  it.each(['7', '30'] as const)(
    'la agrupación respeta el filtro %s sin incluir fechas futuras',
    (period) => {
      const selected = filterSleepRecords(
        [...sample, entry(5, '2026-10-13', 9), entry(6, '2025-10-12', 12)],
        period,
        '2026-10-12',
      )
      expect(summarizeSleepDays(selected)).toEqual({
        total: 17.5,
        dayCount: 2,
        average: 8.75,
      })
    },
  )

  it('todo el historial incluye las fechas futuras guardadas anteriormente', () => {
    const records = filterSleepRecords(
      [...sample, entry(5, '2099-01-01', 7, null)],
      'all',
      '2026-10-12',
    )
    expect(summarizeSleepDays(records)).toEqual({
      total: 24.5,
      dayCount: 3,
      average: 24.5 / 3,
    })
  })
})
