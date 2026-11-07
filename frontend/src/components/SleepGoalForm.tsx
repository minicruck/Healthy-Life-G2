// HU10 — Fijar un objetivo mínimo de horas de sueño y ver su cumplimiento diario.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  formatDay,
  formatHours,
  getSleepGoal,
  saveSleepGoal,
  sleepAlertMessage,
  validateSleepGoalHours,
} from '../services/sleepGoal'
import type { SleepGoalSummary } from '../types/sleepGoal'
import './SleepGoalForm.css'

export default function SleepGoalForm() {
  const [summary, setSummary] = useState<SleepGoalSummary | null>(null)
  const [hours, setHours] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const current = await getSleepGoal()
      setSummary(current)
      setHours(current.minHours === null ? '' : String(current.minHours).replace('.', ','))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se ha podido cargar el objetivo de sueño.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSuccess(false)
    const validationError = validateSleepGoalHours(hours)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await saveSleepGoal(hours)
      setSummary(next)
      setSuccess(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el objetivo.')
    } finally {
      setSaving(false)
    }
  }

  const alert = summary ? sleepAlertMessage(summary) : null

  return (
    <section className="form-panel sleep-goal-layout" aria-labelledby="sleep-goal-title">
      <div className="form-heading">
        <h2 id="sleep-goal-title">Objetivo mínimo de sueño</h2>
        <span>Horas al día</span>
      </div>

      {alert && (
        <div className="sleep-goal-alert" role="alert">
          <strong>No has alcanzado tu objetivo de sueño</strong>
          {alert}
        </div>
      )}

      <div className="sleep-goal-summary" aria-live="polite">
        {loading ? (
          <p role="status">Cargando objetivo de sueño…</p>
        ) : summary?.minHours === null || (!summary && !error) ? (
          <div>
            <p>Todavía no tienes un objetivo mínimo de sueño.</p>
            <strong>Establece cuántas horas quieres dormir</strong>
          </div>
        ) : summary ? (
          <div>
            <p>Tu objetivo diario</p>
            <strong>{formatHours(summary.minHours ?? 0)} como mínimo</strong>
          </div>
        ) : null}

        {!loading && summary && (
          summary.days.length === 0 ? (
            <p className="sleep-goal-empty">
              Aún no hay registros de sueño en los últimos 7 días.
            </p>
          ) : (
            <ul className="sleep-goal-days" aria-label="Cumplimiento de los últimos 7 días">
              {summary.days.map((day) => (
                <li key={day.date}>
                  <span>{formatDay(day.date)}</span>
                  <span>{formatHours(day.totalHours)}</span>
                  {day.met === null ? (
                    <span>Sin objetivo</span>
                  ) : day.met ? (
                    <span className="met">Cumplido</span>
                  ) : (
                    <span className="missed">No cumplido</span>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <form onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor="sleep-goal-hours">
            Horas mínimas de sueño al día{' '}
            <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="sleep-goal-hours"
            name="sleepGoalHours"
            type="text"
            inputMode="decimal"
            required
            value={hours}
            placeholder="Por ejemplo, 8"
            onChange={(event) => {
              setHours(event.target.value)
              setError(null)
              setSuccess(false)
            }}
            disabled={loading || saving}
            aria-invalid={Boolean(error && validateSleepGoalHours(hours))}
            aria-describedby="sleep-goal-hint"
          />
          <p id="sleep-goal-hint" className="field-hint">
            Mayor que 0 y como máximo 24. Se suman todos los descansos del día, siestas incluidas.
          </p>
        </div>
        {error && (
          <p className="validation-notice sleep-goal-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="feedback feedback-success" role="status">
            Objetivo de sueño guardado correctamente.
          </p>
        )}
        <div className="form-actions">
          <button className="save-button" type="submit" disabled={loading || saving}>
            {saving ? 'Guardando…' : 'Guardar objetivo'}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void refresh()}
            disabled={loading || saving}
          >
            Actualizar
          </button>
        </div>
      </form>
    </section>
  )
}
