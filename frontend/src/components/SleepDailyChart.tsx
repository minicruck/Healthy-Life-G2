import { useId } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SleepDay } from '../lib/sleepDailyStatistics'
import { formatSleepDate, formatSleepHours } from '../lib/sleepStatistics'
import './SleepDailyChart.css'

const series = [
  { key: 'night', label: 'Sueño nocturno', color: '#8f2035' },
  { key: 'nap', label: 'Siesta', color: '#ad734a' },
  { key: 'other', label: 'Otro', color: '#68745d' },
  { key: 'unclassified', label: 'Sin clasificar', color: '#8f8b82' },
] as const

export default function SleepDailyChart({ days }: { days: SleepDay[] }) {
  const id = useId()
  if (days.length === 0) return null
  const byDate = new Map(days.map((day) => [day.date, day]))
  return (
    <figure className="sleep-daily-chart" aria-labelledby={`${id}-title`}>
      <figcaption>
        <h3 id={`${id}-title`}>Horas totales por día</h3>
        <span>Todos los descansos de una misma fecha</span>
      </figcaption>
      <ul
        className="sleep-daily-legend"
        aria-label="Tipos de descanso de la gráfica diaria"
      >
        {series.map(({ key, label, color }) => (
          <li key={key}>
            <i style={{ background: color }} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      <div className="sleep-daily-chart-canvas" data-testid="sleep-daily-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={days}
            accessibilityLayer
            aria-label="Horas totales de sueño por día y tipo"
            aria-describedby={`${id}-help`}
            margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#deded5"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="date"
              axisLine={{ stroke: '#c6cabd' }}
              tickLine={false}
              tick={{ fill: '#686a63', fontSize: 11 }}
              tickMargin={12}
              minTickGap={28}
              tickFormatter={(date: string) => formatSleepDate(date, false)}
            />
            <YAxis
              domain={[0, 'auto']}
              axisLine={false}
              tickLine={false}
              width={45}
              tick={{ fill: '#686a63', fontSize: 11 }}
              tickFormatter={(hours: number) => `${formatSleepHours(hours)} h`}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={{ fill: '#8f203509' }}
              content={({ active, label }) => {
                const day = byDate.get(String(label))
                if (!active || !day) return null
                return (
                  <div
                    className="sleep-daily-tooltip"
                    role="status"
                    data-testid="sleep-daily-tooltip"
                  >
                    <p>{formatSleepDate(day.date)}</p>
                    <strong>
                      {formatSleepHours(day.total)} h <small>en total</small>
                    </strong>
                    <dl>
                      {series
                        .filter(({ key }) => day.totals[key] > 0)
                        .map(({ key, label }) => (
                          <div key={key}>
                            <dt>{label}</dt>
                            <dd>{formatSleepHours(day.totals[key])} h</dd>
                          </div>
                        ))}
                    </dl>
                    <span>
                      {day.count} {day.count === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                )
              }}
            />
            {series.map(({ key, label, color }) => (
              <Bar
                key={key}
                dataKey={`totals.${key}`}
                name={label}
                stackId="sleep"
                fill={color}
                maxBarSize={58}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p id={`${id}-help`}>
        Cada barra suma una fecha con registros. Recorre las fechas con las
        flechas del teclado o consulta el desglose de abajo. Los días sin datos
        no se representan.
      </p>
    </figure>
  )
}
