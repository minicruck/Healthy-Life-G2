import { useCallback, useState } from 'react'
import ActivityForm from '../components/ActivityForm'
import ActivityHistory from '../components/ActivityHistory'
import MovementIllustration from '../components/MovementIllustration'
import SleepForm from '../components/SleepForm'
import SleepDashboard from '../components/SleepDashboard'
import HydrationGoalForm from '../components/HydrationGoalForm'

export default function RegisterActivityPage() {
  const [selectedHabit, setSelectedHabit] = useState<
    'activity' | 'sleep' | 'hydration-goal'
  >(
    'activity',
  )
  const isActivity = selectedHabit === 'activity'
  const isSleep = selectedHabit === 'sleep'
  const [sleepRevision, setSleepRevision] = useState(0)
  const [activityRevision, setActivityRevision] = useState(0)
  const [showActivityHistory, setShowActivityHistory] = useState(false)
  const refreshSleep = useCallback(() => {
    setSleepRevision((revision) => revision + 1)
  }, [])
  const refreshActivities = useCallback(() => {
    setActivityRevision((revision) => revision + 1)
  }, [])

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href={
          isActivity
            ? '#activity-form'
            : isSleep
              ? '#sleep-form'
              : '#hydration-goal'
        }
      >
        Ir al formulario
      </a>
      <header className="site-header">
        <div className="brand" aria-label="Healthy Life">
          <span className="brand-symbol" aria-hidden="true">
            h<span>l</span>
            <i />
          </span>
          <span className="brand-wordmark">
            healthy<span>life.</span>
          </span>
        </div>
        <div className="header-context">
          <span>SCRUM &amp; RUN</span>
          <span>E2 · Hábitos saludables</span>
        </div>
      </header>

      <nav className="habit-selector" aria-label="Tipo de registro">
        <button
          type="button"
          aria-pressed={isActivity}
          aria-controls="activity-panel"
          onClick={() => setSelectedHabit('activity')}
        >
          Actividad física
        </button>
        <button
          type="button"
          aria-pressed={isSleep}
          aria-controls="sleep-panel"
          onClick={() => setSelectedHabit('sleep')}
        >
          Horas de sueño
        </button>
        <button
          type="button"
          aria-pressed={selectedHabit === 'hydration-goal'}
          aria-controls="hydration-goal-panel"
          onClick={() => setSelectedHabit('hydration-goal')}
        >
          Meta de agua
        </button>
      </nav>

      <main className="workspace">
        <section className="introduction" aria-labelledby="page-title">
          <p className="eyebrow">
            <span className="section-marker">E2</span> SEGUIMIENTO DE HÁBITOS
          </p>
          <h1 id="page-title">
            Registrar <br />
            <em>
              {isActivity
                ? 'actividad física'
                : isSleep
                  ? 'horas de sueño'
                  : 'meta diaria de agua'}
            </em>
          </h1>
          <p className="intro-copy">
            {isActivity ? (
              <>
                Anota qué has hecho y cuándo.
                <br className="desktop-break" /> Un lugar para registrar tu
                movimiento, actividad a actividad.
              </>
            ) : isSleep ? (
              <>
                Anota cuándo y cuánto has dormido, de noche o en una siesta.
                Puedes registrar varios descansos en un mismo día.
              </>
            ) : (
              <>
                Define un objetivo diario de agua para orientarte y convertir
                la hidratación en un hábito.
              </>
            )}
          </p>
          {isActivity && <MovementIllustration />}
          <div className="intro-note">
            <span className="note-line" aria-hidden="true" />
            <p>
              {isActivity ? (
                <>
                  Caminar, correr, entrenar…
                  <br />
                  Elige la actividad que mejor describa la tuya.
                </>
              ) : isSleep ? (
                <>
                  Tu descanso, día a día.
                  <br />
                  Registra más de 0 y hasta 24 horas.
                </>
              ) : (
                <>
                  Una meta orientativa para tu día.
                  <br />
                  Podrás cambiarla cuando quieras.
                </>
              )}
            </p>
          </div>
        </section>

        <div className="habit-panel" id="activity-panel" hidden={!isActivity}>
          <div className="activity-panel-stack">
            <ActivityForm
              onSaved={refreshActivities}
              showHistory={showActivityHistory}
              onToggleHistory={() =>
                setShowActivityHistory((current) => !current)
              }
            />
            <ActivityHistory
              userId="demo-user"
              active={isActivity && showActivityHistory}
              revision={activityRevision}
            />
          </div>
        </div>
        <div className="habit-panel" id="sleep-panel" hidden={!isSleep}>
          <SleepForm onSaved={refreshSleep} />
        </div>
        {selectedHabit === 'hydration-goal' && (
          <div className="habit-panel" id="hydration-goal-panel">
            <HydrationGoalForm />
          </div>
        )}
        <SleepDashboard active={isSleep} revision={sleepRevision} />
      </main>

      <footer className="site-footer">
        <span>
          HEALTHY LIFE <span className="footer-separator">/</span> Módulo E2
        </span>
        <span>
          Proyecto académico · Universidad Rey Juan Carlos{' '}
          <span className="footer-year">2026–27</span>
        </span>
      </footer>
    </div>
  )
}
