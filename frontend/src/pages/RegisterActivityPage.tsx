import { useCallback, useState } from 'react'
import ActivityForm from '../components/ActivityForm'
import ActivityHistory from '../components/ActivityHistory'
import HydrationGoalForm from '../components/HydrationGoalForm'
import MovementIllustration from '../components/MovementIllustration'
import SleepDashboard from '../components/SleepDashboard'
import SleepForm from '../components/SleepForm'
import WaterForm from '../components/WaterForm'
import TrainingGoalForm from '../components/TrainingGoalForm'
import SleepGoalForm from '../components/SleepGoalForm'
import SleepGoalNotice from '../components/SleepGoalNotice'

type Habit =
  | 'activity'
  | 'sleep'
  | 'hydration-goal'
  | 'water'
  | 'training-goal'
  | 'sleep-goal'

export default function RegisterActivityPage() {
  const [selectedHabit, setSelectedHabit] = useState<Habit>('activity')
  const isActivity = selectedHabit === 'activity'
  const isSleep = selectedHabit === 'sleep'
  const isHydration =
    selectedHabit === 'hydration-goal' || selectedHabit === 'water'
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
              : selectedHabit === 'training-goal'
                ? '#training-goal-panel'
                : selectedHabit === 'sleep-goal'
                  ? '#sleep-goal-panel'
                  : isWater
                  ? '#water-form'
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
          <span>
            {isHydration ? 'E1 · Hidratación' : 'E2 · Hábitos saludables'}
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
          aria-pressed={selectedHabit === 'hydration-goal'}
          aria-controls="hydration-goal-panel"
          onClick={() => setSelectedHabit('hydration-goal')}
        >
          Meta de agua
        </button>
        <button
          type="button"
          aria-pressed={isWater}
          aria-controls="water-panel"
          onClick={() => setSelectedHabit('water')}
        >
          Agua
        </button>
        <button
          type="button"
          aria-pressed={selectedHabit === 'training-goal'}
          aria-controls="training-goal-panel"
          onClick={() => setSelectedHabit('training-goal')}
        >
          Objetivo de entrenamiento
        </button>
        <button
          type="button"
          aria-pressed={selectedHabit === 'sleep-goal'}
          aria-controls="sleep-goal-panel"
          onClick={() => setSelectedHabit('sleep-goal')}
        >
          Objetivo de sueño
        </button>
      </nav>

      <main className="workspace">
        <section className="introduction" aria-labelledby="page-title">
          <p className="eyebrow">
            <span className="section-marker">{isHydration ? 'E1' : 'E2'}</span>{' '}
            {isHydration ? 'HIDRATACIÓN' : 'SEGUIMIENTO DE HÁBITOS'}
          </p>
          <h1 id="page-title">
            Registrar <br />
            <em>
              {isActivity
                ? 'actividad física'
                : selectedHabit === 'training-goal'
                  ? 'objetivo de entrenamiento'
                  : selectedHabit === 'sleep-goal'
                    ? 'objetivo de sueño'
                    : isSleep
                  ? 'horas de sueño'
                  : isWater
                    ? 'consumo de agua'
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
            ) : selectedHabit === 'sleep-goal' ? (
              <>
                Fija cuántas horas quieres dormir como mínimo cada día y te
                avisaremos cuando no lo cumplas.
              </>
            ) : selectedHabit === 'training-goal' ? (
              <>
                Elige cuántos días quieres entrenar cada semana y consulta los días
                que te quedan para alcanzar tu meta.
              </>
            ) : isSleep ? (
              <>
                Anota cuándo y cuánto has dormido, de noche o en una siesta.
                Puedes registrar varios descansos en un mismo día.
              </>
            ) : isWater ? (
              <>
                Registra cada consumo de agua y consulta tu historial para
                seguir tu hidratación día a día.
              </>
            ) : (
              <>
                Define un objetivo diario de agua para orientarte y convertir la
                hidratación en un hábito.
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
              ) : selectedHabit === 'sleep-goal' ? (
                <>
                  Se suman noches y siestas de cada día.
                  <br />
                  Revisamos los últimos 7 días.
                </>
              ) : selectedHabit === 'training-goal' ? (
                <>
                  Cuenta los días distintos con actividad.
                  <br />
                  El progreso se actualiza al registrar entrenamientos.
                </>
              ) : isSleep ? (
                <>
                  Tu descanso, día a día.
                  <br />
                  Registra más de 0 y hasta 24 horas.
                </>
              ) : isWater ? (
                <>
                  Cada registro queda guardado.
                  <br />
                  Consulta tus consumos cuando quieras.
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
        <div
          className="habit-panel"
          id="training-goal-panel"
          hidden={selectedHabit !== 'training-goal'}
        >
          {selectedHabit === 'training-goal' && <TrainingGoalForm />}
        </div>
        <div
          className="habit-panel"
          id="sleep-goal-panel"
          hidden={selectedHabit !== 'sleep-goal'}
        >
          {selectedHabit === 'sleep-goal' && <SleepGoalForm />}
        </div>
        <div className="habit-panel" id="sleep-panel" hidden={!isSleep}>
          <SleepForm onSaved={refreshSleep} />
          <SleepGoalNotice
            active={isSleep}
            revision={sleepRevision}
            onConfigure={() => setSelectedHabit('sleep-goal')}
          />
        </div>
        <div
          className="habit-panel"
          id="hydration-goal-panel"
          hidden={selectedHabit !== 'hydration-goal'}
        >
          {selectedHabit === 'hydration-goal' && <HydrationGoalForm />}
        </div>
        <div className="habit-panel" id="water-panel" hidden={!isWater}>
          <WaterForm active={isWater} />
        </div>
        <SleepDashboard active={isSleep} revision={sleepRevision} />
      </main>

      <footer className="site-footer">
        <span>
          HEALTHY LIFE <span className="footer-separator">/</span> Módulo{' '}
          {isHydration ? 'E1' : 'E2'}
        </span>
        <span>
          Proyecto académico · Universidad Rey Juan Carlos{' '}
          <span className="footer-year">2026–27</span>
        </span>
      </footer>
    </div>
  )
}
