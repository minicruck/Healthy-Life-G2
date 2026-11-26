import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import {
  toActivityChanges,
  validateActivityFields,
  type EditableActivityFields,
} from '../lib/activityValidation'
import {
  ApiError,
  deleteActivity,
  updateActivity,
} from '../services/activities'
import { ACTIVITY_OPTIONS, INTENSITY_OPTIONS, type Activity } from '../types/activity'
import FieldError from './FieldError'
import './SleepEditDialog.css'

export default function ActivityManagementDialog({
  record,
  mode,
  onClose,
  onSaved,
}: {
  record: Activity
  mode: 'edit' | 'delete'
  onClose: () => void
  onSaved: (record: Activity | null) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [values, setValues] = useState<EditableActivityFields>({
    activityType: record.activityType,
    activityDate: record.activityDate,
    intensity: record.intensity ?? '',
    notes: record.notes ?? '',
  })
  const [errors, setErrors] = useState<
    ReturnType<typeof validateActivityFields>
  >({})
  const editing = mode === 'edit'

  useLayoutEffect(() => {
    const element = dialog.current
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    element?.showModal()
    return () => {
      element?.close()
      if (opener?.isConnected) opener.focus()
      else document.getElementById('activity-history-title')?.focus()
    }
  }, [])

  function close() {
    if (!pending.current) onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    if (editing) {
      const invalid = validateActivityFields(values)
      setErrors(invalid)
      if (Object.keys(invalid).length) return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      if (editing)
        onSaved(await updateActivity(record.id, toActivityChanges(values)))
      else {
        await deleteActivity(record.id)
        onSaved(null)
      }
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No se ha podido completar la operación. Inténtalo de nuevo.',
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="sleep-edit-dialog"
      aria-modal="true"
      aria-labelledby="activity-management-title"
      aria-describedby="activity-management-description"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <header className="sleep-edit-heading">
        <div>
          <p>REGISTRO #{record.id}</p>
          <h2 id="activity-management-title">
            {editing ? 'Editar actividad' : 'Eliminar actividad'}
          </h2>
        </div>
        <button
          type="button"
          className="sleep-edit-close"
          aria-label="Cerrar"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </header>
      <p id="activity-management-description">
        {editing
          ? 'Modifica los datos y guarda los cambios.'
          : `¿Quieres eliminar la actividad del ${record.activityDate}? Esta acción no se puede deshacer.`}
      </p>
      <form onSubmit={submit} noValidate>
        {editing && (
          <>
            <div className="form-field">
              <label htmlFor="activity-edit-type">Tipo de actividad</label>
              <select
                id="activity-edit-type"
                value={values.activityType}
                disabled={busy}
                required
                aria-invalid={Boolean(errors.activityType)}
                aria-describedby={
                  errors.activityType ? 'activity-edit-type-error' : undefined
                }
                onChange={(e) =>
                  setValues({
                    ...values,
                    activityType: e.target
                      .value as EditableActivityFields['activityType'],
                  })
                }
              >
                <option value="">Selecciona una actividad</option>
                {ACTIVITY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError
                id="activity-edit-type-error"
                message={errors.activityType}
              />
            </div>
            <div className="form-field">
              <label htmlFor="activity-edit-date">Fecha de actividad</label>
              <input
                id="activity-edit-date"
                type="date"
                required
                value={values.activityDate}
                disabled={busy}
                aria-invalid={Boolean(errors.activityDate)}
                aria-describedby={
                  errors.activityDate ? 'activity-edit-date-error' : undefined
                }
                onChange={(e) =>
                  setValues({ ...values, activityDate: e.target.value })
                }
              />
              <FieldError
                id="activity-edit-date-error"
                message={errors.activityDate}
              />
            </div>
            <div className="form-field">
              <label htmlFor="activity-edit-intensity">Intensidad del entrenamiento</label>
              <select
                id="activity-edit-intensity"
                value={values.intensity}
                disabled={busy}
                required={record.intensity !== null}
                aria-invalid={Boolean(errors.intensity)}
                aria-describedby={errors.intensity ? 'activity-edit-intensity-error' : undefined}
                onChange={(e) =>
                  setValues({
                    ...values,
                    intensity: e.target.value as EditableActivityFields['intensity'],
                  })
                }
              >
                {record.intensity === null && (
                  <option value="">Intensidad sin registrar</option>
                )}
                {INTENSITY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <FieldError id="activity-edit-intensity-error" message={errors.intensity} />
            </div>
            <div className="form-field">
              <label htmlFor="activity-edit-notes">
                Observaciones (opcional)
              </label>
              <textarea
                id="activity-edit-notes"
                rows={4}
                maxLength={500}
                value={values.notes}
                disabled={busy}
                aria-invalid={Boolean(errors.notes)}
                aria-describedby={
                  errors.notes ? 'activity-edit-notes-error' : undefined
                }
                onChange={(e) =>
                  setValues({ ...values, notes: e.target.value })
                }
              />
              <FieldError
                id="activity-edit-notes-error"
                message={errors.notes}
              />
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="sleep-edit-actions">
          <button
            type="button"
            className="sleep-edit-cancel"
            onClick={close}
            disabled={busy}
            autoFocus={!editing}
          >
            Cancelar
          </button>
          <button type="submit" className="save-button" disabled={busy}>
            {busy
              ? 'Procesando…'
              : editing
                ? 'Guardar cambios'
                : 'Eliminar actividad'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
