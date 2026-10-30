import FieldError from './FieldError'
import { useActivityForm } from '../hooks/useActivityForm'
import { ACTIVITY_OPTIONS, type ActivityType } from '../types/activity'

type ActivityFormProps = {
  onSaved?: () => void
  showHistory: boolean
  onToggleHistory: () => void
}

export default function ActivityForm({
  onSaved,
  showHistory,
  onToggleHistory,
}: ActivityFormProps) {
  const {
    values,
    submitting,
    feedback,
    validationNotice,
    form,
    update,
    blur,
    submit,
    visibleError,
  } = useActivityForm({ onSaved })
  return (
    <section className="form-panel" aria-labelledby="form-heading">
      <div className="form-heading">
        <h2 id="form-heading">Nuevo registro</h2>
        <span>
          <span aria-hidden="true">*</span> Campos obligatorios
        </span>
      </div>
      <form id="activity-form" ref={form} onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor="activityType">
            <span className="field-number" aria-hidden="true">
              01
            </span>{' '}
            Tipo de actividad{' '}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <div className="select-wrap">
            <select
              id="activityType"
              name="activityType"
              required
              value={values.activityType}
              disabled={submitting}
              onChange={(event) =>
                update('activityType', event.target.value as ActivityType | '')
              }
              onBlur={() => blur('activityType')}
              aria-invalid={Boolean(visibleError('activityType'))}
              aria-describedby={
                visibleError('activityType') ? 'activityType-error' : undefined
              }
            >
              <option value="" disabled>
                Selecciona una actividad
              </option>
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg
              className="select-chevron"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path d="m4 6 4 4 4-4" />
            </svg>
          </div>
          <FieldError
            id="activityType-error"
            message={visibleError('activityType')}
          />
        </div>

        <div className="form-field date-field">
          <label htmlFor="activityDate">
            <span className="field-number" aria-hidden="true">
              02
            </span>{' '}
            Fecha de la actividad{' '}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="activityDate"
            name="activityDate"
            type="date"
            required
            value={values.activityDate}
            disabled={submitting}
            onChange={(event) => update('activityDate', event.target.value)}
            onBlur={() => blur('activityDate')}
            aria-invalid={Boolean(visibleError('activityDate'))}
            aria-describedby={`date-hint${visibleError('activityDate') ? ' activityDate-error' : ''}`}
          />
          <p className="field-hint" id="date-hint">
            El día en que realizaste la actividad.
          </p>
          <FieldError
            id="activityDate-error"
            message={visibleError('activityDate')}
          />
        </div>

        <div className="form-field notes-field">
          <div className="label-row">
            <label htmlFor="notes">
              <span className="field-number" aria-hidden="true">
                03
              </span>{' '}
              Observaciones
            </label>
            <span className="optional-label">Opcional</span>
          </div>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="Por ejemplo, una caminata por el parque…"
            value={values.notes}
            disabled={submitting}
            onChange={(event) => update('notes', event.target.value)}
            onBlur={() => blur('notes')}
            aria-invalid={Boolean(visibleError('notes'))}
            aria-describedby={`notes-hint${visibleError('notes') ? ' notes-error' : ''}`}
          />
          <div className="notes-meta">
            <p className="field-hint" id="notes-hint">
              Un detalle que quieras recordar. Máximo 500 caracteres.
            </p>
            <span
              className={`character-count${values.notes.length > 500 ? ' over-limit' : ''}`}
              aria-hidden="true"
            >
              {values.notes.length}
              <span> / 500</span>
            </span>
          </div>
          <FieldError id="notes-error" message={visibleError('notes')} />
        </div>

        <div className="feedback-region">
          {validationNotice && (
            <p className="validation-notice" role="alert">
              Revisa los campos indicados antes de guardar.
            </p>
          )}
          {feedback?.kind === 'error' && (
            <div className="feedback feedback-error" role="alert">
              <span className="feedback-heading">
                No se ha confirmado el registro
              </span>
              <p>{feedback.message}</p>
            </div>
          )}
          <div role="status" aria-live="polite" aria-atomic="true">
            {feedback?.kind === 'success' && (
              <div className="feedback feedback-success">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
                <div>
                  <span className="feedback-heading">{feedback.message}</span>
                  <p>Puedes añadir una nueva actividad.</p>
                </div>
              </div>
            )}
            {submitting && (
              <span className="sr-only">
                Guardando actividad. Espera la confirmación.
              </span>
            )}
          </div>
        </div>

        <div className="form-actions">
          <p>
            Tu actividad,
            <br />
            <strong>un registro a la vez.</strong>
          </p>
          <div className="form-actions-group">
            <button
              className="secondary-button"
              type="button"
              onClick={onToggleHistory}
            >
              {showHistory ? 'Ocultar historial' : 'Ver historial'}
            </button>
            <button
              className="save-button"
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Guardando actividad…
                </>
              ) : (
                <>
                  Guardar actividad
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12h15m-6-6 6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
