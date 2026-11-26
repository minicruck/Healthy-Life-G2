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
import SleepQualityForm from '../components/SleepQualityForm'
import SleepGoalNotice from '../components/SleepGoalNotice'

type Habit =
  | 'activity'
  | 'sleep'
  | 'water'
  | 'training-goal'
  | 'sleep-goal'
  | 'sleep-quality'

const screens = {
  activity: {
    label: 'Actividad física',
    action: 'Registrar',
    subject: 'actividad física',
    target: 'activity-form',
    intro:
      'Anota el tipo de actividad, la fecha y los detalles que quieras recordar.',
  },
  sleep: {
    label: 'Horas de sueño',
    action: 'Registrar',
    subject: 'horas de sueño',
    target: 'sleep-form',
    intro:
      'Anota tus noches y siestas. Puedes registrar varios descansos en un mismo día.',
  },
  water: {
    label: 'Agua',
    action: 'Registrar',
    subject: 'consumo de agua',
    target: 'water-form',
    intro: 'Añade un consumo en mililitros y consulta cuánto llevas hoy.',
  },
  'training-goal': {
    label: 'Objetivo de entrenamiento',
    action: 'Mi objetivo de',
    subject: 'entrenamiento',
    target: 'training-goal-panel',
    intro:
      'Elige cuántos días quieres entrenar y consulta tu progreso de lunes a domingo. Cada fecha con actividad cuenta una vez.',
  },
  'sleep-goal': {
    label: 'Objetivo de sueño',
    action: 'Mi objetivo de',
    subject: 'sueño',
    target: 'sleep-goal-panel',
    intro:
      'Define tu mínimo diario de horas y revisa tu última semana. Se suman los descansos registrados en cada fecha.',
  },
  'sleep-quality': {
    label: 'Calidad del sueño',
    action: 'Registrar',
    subject: 'calidad del sueño',
    target: 'sleep-quality-panel',
    intro:
      'Valora del 1 al 5 cómo has descansado y añade tus impresiones sobre esa noche.',
  },
} satisfies Record<
  Habit,
  {
    label: string
    action: string
    subject: string
    target: string
    intro: string
  }
>

const habits: Habit[] = ['activity', 'sleep', 'water']
const followUp: Habit[] = ['training-goal', 'sleep-goal', 'sleep-quality']

export default function RegisterActivityPage() {
  const [selectedHabit, setSelectedHabit] = useState<Habit>('activity')
  const isActivity = selectedHabit === 'activity'
  const isSleep = selectedHabit === 'sleep'
  const isWater = selectedHabit === 'water'
  const [sleepRevision, setSleepRevision] = useState(0)
  const [activityRevision, setActivityRevision] = useState(0)
  const [showActivityHistory, setShowActivityHistory] = useState(false)
  // HU10: fecha del último registro de sueño guardado, para avisar sobre ese día.
  const [lastSleepDate, setLastSleepDate] = useState<string | undefined>(
    undefined,
  )
  const refreshSleep = useCallback((record?: { sleepDate: string }) => {
    if (record) setLastSleepDate(record.sleepDate)
    setSleepRevision((revision) => revision + 1)
  }, [])
  const refreshActivities = useCallback(() => {
    setActivityRevision((revision) => revision + 1)
  }, [])

  const historyOpen = isActivity && showActivityHistory
  const screen = screens[selectedHabit]
  const target = historyOpen ? 'activity-history-panel' : screen.target

  function sectionButton(habit: Habit) {
    return (
      <button
        key={habit}
        type="button"
        aria-pressed={selectedHabit === habit}
        aria-controls={`${habit}-panel`}
        onClick={() => setSelectedHabit(habit)}
      >
        {screens[habit].label}
      </button>
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href={`#${target}`}>
        {historyOpen ? 'Ir al historial' : 'Ir al formulario'}
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

      <nav className="habit-selector" aria-label="Hábitos y seguimiento">
        <div role="group" aria-label="Registro de hábitos">
          {habits.map(sectionButton)}
        </div>
        <div role="group" aria-label="Objetivos y calidad del sueño">
          {followUp.map(sectionButton)}
        </div>
      </nav>

      <main className={`workspace${isWater ? ' workspace-water' : ''}`}>
        <section className="introduction" aria-labelledby="page-title">
          <p className="eyebrow">
            <span className="section-marker">E2</span>{' '}
            {isWater ? 'HIDRATACIÓN' : 'SEGUIMIENTO DE HÁBITOS'}
          </p>
          <h1 id="page-title">
            {historyOpen ? 'Consultar' : screen.action}{' '}
            <em>{screen.subject}</em>
          </h1>
          <p className="intro-copy">
            {historyOpen
              ? 'Revisa tus actividades por fecha, empezando por la más reciente.'
              : screen.intro}
          </p>
          {isActivity && (
            <button
              className="section-shortcut"
              type="button"
              aria-expanded={historyOpen}
              aria-controls="activity-history-panel"
              onClick={() => setShowActivityHistory(!showActivityHistory)}
            >
              {historyOpen ? 'Volver al registro' : 'Ver historial'}{' '}
              <span aria-hidden="true">→</span>
            </button>
          )}
          {isSleep && (
            <a className="section-shortcut" href="#sleep-dashboard-title">
              Ver estadísticas e historial <span aria-hidden="true">↓</span>
            </a>
          )}
          {isWater && (
            <a className="section-shortcut" href="#hydration-goal">
              Ajustar mi meta diaria <span aria-hidden="true">↓</span>
            </a>
          )}
          {isActivity && <MovementIllustration />}
        </section>

        <div className="habit-panel" id="activity-panel" hidden={!isActivity}>
          <div hidden={showActivityHistory}>
            <ActivityForm onSaved={refreshActivities} />
          </div>
          <div
            id="activity-history-panel"
            tabIndex={-1}
            hidden={!showActivityHistory}
          >
            <ActivityHistory active={historyOpen} revision={activityRevision} />
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
        <div
          className="habit-panel"
          id="sleep-quality-panel"
          hidden={selectedHabit !== 'sleep-quality'}
        >
          {selectedHabit === 'sleep-quality' && <SleepQualityForm />}
        </div>
        <div className="habit-panel" id="sleep-panel" hidden={!isSleep}>
          <SleepForm onSaved={refreshSleep} />
          <SleepGoalNotice
            active={isSleep}
            revision={sleepRevision}
            checkDate={lastSleepDate}
            onConfigure={() => setSelectedHabit('sleep-goal')}
          />
        </div>
        <div className="habit-panel" id="water-panel" hidden={!isWater}>
          {isWater && (
            <div className="water-hydration-stack">
              <WaterForm active={isWater} />
              <HydrationGoalForm />
            </div>
          )}
        </div>
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
