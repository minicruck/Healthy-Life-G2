import { useCallback, useState } from 'react'
import ActivityForm from '../components/ActivityForm'
import ActivityHistory from '../components/ActivityHistory'
import HydrationGoalForm from '../components/HydrationGoalForm'
import MovementIllustration from '../components/MovementIllustration'
import SleepDashboard from '../components/SleepDashboard'
import SleepForm from '../components/SleepForm'
import WaterForm from '../components/WaterForm'

type Habit = 'activity' | 'sleep' | 'water'

export default function RegisterActivityPage() {
  const [selectedHabit, setSelectedHabit] = useState<Habit>('activity')
  const isActivity = selectedHabit === 'activity'
  const isSleep = selectedHabit === 'sleep'
  const isWater = selectedHabit === 'water'
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
              : '#water-form'
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
          <span>
            {isWater ? 'E1 · Hidratación' : 'E2 · Hábitos saludables'}
          </span>
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
          aria-pressed={isWater}
          aria-controls="water-panel"
          onClick={() => setSelectedHabit('water')}
        >
          Agua
        </button>
      </nav>

      <main className="workspace">
        <section className="introduction" aria-labelledby="page-title">
          <p className="eyebrow">
            <span className="section-marker">{isWater ? 'E1' : 'E2'}</span>{' '}
            {isWater ? 'HIDRATACIÓN' : 'SEGUIMIENTO DE HÁBITOS'}
          </p>
          <h1 id="page-title">
            Registrar <br />
            <em>
              {isActivity
                ? 'actividad física'
                : isSleep
                  ? 'horas de sueño'
                  : 'consumo de agua'}
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
            ) : isWater ? (
              <>
                Define tu objetivo diario y registra cada consumo para seguir tu
                hidratación en una sola vista.
              </>
            ) : null}
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
              ) : isWater ? (
                <>
                  Ajusta tu meta cuando quieras.
                  <br />
                  Revisa los consumos que has registrado.
                </>
              ) : null}
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
        <div className="habit-panel" id="water-panel" hidden={!isWater}>
          {isWater && (
            <div className="water-hydration-stack">
              <HydrationGoalForm />
              <WaterForm active={isWater} />
            </div>
          )}
        </div>
        <SleepDashboard active={isSleep} revision={sleepRevision} />
      </main>

      <footer className="site-footer">
        <span>
          HEALTHY LIFE <span className="footer-separator">/</span> Módulo{' '}
          {isWater ? 'E1' : 'E2'}
        </span>
        <span>
          Proyecto académico · Universidad Rey Juan Carlos{' '}
          <span className="footer-year">2026–27</span>
        </span>
      </footer>
    </div>
  )
}
