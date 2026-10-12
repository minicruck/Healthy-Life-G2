const madridCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** HU2 comparte el día de Madrid con la API, independientemente del dispositivo. */
export function getMadridToday(now = new Date()): string {
  const parts = madridCalendar.formatToParts(now)
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === name)!.value
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`
}

/** Busca el siguiente cambio de calendario, incluso en días de 23 o 25 horas. */
export function millisecondsUntilNextMadridDay(now = new Date()): number {
  const start = now.getTime()
  const today = getMadridToday(now)
  let lower = start
  let upper = start + 27 * 60 * 60 * 1000
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2)
    if (getMadridToday(new Date(middle)) === today) lower = middle
    else upper = middle
  }
  return upper - start
}
