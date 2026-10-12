import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useSleepEdit } from '../hooks/useSleepEdit'
import { SLEEP_TYPE_OPTIONS, type SleepRecord } from '../types/sleep'
import FieldError from './FieldError'
import './SleepEditDialog.css'

type SleepEditDialogProps = {
  record: SleepRecord
  onClose: () => void
  onSaved: (record: SleepRecord) => void
}

/** Mount one dialog per record, keyed by record.id. Native modal mode makes the page inert. */
export default function SleepEditDialog({
  record,
  onClose,
  onSaved,
}: SleepEditDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const {
    today,
    values,
    submitting,
    error,
    validationNotice,
    form,
    update,
    blur,
    submit,
    visibleError,
  } = useSleepEdit(record, onSaved)

  useLayoutEffect(() => {
    const element = dialog.current
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    element?.showModal()
    element?.querySelector<HTMLInputElement>('input')?.focus()
    return () => {
      element?.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  function handleKeys(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (!submitting) onClose()
      return
    }
    if (event.key !== 'Tab') return
    const elements = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
      ),
    ]
    const first = elements[0]
    const last = elements.at(-1)
    if (!first) {
      event.preventDefault()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <dialog
      ref={dialog}
      className="sleep-edit-dialog"
      aria-modal="true"
      aria-labelledby="sleep-edit-title"
      aria-describedby="sleep-edit-description"
      onKeyDown={handleKeys}
      onCancel={(event) => {
        event.preventDefault()
        if (!submitting) onClose()
      }}
    >
      <header className="sleep-edit-heading">
        <div>
          <p>REGISTRO #{record.id}</p>
          <h2 id="sleep-edit-title">Editar descanso</h2>
        </div>
        <button
          type="button"
          className="sleep-edit-close"
          aria-label="Cerrar edición"
          onClick={onClose}
          disabled={submitting}
        >
          ×
        </button>
      </header>
      <p id="sleep-edit-description">
        Corrige la fecha, las horas o el tipo. Los cambios se aplican al mismo
        registro cuando el servidor los confirma.
      </p>
      <form ref={form} onSubmit={submit} noValidate>
        <div className="form-field date-field">
          <label htmlFor="edit-sleepDate">
            Fecha del sueño <span aria-hidden="true">*</span>
          </label>
          <input
            id="edit-sleepDate"
            name="sleepDate"
            type="date"
            max={today}
            required
            value={values.sleepDate}
            disabled={submitting}
            onChange={(event) => update('sleepDate', event.target.value)}
            onBlur={() => blur('sleepDate')}
            aria-invalid={Boolean(visibleError('sleepDate'))}
            aria-describedby={`edit-date-hint${visibleError('sleepDate') ? ' edit-sleepDate-error' : ''}`}
          />
          <p className="field-hint" id="edit-date-hint">
            Hasta hoy, según el calendario de Europe/Madrid.
          </p>
          <div className="sleep-field-error">
            <FieldError
              id="edit-sleepDate-error"
              message={visibleError('sleepDate')}
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="edit-hoursSlept">
            Horas dormidas <span aria-hidden="true">*</span>
          </label>
          <input
            id="edit-hoursSlept"
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
            aria-describedby={`edit-hours-hint${visibleError('hoursSlept') ? ' edit-hoursSlept-error' : ''}`}
          />
          <p className="field-hint" id="edit-hours-hint">
            Más de 0 y hasta 24 horas. Puedes usar decimales.
          </p>
          <div className="sleep-field-error">
            <FieldError
              id="edit-hoursSlept-error"
              message={visibleError('hoursSlept')}
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="edit-sleepType">
            Tipo de descanso <span aria-hidden="true">*</span>
          </label>
          <div className="select-wrap">
            <select
              id="edit-sleepType"
              name="sleepType"
              required
              value={values.sleepType}
              disabled={submitting}
              onChange={(event) => update('sleepType', event.target.value)}
              onBlur={() => blur('sleepType')}
              aria-invalid={Boolean(visibleError('sleepType'))}
              aria-describedby={
                visibleError('sleepType') ? 'edit-sleepType-error' : undefined
              }
            >
              <option value="" disabled>
                {record.sleepType === null
                  ? 'Sin clasificar: selecciona un tipo'
                  : 'Selecciona un tipo de descanso'}
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
              id="edit-sleepType-error"
              message={visibleError('sleepType')}
            />
          </div>
        </div>
        {validationNotice && (
          <p className="validation-notice" role="alert">
            Revisa los campos indicados antes de guardar.
          </p>
        )}
        {error && (
          <div className="feedback feedback-error" role="alert">
            <span className="feedback-heading">
              No se ha confirmado la actualización
            </span>
            <p>{error}</p>
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {submitting ? 'Guardando cambios. Espera la confirmación.' : ''}
        </p>
        <div className="sleep-edit-actions">
          <button
            className="sleep-edit-cancel"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
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
                Guardando cambios…
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
        </div>
      </form>
    </dialog>
  )
}
