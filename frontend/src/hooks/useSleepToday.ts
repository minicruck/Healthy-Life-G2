import { useEffect, useState } from 'react'
import {
  getMadridToday,
  millisecondsUntilNextMadridDay,
} from '../lib/sleepCalendar'

export function useSleepToday(active = true): string {
  const [today, setToday] = useState(getMadridToday)
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout>
    function updateDay() {
      clearTimeout(timer)
      const now = new Date()
      setToday(getMadridToday(now))
      timer = setTimeout(updateDay, millisecondsUntilNextMadridDay(now) + 20)
    }
    updateDay()
    document.addEventListener('visibilitychange', updateDay)
    window.addEventListener('focus', updateDay)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', updateDay)
      window.removeEventListener('focus', updateDay)
    }
  }, [active])
  return today
}
