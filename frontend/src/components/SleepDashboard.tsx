import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSleepRecords } from '../hooks/useSleepRecords'
import { useSleepToday } from '../hooks/useSleepToday'
import { summarizeSleepDays } from '../lib/sleepDailyStatistics'
import type { SleepRecord } from '../types/sleep'
import SleepEditDialog from './SleepEditDialog'
import SleepDailySection from './SleepDailySection'
import {
  filterSleepRecords,
  formatSleepDate,
  summarizeSleep,
  type SleepPeriod,
} from '../lib/sleepStatistics'
import SleepStatsCards from './SleepStatsCards'
import SleepRecordsTable from './SleepRecordsTable'
import './SleepDashboard.css'

const SleepEvolutionChart = lazy(() => import('./SleepEvolutionChart'))

class SleepChartBoundary extends Component<
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
        No se ha podido cargar la gráfica. Puedes consultar todos los valores en
        la tabla de registros.
      </p>
    ) : (
      this.props.children
    )
  }
}

const periods: { value: SleepPeriod; label: string }[] = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: 'all', label: 'Todo el historial' },
]

type SleepDashboardProps = { active: boolean; revision: number }

export default function SleepDashboard({
  active,
  revision,
}: SleepDashboardProps) {
  const [period, setPeriod] = useState<SleepPeriod>('7')
  const [editing, setEditing] = useState<SleepRecord | null>(null)
  const [editRevision, setEditRevision] = useState(0)
  const [editMessage, setEditMessage] = useState('')
  const { records, loading, error, retry } = useSleepRecords(
    active,
    revision + editRevision,
  )
  const today = useSleepToday(active)
  const selected = useMemo(
    () => filterSleepRecords(records ?? [], period, today),
    [records, period, today],
  )
  const statistics = useMemo(() => summarizeSleep(selected), [selected])
  const dailyStatistics = useMemo(
    () => summarizeSleepDays(selected),
    [selected],
  )

  useEffect(() => {
    if (editMessage && !editing)
      document.getElementById('sleep-dashboard-title')?.focus()
  }, [editMessage, editing])

  function edit(record: SleepRecord) {
    setEditMessage('')
    setEditing(record)
  }

  function edited() {
    setEditing(null)
    setEditMessage('Descanso actualizado correctamente.')
    setEditRevision((value) => value + 1)
  }

  return (
    <section
      className="sleep-dashboard"
      aria-labelledby="sleep-dashboard-title"
      hidden={!active}
    >
      {active && (
        <>
          <div className="sleep-dashboard-heading">
            <div>
              <p className="sleep-dashboard-eyebrow">SUEÑO · TU SEGUIMIENTO</p>
              <h2 id="sleep-dashboard-title" tabIndex={-1}>
                Tu descanso <em>en cifras</em>
              </h2>
              <p className="sleep-dashboard-intro">
                Una mirada a las horas que has registrado.
              </p>
            </div>
            <div className="sleep-period-control">
              <span id="sleep-period-label">Período de consulta</span>
              <div
                className="sleep-period-options"
                role="group"
                aria-labelledby="sleep-period-label"
              >
                {periods.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={period === value}
                    onClick={() => setPeriod(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="sleep-period-note">
            <p>
              {period === 'all'
                ? 'Todos tus registros, incluidos los de fechas futuras.'
                : `Hasta el ${formatSleepDate(today)}, incluido. Sin contar fechas futuras.`}
            </p>
            <p role="status" aria-live="polite" aria-atomic="true">
              {loading
                ? records
                  ? 'Actualizando estadísticas…'
                  : 'Cargando tus registros…'
                : !error && records
                  ? `${selected.length} ${selected.length === 1 ? 'registro en este período' : 'registros en este período'}`
                  : ''}
            </p>
          </div>

          <p
            className="sleep-edit-confirmation"
            role="status"
            aria-live="polite"
          >
            {editMessage}
          </p>
          {editing && (
            <SleepEditDialog
              key={editing.id}
              record={editing}
              onClose={() => setEditing(null)}
              onSaved={edited}
            />
          )}

          {error ? (
            <div className="sleep-dashboard-message sleep-dashboard-error">
              <div role="alert">
                <h3>No se han podido actualizar las estadísticas</h3>
                <p>{error}</p>
                <p>
                  Si el formulario confirmó el registro o la edición, no
                  necesitas enviarlo otra vez. Puedes volver a cargar las
                  estadísticas.
                </p>
              </div>
              <button type="button" className="sleep-retry" onClick={retry}>
                Reintentar consulta <span aria-hidden="true">↗</span>
              </button>
            </div>
          ) : records === null ? (
            <div className="sleep-dashboard-loading" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : selected.length === 0 ? (
            <div className="sleep-dashboard-message sleep-dashboard-empty">
              <span className="sleep-empty-mark" aria-hidden="true">
                —
              </span>
              <div>
                <h3>
                  {records.length === 0
                    ? 'Tu descanso empieza con un registro'
                    : 'No hay registros en este período'}
                </h3>
                <p>
                  {records.length === 0
                    ? 'Todavía no tienes registros de sueño. Registra tus primeras horas de descanso para descubrir tus estadísticas.'
                    : 'Tienes registros guardados en otras fechas. Prueba con un período más amplio para consultarlos.'}
                </p>
                {records.length === 0 ? (
                  <a href="#sleep-form">
                    Ir al formulario <span aria-hidden="true">↑</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    className="sleep-text-button"
                    onClick={() => setPeriod('all')}
                  >
                    Ver todo el historial <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="sleep-dashboard-results" aria-busy={loading}>
              <SleepStatsCards
                statistics={statistics}
                dailyStatistics={dailyStatistics}
              />
              <SleepChartBoundary>
                <Suspense
                  fallback={<p role="status">Preparando la gráfica…</p>}
                >
                  <SleepEvolutionChart records={selected} />
                </Suspense>
              </SleepChartBoundary>
              <SleepRecordsTable
                records={selected}
                today={today}
                onEdit={edit}
              />
              <p className="sleep-calculation-note">
                La media se calcula por registro. Los días sin datos no cuentan
                como cero y los registros de una misma fecha se mantienen
                separados. La media diaria divide el total entre los días con
                registros, sin incluir los días sin información.
              </p>
              <SleepDailySection
                records={selected}
                today={today}
                onEdit={edit}
              />
            </div>
          )}
        </>
      )}
    </section>
  )
}
