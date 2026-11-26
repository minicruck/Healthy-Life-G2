import { useEffect, useState, type FormEvent } from 'react'
import { getHydrationGoal, saveHydrationGoal } from '../services/hydrationGoal'

export default function HydrationGoalForm() {
  const [value, setValue] = useState('')
  const [savedGoal, setSavedGoal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    getHydrationGoal()
      .then((goal) => {
        if (!active) return
        setSavedGoal(goal.litersPerDay)
        setValue(goal.litersPerDay === null ? '' : String(goal.litersPerDay))
      })
      .catch(() => {
        if (active) setLoadError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const litersPerDay = Number(value.trim())
    if (!value.trim() || !Number.isFinite(litersPerDay) || litersPerDay <= 0) {
      setSuccess(false)
      setError('Introduce una meta mayor que 0 litros.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const goal = await saveHydrationGoal(litersPerDay)
      setSavedGoal(goal.litersPerDay)
      setValue(String(goal.litersPerDay))
      setSuccess(true)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se ha podido guardar la meta de agua.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className="form-panel hydration-goal-panel"
      aria-labelledby="hydration-goal-heading"
    >
      <div className="form-heading">
        <h2 id="hydration-goal-heading">Objetivo diario</h2>
        <span>Meta de hidratación</span>
      </div>
      {loading ? (
        <p className="field-hint" role="status">
          Cargando tu meta…
        </p>
      ) : loadError ? (
        <>
          <p className="validation-notice" role="alert">
            No se ha podido cargar la meta de agua.
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setAttempt((count) => count + 1)}
          >
            Reintentar consulta de la meta
          </button>
        </>
      ) : (
        <>
          <div className="goal-status" aria-live="polite">
            {savedGoal === null
              ? 'Todavía no tienes un objetivo definido.'
              : `Tu objetivo actual es ${savedGoal.toLocaleString('es-ES', { maximumFractionDigits: 20 })} ${savedGoal === 1 ? 'litro' : 'litros'} al día.`}
          </div>
          <form onSubmit={submit} noValidate>
            <div className="form-field">
              <label htmlFor="hydration-goal">
                <span className="field-number" aria-hidden="true">
                  01
                </span>
                Litros de agua al día
                <span className="required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="hydration-goal"
                name="hydrationGoal"
                type="number"
                required
                min="0"
                step="0.1"
                inputMode="decimal"
                placeholder="Por ejemplo, 2"
                value={value}
                disabled={submitting}
                onChange={(event) => {
                  setValue(event.target.value)
                  setError(null)
                  setSuccess(false)
                }}
                aria-invalid={Boolean(error && !(Number(value) > 0))}
                aria-describedby={
                  error
                    ? 'hydration-goal-hint hydration-goal-error'
                    : 'hydration-goal-hint'
                }
              />
              <p className="field-hint" id="hydration-goal-hint">
                Introduce un número mayor que 0. Puedes usar decimales.
              </p>
            </div>
            {error && (
              <p
                id="hydration-goal-error"
                className="validation-notice"
                role="alert"
              >
                {error}
              </p>
            )}
            {success && (
              <div className="feedback feedback-success" role="status">
                <span className="feedback-heading">
                  Meta guardada correctamente.
                </span>
              </div>
            )}
            <div className="form-actions">
              <button
                className="save-button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Guardando…' : 'Guardar objetivo'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
