// HU10 en la pantalla de sueño:
// - CA3: si no hay objetivo, lo indica y sugiere configurarlo.
// - CA4: al guardar un registro que deja el día por debajo del objetivo, muestra una notificación.
import { useEffect, useState } from 'react'
import { getSleepGoal, sleepAlertMessage } from '../services/sleepGoal'
import type { SleepGoalSummary } from '../types/sleepGoal'
import './SleepGoalForm.css'

type Props = {
  active: boolean
  /** Cambia cada vez que se guarda un registro de sueño. */
  revision: number
  onConfigure: () => void
}

export default function SleepGoalNotice({ active, revision, onConfigure }: Props) {
  const [summary, setSummary] = useState<SleepGoalSummary | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    getSleepGoal()
      .then((next) => {
        if (!cancelled) setSummary(next)
      })
      .catch(() => {
        // Un fallo del aviso nunca debe impedir registrar horas de sueño.
        if (!cancelled) setSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [active, revision])

  if (!active || summary === null) return null

  if (summary.minHours === null) {
    return (
      <div className="sleep-goal-hint" role="status">
        <span>Aún no has establecido un objetivo mínimo de sueño.</span>
        <button type="button" className="secondary-button" onClick={onConfigure}>
          Configurar objetivo
        </button>
      </div>
    )
  }

  const message = sleepAlertMessage(summary)
  if (!message) return null
  return (
    <div className="sleep-goal-alert" role="alert">
      <strong>No has alcanzado tu objetivo de sueño</strong>
      {message}
    </div>
  )
}
