// Calidad del sueño — Registro de la sensación de calidad del descanso (CA1 - CA5).
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getMadridToday } from '../lib/sleepCalendar'
import {
  formatDay,
  getSleepQualityList,
  RATING_LABELS,
  saveSleepQuality,
  SleepQualityAlreadyExistsError,
  validateSleepQualityDate,
  validateSleepQualityNotes,
  validateSleepQualityRating,
} from '../services/sleepQuality'
import type { SleepQualityRecord } from '../types/sleepQuality'
import './SleepQualityForm.css'

export default function SleepQualityForm() {
  const [records, setRecords] = useState<SleepQualityRecord[]>([])
  const [sleepDate, setSleepDate] = useState(() => getMadridToday())
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [duplicateExisting, setDuplicateExisting] =
    useState<SleepQualityRecord | null>(null)

  const today = getMadridToday()

  const refreshList = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getSleepQualityList()
      setRecords(list)
    } catch {
      // Si la carga falla, el formulario sigue estando disponible
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  async function handleSubmit(overwrite = false) {
    if (saving) return
    setError(null)
    setSuccessMessage(null)

    // CA2: La valoración es obligatoria (1 a 5)
    const ratingError = validateSleepQualityRating(rating)
    if (ratingError) {
      setError(ratingError)
      return
    }

    // CA3: No se permiten fechas futuras
    const dateError = validateSleepQualityDate(sleepDate, today)
    if (dateError) {
      setError(dateError)
      return
    }

    // CA5: Comentario opcional de hasta 200 caracteres
    if (notes) {
      const notesError = validateSleepQualityNotes(notes)
      if (notesError) {
        setError(notesError)
        return
      }
    }

    // CA4: Comprobación preventiva en cliente de valoración existente para esa fecha
    if (!overwrite) {
      const localExisting = records.find((r) => r.sleepDate === sleepDate)
      if (localExisting) {
        setDuplicateExisting(localExisting)
        return
      }
    }

    setSaving(true)
    try {
      const result = await saveSleepQuality({
        sleepDate,
        rating: rating!,
        notes,
        overwrite,
      })

      // CA1 y CA4: Confirmación del registro o sustitución
      setSuccessMessage(
        result.replaced
          ? 'Valoración actualizada correctamente sin duplicar.'
          : 'Valoración de calidad del sueño registrada correctamente.',
      )
      setDuplicateExisting(null)
      setNotes('')
      // Actualizar listado local
      await refreshList()
    } catch (err) {
      if (err instanceof SleepQualityAlreadyExistsError) {
        // CA4: El servidor detectó que ya existía una valoración para esa noche
        setDuplicateExisting(err.existing)
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo guardar la calidad del sueño.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void handleSubmit(false)
  }

  return (
    <section
      className="form-panel sleep-quality-layout"
      aria-labelledby="sleep-quality-title"
    >
      <div className="form-heading">
        <h2 id="sleep-quality-title">Calidad del sueño</h2>
        <span>Sensación del descanso</span>
      </div>

      <div className="sleep-quality-summary" aria-live="polite">
        {loading ? (
          <p role="status">Cargando valoraciones de sueño…</p>
        ) : records.length === 0 ? (
          <div>
            <p>Todavía no tienes valoraciones de calidad de sueño registradas.</p>
            <strong>Valora tu sensación de descanso cada mañana</strong>
          </div>
        ) : (
          <div>
            <p>Último descanso valorado ({formatDay(records[0].sleepDate)})</p>
            <strong>
              {records[0].rating} / 5 · {RATING_LABELS[records[0].rating]}
            </strong>
            {records[0].notes && (
              <p className="sleep-quality-last-note">«{records[0].notes}»</p>
            )}
          </div>
        )}

        {!loading && records.length > 0 && (
          <ul
            className="sleep-quality-records-list"
            aria-label="Historial de valoraciones"
          >
            {records.slice(0, 5).map((rec) => (
              <li key={rec.id}>
                <span>{formatDay(rec.sleepDate)}</span>
                <span className="rating-badge">
                  {rec.rating}/5 · {RATING_LABELS[rec.rating]}
                </span>
                {rec.notes ? (
                  <span className="record-notes" title={rec.notes}>
                    {rec.notes}
                  </span>
                ) : (
                  <span className="no-notes">Sin comentarios</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} noValidate>
        {/* Campo 1: Fecha de la noche (CA3: No futuras) */}
        <div className="form-field date-field">
          <label htmlFor="sleep-quality-date">
            Fecha de la noche de descanso{' '}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="sleep-quality-date"
            name="sleepQualityDate"
            type="date"
            required
            max={today}
            value={sleepDate}
            onChange={(event) => {
              setSleepDate(event.target.value)
              setError(null)
              setDuplicateExisting(null)
              setSuccessMessage(null)
            }}
            disabled={saving}
            aria-describedby="sleep-quality-date-hint"
          />
          <p id="sleep-quality-date-hint" className="field-hint">
            No se permiten fechas futuras.
          </p>
        </div>

        {/* Campo 2: Valoración obligatoria de 1 a 5 (CA2) */}
        <div className="form-field">
          <label id="sleep-quality-rating-label">
            Valoración del descanso (1 a 5){' '}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <div
            className="rating-options"
            role="radiogroup"
            aria-labelledby="sleep-quality-rating-label"
          >
            {([1, 2, 3, 4, 5] as const).map((val) => {
              const isSelected = rating === val
              return (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${val} - ${RATING_LABELS[val]}`}
                  className={`rating-option-button ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setRating(val)
                    setError(null)
                    setDuplicateExisting(null)
                    setSuccessMessage(null)
                  }}
                  disabled={saving}
                >
                  <span className="rating-number">{val}</span>
                  <span className="rating-desc">{RATING_LABELS[val]}</span>
                </button>
              )
            })}
          </div>
          <p className="field-hint">
            Obligatorio: elige una valoración de 1 (muy mala) a 5 (excelente).
          </p>
        </div>

        {/* Campo 3: Comentario opcional de hasta 200 caracteres (CA5) */}
        <div className="form-field notes-field">
          <div className="label-row">
            <label htmlFor="sleep-quality-notes">
              Comentario o sensaciones{' '}
              <span className="optional-label">(opcional)</span>
            </label>
            <span
              className={`character-count ${notes.length > 200 ? 'over-limit' : ''}`}
              aria-live="polite"
            >
              {notes.length}
              <span>/200 caracteres</span>
            </span>
          </div>
          <textarea
            id="sleep-quality-notes"
            name="sleepQualityNotes"
            rows={3}
            maxLength={200}
            value={notes}
            placeholder="Anota cómo te has levantado, si hubo despertares, sensaciones de energía..."
            onChange={(event) => {
              setNotes(event.target.value)
              setError(null)
            }}
            disabled={saving}
            aria-describedby="sleep-quality-notes-hint"
          />
          <p id="sleep-quality-notes-hint" className="field-hint">
            Opcional. Máximo 200 caracteres.
          </p>
        </div>

        {/* CA4: Notificación si ya existe valoración para esa noche */}
        {duplicateExisting && (
          <div className="sleep-quality-conflict-alert" role="alert">
            <strong>Ya existe una valoración para esta noche</strong>
            <p>
              La fecha <strong>{formatDay(duplicateExisting.sleepDate)}</strong>{' '}
              ya tiene registrada una valoración de{' '}
              <strong>
                {duplicateExisting.rating} / 5 (
                {RATING_LABELS[duplicateExisting.rating]})
              </strong>
              {duplicateExisting.notes ? ` («${duplicateExisting.notes}»)` : ''}.
              ¿Deseas sustituirla sin duplicar?
            </p>
            <div className="conflict-actions">
              <button
                type="button"
                className="save-button conflict-replace-button"
                onClick={() => void handleSubmit(true)}
                disabled={saving}
              >
                {saving ? 'Sustituyendo…' : 'Sustituir valoración'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDuplicateExisting(null)}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Error notice */}
        {error && (
          <p className="validation-notice sleep-quality-error" role="alert">
            {error}
          </p>
        )}

        {/* CA1: Confirmación de registro exitoso */}
        {successMessage && (
          <div className="feedback feedback-success" role="status">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <strong className="feedback-heading">{successMessage}</strong>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="save-button" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar calidad del sueño'}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void refreshList()}
            disabled={saving}
          >
            Actualizar
          </button>
        </div>
      </form>
    </section>
  )
}
