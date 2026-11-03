import FieldError from './FieldError'
import { useWaterForm } from '../hooks/useWaterForm'
import { useState } from 'react'
import { useWaterHistory } from '../hooks/useWaterHistory'
import { useWaterSummary } from '../hooks/useWaterSummary'

type WaterFormProps = { active: boolean }

export default function WaterForm({ active }: WaterFormProps) {
  const { state: summary, refresh } = useWaterSummary(active)
  const [historyRevision, setHistoryRevision] = useState(0)
  const history = useWaterHistory(active, historyRevision)
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
  } = useWaterForm(() => {
    refresh()
    setHistoryRevision((revision) => revision + 1)
  })

  return (
    <div className="water-panel-stack">
      <section className="form-panel" aria-labelledby="water-form-heading">
        <div className="form-heading">
          <h2 id="water-form-heading">Consumo de hoy</h2>
          <span>
            <span aria-hidden="true">*</span> Campo obligatorio
          </span>
        </div>
        <div className="water-summary" aria-live="polite">
          {summary.status === 'loading' && !summary.value && (
            <p role="status">Cargando el total de hoy…</p>
          )}
          {summary.value && (
            <p>
              Total diario{' '}
              <strong>
                {summary.value.totalMl.toLocaleString('es-ES')} ml
              </strong>
            </p>
          )}
          {summary.status === 'error' && (
            <p className="water-summary-error" role="alert">
              {summary.message}
            </p>
          )}
        </div>
        <form id="water-form" ref={form} onSubmit={submit} noValidate>
          <div className="form-field">
            <label htmlFor="amountMl">
              <span className="field-number" aria-hidden="true">
                01
              </span>{' '}
              Cantidad de agua (ml){' '}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="amountMl"
              name="amountMl"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required
              placeholder="Por ejemplo, 250"
              value={values.amountMl}
              disabled={submitting}
              onChange={(event) => update(event.target.value)}
              onBlur={blur}
              aria-invalid={Boolean(visibleError)}
              aria-describedby={`water-amount-hint${visibleError ? ' amountMl-error' : ''}`}
            />
            <p className="field-hint" id="water-amount-hint">
              Registra la cantidad en mililitros. Se sumará al total de hoy.
            </p>
            <FieldError id="amountMl-error" message={visibleError} />
          </div>

          <div className="feedback-region">
            {validationNotice && (
              <p className="validation-notice" role="alert">
                Revisa la cantidad antes de añadirla al total.
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
                    <p>Puedes añadir otro consumo de agua.</p>
                  </div>
                </div>
              )}
              {submitting && (
                <span className="sr-only">
                  Guardando consumo de agua. Espera la confirmación.
                </span>
              )}
            </div>
          </div>

          <div className="form-actions">
            <p>
              Tu hidratación,
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
                  Añadiendo agua…
                </>
              ) : (
                <>
                  Añadir al total
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12h15m-6-6 6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </section>
      <section
        className="water-history form-panel"
        aria-labelledby="water-history-heading"
      >
        <div className="form-heading">
          <h2 id="water-history-heading">Historial de hidratación</h2>
          <span>
            {history.entries?.length ?? 0}{' '}
            {(history.entries?.length ?? 0) === 1 ? 'registro' : 'registros'}
          </span>
        </div>
        {history.status === 'loading' && history.entries === null && (
          <p role="status">Cargando el historial…</p>
        )}
        {history.status === 'error' && (
          <div className="water-history-error">
            <p role="alert">{history.message}</p>
            <button
              type="button"
              className="sleep-text-button"
              onClick={history.retry}
            >
              Reintentar consulta
            </button>
          </div>
        )}
        {history.status === 'ready' && history.entries.length === 0 && (
          <p className="water-history-empty">
            Aún no hay consumos registrados.
          </p>
        )}
        {history.entries && history.entries.length > 0 && (
          <ul className="water-history-list">
            {history.entries.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.consumedDate}>
                  {new Date(
                    `${entry.consumedDate}T12:00:00Z`,
                  ).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </time>
                <strong>{entry.amountMl.toLocaleString('es-ES')} ml</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
