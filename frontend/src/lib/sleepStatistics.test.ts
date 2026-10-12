import { describe, expect, it } from 'vitest'
import type { SleepRecord } from '../types/sleep'
import {
  filterSleepRecords,
  formatSleepDate,
  formatSleepHours,
  summarizeSleep,
  type SleepPeriod,
} from './sleepStatistics'

function sleep(id: number, sleepDate: string, hoursSlept = 8): SleepRecord {
  return {
    id,
    sleepDate,
    hoursSlept,
    sleepType: 'night',
    createdAt: '2026-10-11T08:30:00.000Z',
  }
}

describe('filtering sleep records by local calendar day', () => {
  it('includes today and the previous six days, excluding older and future records', () => {
    const records = [
      sleep(5, '2026-10-12'),
      sleep(3, '2026-10-08'),
      sleep(1, '2026-10-04'),
      sleep(4, '2026-10-11'),
      sleep(2, '2026-10-05'),
    ]

    expect(filterSleepRecords(records, '7', '2026-10-11')).toEqual([
      records[4],
      records[1],
      records[3],
    ])
  })

  it('uses an inclusive 30-day window, not a calendar month', () => {
    const records = [
      sleep(1, '2026-02-13'),
      sleep(2, '2026-02-14'),
      sleep(3, '2026-03-01'),
      sleep(4, '2026-03-15'),
      sleep(5, '2026-03-16'),
    ]

    expect(filterSleepRecords(records, '30', '2026-03-15')).toEqual(
      records.slice(1, 4),
    )
  })

  it.each([
    ['2026-03-29', '2026-03-23', '2026-03-22'],
    ['2026-10-25', '2026-10-19', '2026-10-18'],
    ['2026-01-03', '2025-12-28', '2025-12-27'],
    ['0100-01-03', '0099-12-28', '0099-12-27'],
    ['9999-12-31', '9999-12-25', '9999-12-24'],
  ])(
    'keeps seven calendar days across DST or year boundaries ending %s',
    (today, firstIncluded, lastExcluded) => {
      const records = [
        sleep(1, lastExcluded),
        sleep(2, firstIncluded),
        sleep(3, today),
      ]

      expect(filterSleepRecords(records, '7', today)).toEqual(records.slice(1))
    },
  )

  it.each([
    ['2024-03-15', '2024-02-15', '2024-02-14'],
    ['2000-03-15', '2000-02-15', '2000-02-14'],
    ['1900-03-15', '1900-02-14', '1900-02-13'],
    ['2100-03-15', '2100-02-14', '2100-02-13'],
    ['2026-01-03', '2025-12-05', '2025-12-04'],
  ])(
    'accounts for Gregorian leap-year rules in the 30 days ending %s',
    (today, firstIncluded, lastExcluded) => {
      const records = [
        sleep(1, today),
        sleep(2, lastExcluded),
        sleep(3, firstIncluded),
      ]

      expect(filterSleepRecords(records, '30', today)).toEqual([
        records[2],
        records[0],
      ])
    },
  )

  it.each<SleepPeriod>(['7', '30'])(
    'clamps the %s-day window at year 0001 without inventing year zero',
    (period) => {
      const records = [
        sleep(1, '0001-01-01'),
        sleep(2, '0001-01-02'),
        sleep(3, '0001-01-03'),
        sleep(4, '0001-01-04'),
      ]

      expect(filterSleepRecords(records, period, '0001-01-03')).toEqual(
        records.slice(0, 3),
      )
      expect(filterSleepRecords(records, period, '0001-01-01')).toEqual([
        records[0],
      ])
    },
  )

  it('keeps every record for all time, including future and repeated dates', () => {
    const records = [
      sleep(9, '2026-10-10', 7),
      sleep(4, '9999-12-31', 8),
      sleep(2, '0001-01-01', 6),
      sleep(3, '2026-10-10', 9),
    ]

    expect(filterSleepRecords(records, 'all', '2026-10-11')).toEqual([
      records[2],
      records[3],
      records[0],
      records[1],
    ])
  })

  it('sorts by sleepDate and then id, without grouping duplicate dates', () => {
    const records = [
      sleep(20, '2026-10-10', 6),
      sleep(40, '2026-10-09', 8),
      sleep(3, '2026-10-10', 7),
    ]

    expect(filterSleepRecords(records, '7', '2026-10-11')).toEqual([
      records[1],
      records[2],
      records[0],
    ])
  })

  it.each<SleepPeriod>(['7', '30', 'all'])(
    'returns an independent array and never mutates frozen input (%s)',
    (period) => {
      const records = Object.freeze([
        Object.freeze(sleep(2, '2026-10-11')),
        Object.freeze(sleep(1, '2026-10-09')),
      ])
      const result = filterSleepRecords(records, period, '2026-10-11')

      expect(result).not.toBe(records)
      expect(result.map(({ id }) => id)).toEqual([1, 2])
      expect(records.map(({ id }) => id)).toEqual([2, 1])
    },
  )

  it.each<SleepPeriod>(['7', '30', 'all'])(
    'handles an empty collection (%s)',
    (period) => {
      expect(filterSleepRecords([], period, '2026-10-11')).toEqual([])
    },
  )

  it('returns an empty window when records exist only outside the chosen period', () => {
    expect(
      filterSleepRecords(
        [sleep(1, '2025-10-11'), sleep(2, '2026-10-12')],
        '7',
        '2026-10-11',
      ),
    ).toEqual([])
  })

  it.each(['', '0000-01-01', '2026-02-30', '2026-10-11T00:00:00Z'])(
    'rejects an invalid reference date rather than returning misleading data (%j)',
    (today) => {
      expect(() => filterSleepRecords([], '7', today)).toThrow(RangeError)
    },
  )
})

describe('sleep summary', () => {
  it('reports no average or extrema for an empty collection', () => {
    expect(summarizeSleep([])).toEqual({
      count: 0,
      total: 0,
      average: null,
      min: null,
      max: null,
    })
  })

  it('counts each record separately and averages records instead of calendar days', () => {
    const records = [
      sleep(1, '2026-10-09', 6),
      sleep(2, '2026-10-09', 7.5),
      sleep(3, '2026-10-11', 9),
    ]

    expect(summarizeSleep(records)).toEqual({
      count: 3,
      total: 22.5,
      average: 7.5,
      min: records[0],
      max: records[2],
    })
  })

  it('keeps decimal precision in calculations rather than rounding individual records', () => {
    const summary = summarizeSleep([
      sleep(1, '2026-10-10', 0.1),
      sleep(2, '2026-10-10', 0.2),
      sleep(3, '2026-10-10', 7.125),
    ])

    expect(summary.total).toBeCloseTo(7.425, 12)
    expect(summary.average).toBeCloseTo(2.475, 12)
  })

  it('uses the same record for minimum and maximum with one observation', () => {
    const record = sleep(1, '2026-10-10', 24)
    expect(summarizeSleep([record])).toEqual({
      count: 1,
      total: 24,
      average: 24,
      min: record,
      max: record,
    })
  })

  it('does not treat a tiny positive observation as an empty collection', () => {
    const record = sleep(1, '2026-10-10', Number.MIN_VALUE)
    expect(summarizeSleep([record])).toEqual({
      count: 1,
      total: Number.MIN_VALUE,
      average: Number.MIN_VALUE,
      min: record,
      max: record,
    })
  })

  it('breaks tied extrema by earliest sleep date, then smallest id, independent of input order', () => {
    const records = [
      sleep(5, '2026-10-11', 6),
      sleep(9, '2026-10-10', 6),
      sleep(2, '2026-10-10', 6),
      sleep(8, '2026-10-11', 9),
      sleep(7, '2026-10-10', 9),
      sleep(1, '2026-10-10', 9),
    ]

    for (const ordered of [records, [...records].reverse()]) {
      const summary = summarizeSleep(ordered)
      expect(summary.min).toBe(records[2])
      expect(summary.max).toBe(records[5])
    }
  })

  it('does not mutate a frozen collection or its records', () => {
    const records = Object.freeze([
      Object.freeze(sleep(2, '2026-10-11', 9)),
      Object.freeze(sleep(1, '2026-10-09', 6)),
    ])
    expect(summarizeSleep(records).total).toBe(15)
    expect(records.map(({ id }) => id)).toEqual([2, 1])
  })
})

describe('Spanish sleep formatting', () => {
  it.each([
    ['2026-10-09', '9 oct 2026', '9 oct'],
    ['2024-02-29', '29 feb 2024', '29 feb'],
    ['2026-03-29', '29 mar 2026', '29 mar'],
    ['2026-10-25', '25 oct 2026', '25 oct'],
    ['0001-01-01', '1 ene 0001', '1 ene'],
    ['0099-12-31', '31 dic 0099', '31 dic'],
    ['9999-12-31', '31 dic 9999', '31 dic'],
  ])(
    'formats the calendar date %s without changing the day',
    (date, full, short) => {
      expect(formatSleepDate(date)).toBe(full)
      expect(formatSleepDate(date, false)).toBe(short)
    },
  )

  it('does not silently format an impossible date', () => {
    expect(() => formatSleepDate('2026-02-30')).toThrow(RangeError)
  })

  it.each([
    [0, '0'],
    [7, '7'],
    [7.5, '7,5'],
    [7.125, '7,13'],
    [24, '24'],
    [12345.678, '12.345,68'],
    [0.01, '0,01'],
    [0.009, '<0,01'],
    [0.00001, '<0,01'],
    [Number.MIN_VALUE, '<0,01'],
  ])('formats summary hours %s as %s without false zeroes', (hours, text) => {
    expect(formatSleepHours(hours)).toBe(text)
  })

  it.each([
    [7, '7'],
    [7.5, '7,5'],
    [7.125, '7,125'],
    [0.00001, '0,00001'],
    [0.000000001, '1e-9'],
    [Number.MIN_VALUE, '5e-324'],
  ])(
    'preserves the stored numeric precision for record hours %s',
    (hours, text) => {
      expect(formatSleepHours(hours, true)).toBe(text)
      expect(Number(formatSleepHours(hours, true).replace(',', '.'))).toBe(
        hours,
      )
    },
  )
})
