import FieldError from './FieldError'
import { useSleepForm } from '../hooks/useSleepForm'
import { SLEEP_TYPE_OPTIONS, type SleepRecord } from '../types/sleep'

type SleepFormProps = { onSaved?: (record: SleepRecord) => void }

export default function SleepForm({ onSaved }: SleepFormProps = {}) {
  const {
    today,
    values,
    submitting,
    feedback,
    validationNotice,
    form,
    update,
    blur,
    submit,
    visibleError,
  } = useSleepForm(onSaved)

  return (
    <section
      className="form-panel sleep-form-panel"
      aria-labelledby="sleep-form-heading"
    >
      <div className="form-heading">
        <h2 id="sleep-form-heading">Nuevo registro</h2>
        <span>
          <span aria-hidden="true">*</span> Campos obligatorios
        </span>
      </div>
      <form id="sleep-form" ref={form} onSubmit={submit} noValidate>
        <div className="form-field date-field">
          <label htmlFor="sleepDate">
            <span className="field-number" aria-hidden="true">
              01
            </span>{' '}
            Fecha del sueño{' '}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="sleepDate"
            name="sleepDate"
            type="date"
            max={today}
            required
            value={values.sleepDate}
            disabled={submitting}
            onChange={(event) => update('sleepDate', event.target.value)}
            onBlur={() => blur('sleepDate')}
            aria-invalid={Boolean(visibleError('sleepDate'))}
            aria-describedby={`sleep-date-hint${visibleError('sleepDate') ? ' sleepDate-error' : ''}`}
          />
          <p className="field-hint" id="sleep-date-hint">
            El día al que corresponde tu descanso. Hasta hoy, según
            Europe/Madrid.
          </p>
          <div className="sleep-field-error">
            <FieldError
              id="sleepDate-error"
              message={visibleError('sleepDate')}
            />
          </div>
        </div>

        <div className="form-field sleep-hours-field">
          <label htmlFor="hoursSlept">
            <span className="field-number" aria-hidden="true">
              02
            </span>{' '}
            Horas dormidas{' '}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="hoursSlept"
            name="hoursSlept"
            type="number"
            inputMode="decimal"
            min="0"
            max="24"
            step="any"
            required
            value={values.hoursSlept}
            disabled={submitting}
            onChange={(event) => update('hoursSlept', event.target.value)}
            onBlur={() => blur('hoursSlept')}
            aria-invalid={Boolean(visibleError('hoursSlept'))}
            aria-describedby={`sleep-hours-hint${visibleError('hoursSlept') ? ' hoursSlept-error' : ''}`}
          />
          <p className="field-hint" id="sleep-hours-hint">
            Más de 0 y hasta 24 horas. Puedes usar decimales, por ejemplo 7.5.
          </p>
          <div className="sleep-field-error">
            <FieldError
              id="hoursSlept-error"
              message={visibleError('hoursSlept')}
            />
          </div>
        </div>

        <div className="form-field sleep-type-field">
          <label htmlFor="sleepType">
            <span className="field-number" aria-hidden="true">
              03
            </span>{' '}
            Tipo de descanso{' '}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <div className="select-wrap">
            <select
              id="sleepType"
              name="sleepType"
              required
              value={values.sleepType}
              disabled={submitting}
              onChange={(event) => update('sleepType', event.target.value)}
              onBlur={() => blur('sleepType')}
              aria-invalid={Boolean(visibleError('sleepType'))}
              aria-describedby={
                visibleError('sleepType') ? 'sleepType-error' : undefined
              }
            >
              <option value="" disabled>
                Selecciona un tipo de descanso
              </option>
              {SLEEP_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
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
          <div className="sleep-field-error">
            <FieldError
              id="sleepType-error"
              message={visibleError('sleepType')}
            />
          </div>
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
                  <p>Puedes añadir un nuevo registro de sueño.</p>
                </div>
              </div>
            )}
            {submitting && (
              <span className="sr-only">
                Guardando horas de sueño. Espera la confirmación.
              </span>
            )}
          </div>
        </div>

        <div className="form-actions">
          <p>
            Tu descanso,
            <br />
            <strong>un registro a la vez.</strong>
          </p>
          <button
            className="save-button"
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <span className="button-spinner" aria-hidden="true" />
                Guardando horas de sueño…
              </>
            ) : (
              <>
                Guardar horas de sueño
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12h15m-6-6 6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}
