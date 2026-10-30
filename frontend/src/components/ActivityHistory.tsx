import { useEffect, useMemo, useState } from 'react'
import { listActivities } from '../services/activities'
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
  }).format(parsed)
}

export default function ActivityHistory({
  userId = 'demo-user',
  active = true,
  revision = 0,
}: ActivityHistoryProps) {
  const [records, setRecords] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          requestError instanceof Error
            ? requestError.message
            : 'No se pudo cargar el historial de actividades.',
        )
      })
      .finally(() => {
        if (!isCancelled) setLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [active, revision, userId])

  const orderedRecords = useMemo(
    () =>
      [...records].sort((left, right) => {
        const leftDate = new Date(`${left.activityDate}T12:00:00Z`).getTime()
        const rightDate = new Date(`${right.activityDate}T12:00:00Z`).getTime()

        return rightDate - leftDate || right.id - left.id
      }),
    [records],
  )

  return (
    <section className="activity-history" hidden={!active} aria-live="polite">
      <div className="activity-history-header">
        <div>
          <p className="activity-history-eyebrow">HISTORIAL</p>
          <h2>Historial de actividades</h2>
        </div>
        <span className="activity-history-user">Usuario {userId}</span>
      </div>

      {loading ? (
        <p className="activity-history-status">Cargando historial…</p>
      ) : error ? (
        <div className="activity-history-message activity-history-error" role="alert">
          <h3>No se ha podido cargar el historial</h3>
          <p>{error}</p>
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
        <ul className="activity-history-list">
          {orderedRecords.map((record) => (
            <li key={record.id} className="activity-history-item">
              <div className="activity-history-item-header">
                <span className="activity-history-tag">
                  {activityLabels[record.activityType]}
                </span>
                <time dateTime={record.activityDate}>
                  {formatDate(record.activityDate)}
                </time>
              </div>
              <p className="activity-history-notes">
                {record.notes?.trim() || 'Sin observaciones.'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
