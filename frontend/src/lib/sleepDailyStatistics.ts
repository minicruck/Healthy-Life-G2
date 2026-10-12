import type { SleepRecord } from '../types/sleep'

export interface SleepDay {
  date: string
  total: number
  count: number
  records: SleepRecord[]
  totals: { night: number; nap: number; other: number; unclassified: number }
}

/** Suma las representaciones decimales sin arrastrar el error de 0.1 + 0.2. */
function sumHours(values: number[]): number {
  if (values.length === 0) return 0
  const parts = values.map((value) => {
    const [coefficient, exponent = '0'] = String(value).split('e')
    const [whole, fraction = ''] = coefficient.split('.')
    return {
      integer: BigInt(whole + fraction),
      exponent: Number(exponent) - fraction.length,
    }
  })
  const scale = Math.min(...parts.map((part) => part.exponent))
  const total = parts.reduce(
    (sum, part) => sum + part.integer * 10n ** BigInt(part.exponent - scale),
    0n,
  )
  return Number(`${total}e${scale}`)
}

/** Cada fila se conserva; la agrupación solo añade una perspectiva por fecha. */
export function aggregateSleepDays(
  records: readonly SleepRecord[],
): SleepDay[] {
  const byDate = new Map<string, SleepRecord[]>()
  for (const record of records) {
    const group = byDate.get(record.sleepDate) ?? []
    group.push(record)
    byDate.set(record.sleepDate, group)
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entries]) => {
      const ordered = [...entries].sort((left, right) => left.id - right.id)
      const hoursFor = (type: SleepRecord['sleepType']) =>
        sumHours(
          ordered
            .filter((record) => record.sleepType === type)
            .map((record) => record.hoursSlept),
        )
      return {
        date,
        total: sumHours(ordered.map((record) => record.hoursSlept)),
        count: ordered.length,
        records: ordered,
        totals: {
          night: hoursFor('night'),
          nap: hoursFor('nap'),
          other: hoursFor('other'),
          unclassified: hoursFor(null),
        },
      }
    })
}

export function summarizeSleepDays(records: readonly SleepRecord[]) {
  const days = aggregateSleepDays(records)
  const total = sumHours(records.map((record) => record.hoursSlept))
  return {
    dayCount: days.length,
    total,
    average: days.length === 0 ? null : total / days.length,
  }
}
