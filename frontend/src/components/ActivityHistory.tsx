import { useEffect, useMemo, useState } from 'react'
import { ApiError, listActivities } from '../services/activities'
import HistoryList from './HistoryList'
import { ACTIVITY_OPTIONS, type Activity } from '../types/activity'
import './ActivityHistory.css'

type ActivityHistoryProps = {
  userId?: string
  active?: boolean
  revision?: number
}

const activityLabels = Object.fromEntries(
  ACTIVITY_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<Activity['activityType'], string>

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

export default function ActivityHistory({
  userId = 'demo-user',
  active = true,
  revision = 0,
}: ActivityHistoryProps) {
  const [records, setRecords] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!active) return

    let isCancelled = false
    setLoading(true)
    setError(null)

    listActivities(userId)
      .then((activities) => {
        if (!isCancelled) setRecords(activities)
      })
      .catch((requestError: unknown) => {
        if (isCancelled) return
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'Comprueba la conexión y vuelve a intentarlo.',
        )
      })
      .finally(() => {
        if (!isCancelled) setLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [active, revision, userId, attempt])

  const orderedRecords = useMemo(
    () =>
      [...records].sort(
        (left, right) =>
          right.activityDate.localeCompare(left.activityDate) ||
          right.id - left.id,
      ),
    [records],
  )

  return (
    <section
      id="activity-history"
      className="activity-history"
      hidden={!active}
      aria-labelledby="activity-history-title"
    >
      <div className="activity-history-header">
        <div>
          <h2 id="activity-history-title">Historial de actividades</h2>
        </div>
        {!loading && !error && orderedRecords.length > 0 && (
          <span className="activity-history-count">
            {orderedRecords.length}{' '}
            {orderedRecords.length === 1 ? 'registro' : 'registros'}
          </span>
        )}
      </div>

      {loading ? (
        <p className="activity-history-status" role="status">
          Cargando historial…
        </p>
      ) : error ? (
        <div className="activity-history-message activity-history-error">
          <h3>No se ha podido cargar el historial</h3>
          <p role="alert">{error}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reintentar consulta
          </button>
        </div>
      ) : orderedRecords.length === 0 ? (
        <div className="activity-history-message activity-history-empty">
          <span aria-hidden="true">—</span>
          <div>
            <h3>No hay registros disponibles.</h3>
            <p>Cuando registres una actividad, aparecerá aquí.</p>
          </div>
        </div>
      ) : (
        <HistoryList
          records={orderedRecords}
          label="Actividades registradas"
          className="activity-history-list"
        >
          {(record) => (
            <li key={record.id} className="activity-history-item">
              <div className="activity-history-item-header">
                <span className="activity-history-tag">
                  {activityLabels[record.activityType]}
                </span>
                <time dateTime={record.activityDate}>
                  {formatDate(record.activityDate)}
                </time>
              </div>
              {record.notes?.trim() && (
                <p className="activity-history-notes">{record.notes}</p>
              )}
            </li>
          )}
        </HistoryList>
      )}
    </section>
  )
}
