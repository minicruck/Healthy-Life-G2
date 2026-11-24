import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getHydrationGoal } from '../services/hydrationGoal'
import { getSleepGoal } from '../services/sleepGoal'
import { getSleepRecords } from '../services/sleep'
import { getTrainingGoal } from '../services/trainingGoal'
import { getWaterToday, listWaterEntries } from '../services/water'
import './WeeklyCongratulations.css'

// Configurable schedule: Monday at 12:00.
export const WEEKLY_CONGRATULATION_SCHEDULE = {
  dayOfWeek: 1,
  hour: 12,
  minute: 0,
} as const

const USER_ID = 'demo-user'
const STORAGE_KEY = 'healthy-life-weekly-congratulations'
const ACKNOWLEDGED_KEY = 'healthy-life-weekly-congratulations-acknowledged'
const PENDING_KEY = 'healthy-life-weekly-congratulations-pending'

function weekKey(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const diff = start.getDay() === 0 ? -6 : 1 - start.getDay()
  start.setDate(start.getDate() + diff)
  return start.toISOString().slice(0, 10)
}

function getWeekDates(date: Date) {
  const start = new Date(date)
  start.setHours(12, 0, 0, 0)
  const diff = start.getDay() === 0 ? -6 : 1 - start.getDay()
  start.setDate(start.getDate() + diff)

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  })
}

function acknowledgedKey(meta: string, date: Date) {
  return `${USER_ID}:${weekKey(date)}:${meta}`
}

function isAcknowledged(meta: string, date: Date) {
  try {
    const keys = JSON.parse(localStorage.getItem(ACKNOWLEDGED_KEY) ?? '[]')
    return Array.isArray(keys) && keys.includes(acknowledgedKey(meta, date))
  } catch {
    return false
  }
}

function acknowledge(meta: string, date: Date) {
  try {
    const stored = JSON.parse(localStorage.getItem(ACKNOWLEDGED_KEY) ?? '[]')
    const keys = Array.isArray(stored) ? stored : []
    const key = acknowledgedKey(meta, date)
    if (!keys.includes(key)) {
      localStorage.setItem(ACKNOWLEDGED_KEY, JSON.stringify([...keys, key]))
    }
  } catch {
    localStorage.setItem(ACKNOWLEDGED_KEY, JSON.stringify([acknowledgedKey(meta, date)]))
  }
}

function savePending(goals: string[]) {
  if (goals.length > 0) localStorage.setItem(PENDING_KEY, JSON.stringify(goals))
}

function loadPending(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function isCongratulationTime(now: Date) {
  return (
    now.getDay() === WEEKLY_CONGRATULATION_SCHEDULE.dayOfWeek &&
    now.getHours() === WEEKLY_CONGRATULATION_SCHEDULE.hour &&
    now.getMinutes() === WEEKLY_CONGRATULATION_SCHEDULE.minute
  )
}

export default function WeeklyCongratulations() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function loadAchievements() {
    setLoading(true)
    setError(null)

    const now = new Date()
    const weekDates = getWeekDates(now)
    const results = await Promise.allSettled([
      getTrainingGoal(),
      getSleepGoal(),
      getSleepRecords(),
      getHydrationGoal(),
      getWaterToday(),
      listWaterEntries(),
    ])

    const goals: string[] = []

    if (
      results[0].status === 'fulfilled' &&
      results[0].value.daysPerWeek !== null &&
      results[0].value.remainingDays === 0 &&
      !isAcknowledged('activity', now)
    ) {
      const training = results[0].value
      goals.push(`Actividad: ${training.completedDays} de ${training.daysPerWeek} días cumplidos`)
    }

    if (results[1].status === 'fulfilled' && results[2].status === 'fulfilled') {
      const sleepGoal = results[1].value
      const sleepRecords = results[2].value
      if (sleepGoal.minHours !== null && !isAcknowledged('sleep', now)) {
        const totalsByDate = new Map<string, number>()
        for (const record of sleepRecords) {
          if (weekDates.includes(record.sleepDate)) {
            totalsByDate.set(record.sleepDate, (totalsByDate.get(record.sleepDate) ?? 0) + record.hoursSlept)
          }
        }
        const completedEveryDay = weekDates.every(
          (date) => (totalsByDate.get(date) ?? 0) >= sleepGoal.minHours!,
        )
        if (completedEveryDay) {
          goals.push(`Sueño: objetivo diario de ${sleepGoal.minHours} h alcanzado durante toda la semana`)
        }
      }
    }

    if (results[3].status === 'fulfilled' && results[5].status === 'fulfilled') {
      const hydrationGoal = results[3].value
      const entries = results[5].value
      if (hydrationGoal.litersPerDay !== null && !isAcknowledged('water', now)) {
        const totalsByDate = new Map<string, number>()
        for (const entry of entries) {
          if (weekDates.includes(entry.consumedDate)) {
            totalsByDate.set(entry.consumedDate, (totalsByDate.get(entry.consumedDate) ?? 0) + entry.amountMl)
          }
        }
        const completedEveryDay = weekDates.every(
          (date) => (totalsByDate.get(date) ?? 0) >= hydrationGoal.litersPerDay! * 1000,
        )
        if (completedEveryDay) {
          goals.push(`Hidratación: objetivo diario de ${hydrationGoal.litersPerDay} litros alcanzado durante toda la semana`)
        }
      }
    }

    setCompleted(goals)
    setLoading(false)

    if (results.every((result) => result.status === 'rejected')) {
      setError('No se han podido consultar tus objetivos en este momento.')
    }

    return goals
  }

  async function openManual() {
    const goals = await loadAchievements()
    setOpen(true)
    const now = new Date()
    if (goals.length > 0) savePending(goals)
    if (goals.some((goal) => goal.startsWith('Actividad:'))) acknowledge('activity', now)
    if (goals.some((goal) => goal.startsWith('Sueño:'))) acknowledge('sleep', now)
    if (goals.some((goal) => goal.startsWith('Hidratación:'))) acknowledge('water', now)
  }

  useLayoutEffect(() => {
    const element = dialog.current
    if (open) {
      if (typeof element?.showModal === 'function') element.showModal()
      else element?.setAttribute('open', '')
    } else if (typeof element?.close === 'function') {
      element.close()
    } else {
      element?.removeAttribute('open')
    }
  }, [open])

  useEffect(() => {
    const pending = loadPending()
    if (pending.length > 0) {
      setCompleted(pending)
      setOpen(true)
    }

    const checkSchedule = () => {
      const now = new Date()
      if (!isCongratulationTime(now)) return

      const key = `${USER_ID}:${weekKey(now)}`
      if (localStorage.getItem(STORAGE_KEY) === key) return

      void (async () => {
        const goals = await loadAchievements()
        if (goals.length === 0) return

        savePending(goals)
        for (const goal of goals) {
          if (goal.startsWith('Actividad:')) acknowledge('activity', now)
          if (goal.startsWith('Sueño:')) acknowledge('sleep', now)
          if (goal.startsWith('Hidratación:')) acknowledge('water', now)
        }
        localStorage.setItem(STORAGE_KEY, key)
        setOpen(true)
      })()
    }

    void checkSchedule()
    const interval = setInterval(checkSchedule, 30_000)
    return () => clearInterval(interval)
  }, [])

  function close() {
    localStorage.removeItem(PENDING_KEY)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="weekly-congratulations-trigger"
        aria-label="Abrir felicitación semanal"
        title="Felicitación semanal"
        onClick={() => void openManual()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v3M5.6 5.6l2.1 2.1M18.4 5.6l-2.1 2.1M3 12h3M18 12h3M7.5 10.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0Z" />
          <path d="M8.5 21h7M9.5 15.5h5l1 5.5h-7l1-5.5Z" />
        </svg>
      </button>

      <dialog
        ref={dialog}
        className="weekly-congratulations-dialog"
        aria-modal="true"
        aria-labelledby="weekly-congratulations-title"
        aria-describedby="weekly-congratulations-description"
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
      >
        <div className="weekly-congratulations-heading">
          <span className="weekly-congratulations-mark" aria-hidden="true">✦</span>
          <div>
            <p>RECONOCIMIENTO SEMANAL</p>
            <h2 id="weekly-congratulations-title">¡Buen trabajo, {USER_ID}!</h2>
          </div>
          <button type="button" className="weekly-congratulations-close" aria-label="Cerrar felicitación" onClick={close}>×</button>
        </div>

        <p id="weekly-congratulations-description" className="weekly-congratulations-intro">
          Estos son los objetivos que has completado:
        </p>

        {loading ? (
          <p className="weekly-congratulations-status" role="status">Consultando tus objetivos guardados…</p>
        ) : error ? (
          <div className="weekly-congratulations-error" role="alert"><p>{error}</p></div>
        ) : completed.length === 0 ? (
          <div className="weekly-congratulations-empty">
            <h3>Tu siguiente logro te espera</h3>
            <p>Aún no tienes objetivos completados. Sigue registrando tus hábitos y vuelve a consultarlo.</p>
          </div>
        ) : (
          <ul className="weekly-congratulations-list">
            {completed.map((goal) => (
              <li key={goal}><span aria-hidden="true">✓</span>{goal}</li>
            ))}
          </ul>
        )}

        <button type="button" className="weekly-congratulations-done" onClick={close}>Seguir avanzando</button>
      </dialog>
    </>
  )
}
