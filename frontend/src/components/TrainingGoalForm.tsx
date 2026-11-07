import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  getTrainingGoal,
  saveTrainingGoal,
  validateTrainingDays,
} from '../services/trainingGoal'
import type { TrainingGoalSummary } from '../types/trainingGoal'
import './TrainingGoalForm.css'

export default function TrainingGoalForm() {
  const [summary, setSummary] = useState<TrainingGoalSummary | null>(null)
  const [days, setDays] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const current = await getTrainingGoal()
      setSummary(current)
      setDays(current.daysPerWeek === null ? '' : String(current.daysPerWeek))
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se ha podido cargar el objetivo semanal.',
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
    const validationError = validateTrainingDays(days)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await saveTrainingGoal(days)
      setSummary(next)
      setDays(String(next.daysPerWeek))
      setSuccess(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el objetivo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="form-panel training-goal-layout" aria-labelledby="training-goal-title">
      <div className="form-heading">
        <h2 id="training-goal-title">Objetivo semanal de entrenamiento</h2>
        <span>De lunes a domingo</span>
      </div>
      <div className="training-goal-summary" aria-live="polite">
        {loading ? (
          <p role="status">Cargando progreso semanal…</p>
        ) : summary?.daysPerWeek === null || (!summary && !error) ? (
          <div>
            <p>Todavía no tienes un objetivo de entrenamiento definido.</p>
            <strong>Establece tu meta semanal</strong>
          </div>
        ) : summary ? (
          <div>
            <p>Progreso de esta semana</p>
            <strong>
              {summary.completedDays} de {summary.daysPerWeek} días
            </strong>
            <p>
              {summary.remainingDays === 0
                ? '¡Has alcanzado tu objetivo semanal!'
                : `Te quedan ${summary.remainingDays} ${summary.remainingDays === 1 ? 'día' : 'días'} para cumplirlo.`}
            </p>
            <progress
              max={summary.daysPerWeek ?? 1}
              value={Math.min(summary.completedDays, summary.daysPerWeek ?? 1)}
              aria-label="Progreso del objetivo semanal"
            />
            <small>
              Cada fecha con actividad cuenta una vez. Semana del {summary.weekStart} al{' '}
              {summary.weekEnd}.
            </small>
          </div>
        ) : null}
      </div>
      <form onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor="training-days">
            Días de entrenamiento por semana <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="training-days"
            name="trainingDays"
            type="number"
            min="1"
            max="7"
            step="1"
            required
            value={days}
            placeholder="Por ejemplo, 3"
            onChange={(event) => {
              setDays(event.target.value)
              setError(null)
              setSuccess(false)
            }}
            disabled={loading || saving}
            aria-invalid={Boolean(error && validateTrainingDays(days))}
            aria-describedby="training-days-hint"
          />
          <p id="training-days-hint" className="field-hint">
            Introduce un número entero de 1 a 7. Varias actividades el mismo día cuentan como un día.
          </p>
        </div>
        {error && <p className="validation-notice training-goal-error" role="alert">{error}</p>}
        {success && (
          <p className="feedback feedback-success" role="status">
            Objetivo semanal guardado correctamente.
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
            Actualizar progreso
          </button>
        </div>
      </form>
    </section>
  )
}
