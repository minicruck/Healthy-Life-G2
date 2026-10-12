import { Component, lazy, Suspense, useMemo, type ReactNode } from 'react'
import { aggregateSleepDays } from '../lib/sleepDailyStatistics'
import { formatSleepDate, formatSleepHours } from '../lib/sleepStatistics'
import { SLEEP_TYPE_OPTIONS, type SleepRecord } from '../types/sleep'
import './SleepDailySection.css'

const SleepDailyChart = lazy(() => import('./SleepDailyChart'))
const fullDate = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
class DailyChartBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p className="sleep-chart-error" role="alert">
        No se ha podido cargar la gráfica diaria. Los totales y el detalle de
        cada día siguen disponibles debajo.
      </p>
    ) : (
      this.props.children
    )
  }
}

export default function SleepDailySection({
  records,
  today,
  onEdit,
}: {
  records: SleepRecord[]
  today: string
  onEdit: (record: SleepRecord) => void
}) {
  const days = useMemo(() => aggregateSleepDays(records), [records])
  if (days.length === 0) return null
  return (
    <section
      className="sleep-daily-section"
      aria-labelledby="sleep-daily-title"
    >
      <div className="sleep-daily-heading">
        <div>
          <p className="sleep-dashboard-eyebrow">EL DESCANSO, AL COMPLETO</p>
          <h2 id="sleep-daily-title">
            Tu descanso <em>día a día</em>
          </h2>
        </div>
        <p>
          Una noche, una siesta, un momento de descanso.
          <br />
          Cada registro forma parte de tu día.
        </p>
      </div>
      <DailyChartBoundary>
        <Suspense fallback={<p role="status">Preparando la gráfica diaria…</p>}>
          <SleepDailyChart days={days} />
        </Suspense>
      </DailyChartBoundary>
      <div className="sleep-day-list">
        {[...days].reverse().map((day, index) => (
          <details
            className="sleep-day"
            key={day.date}
            open={index === 0}
            data-sleep-day={day.date}
          >
            <summary>
              <span className="sleep-day-date">
                <time dateTime={day.date}>
                  {fullDate.format(new Date(`${day.date}T12:00:00Z`))}
                </time>
                <span>
                  {day.count} {day.count === 1 ? 'registro' : 'registros'} · Ver
                  desglose y editar
                </span>
              </span>
              <span className="sleep-day-total">
                <small>Total dormido</small>
                <strong data-testid={`sleep-day-total-${day.date}`}>
                  {formatSleepHours(day.total)} <span>h</span>
                </strong>
              </span>
              <span className="sleep-day-toggle" aria-hidden="true">
                +
              </span>
            </summary>
            {day.date > today && (
              <p className="sleep-day-notice">
                Registros antiguos con fecha futura. Corrige la fecha antes de
                guardar una edición.
              </p>
            )}
            {day.total > 24 && (
              <p className="sleep-day-notice">
                Este día suma más de 24 horas. Puedes revisar los registros; se
                conservan tal como los guardaste.
              </p>
            )}
            <ul
              className="sleep-day-records"
              aria-label={`Descansos del ${formatSleepDate(day.date)}`}
            >
              {day.records.map((record) => (
                <li key={record.id}>
                  <div className="sleep-day-record-name">
                    <span
                      className={`sleep-type-badge sleep-type-${record.sleepType ?? 'unclassified'}`}
                    >
                      {SLEEP_TYPE_OPTIONS.find(
                        ({ value }) => value === record.sleepType,
                      )?.label ?? 'Sin clasificar'}
                    </span>
                    <small>Registro #{record.id}</small>
                  </div>
                  <span className="sleep-day-hours">
                    {formatSleepHours(record.hoursSlept, true)} <small>h</small>
                  </span>
                  <button
                    type="button"
                    className="sleep-record-edit"
                    aria-label={`Editar registro #${record.id}`}
                    onClick={() => onEdit(record)}
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <p className="sleep-calculation-note">
        El total diario suma todos los descansos de esa fecha. Cada registro
        conserva su identidad y se puede corregir por separado. No contamos los
        días sin información.
      </p>
    </section>
  )
}
