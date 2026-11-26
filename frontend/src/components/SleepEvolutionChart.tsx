import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from 'recharts'
import { formatSleepDate, formatSleepHours } from '../lib/sleepStatistics'
import type { SleepRecord } from '../types/sleep'
import SleepChartWindow from './SleepChartWindow'
import './SleepEvolutionChart.css'

type SleepEvolutionChartProps = { records: SleepRecord[] }

function SleepPoint({ cx, cy, payload }: DotItemDotProps) {
  const record = payload as SleepRecord
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill="#fffefa"
      stroke="#a71930"
      strokeWidth={1.8}
      data-sleep-record-id={record.id}
      data-sleep-date={record.sleepDate}
      data-hours-slept={record.hoursSlept}
    />
  )
}

/** The caller supplies every validated record in chronological order. */
export default function SleepEvolutionChart({
  records,
}: SleepEvolutionChartProps) {
  const identifier = useId()
  const titleId = `${identifier}-title`
  const explanationId = `${identifier}-explanation`
  const keyboardHelpId = `${identifier}-keyboard`

  // The dashboard owns the empty state; an empty series must never look like zero sleep.
  if (records.length === 0) return null

  const recordsById = new Map(records.map((record) => [record.id, record]))
  const maxHours = records.reduce(
    (max, record) => Math.max(max, record.hoursSlept),
    0,
  )
  const showYear =
    records[0].sleepDate.slice(0, 4) !==
    records[records.length - 1].sleepDate.slice(0, 4)

  return (
    <figure
      className="sleep-evolution sleep-chart-card"
      aria-labelledby={titleId}
    >
      <figcaption className="sleep-evolution-heading">
        <h3 id={titleId}>Evolución del descanso</h3>
        <span>Horas por registro</span>
      </figcaption>

      <SleepChartWindow items={records} unit="registros">
        {(visible) => (
          <div
            className="sleep-evolution-chart"
            data-testid="sleep-evolution-chart"
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart
                data={visible}
                accessibilityLayer
                aria-label="Evolución de las horas de sueño por registro"
                aria-describedby={`${explanationId} ${keyboardHelpId}`}
                margin={{ top: 16, right: 12, bottom: 8, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#deded5"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="id"
                  type="category"
                  allowDuplicatedCategory={false}
                  axisLine={{ stroke: '#c6cabd' }}
                  tickLine={false}
                  tick={{ fill: '#454a43', fontSize: 13 }}
                  tickMargin={12}
                  minTickGap={28}
                  interval="preserveStartEnd"
                  padding={{ left: 14, right: 14 }}
                  tickFormatter={(id: number) => {
                    const record = recordsById.get(id)
                    return record
                      ? formatSleepDate(record.sleepDate, showYear)
                      : ''
                  }}
                />
                <YAxis
                  type="number"
                  domain={[0, maxHours]}
                  allowDecimals
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#454a43', fontSize: 13 }}
                  tickMargin={9}
                  tickCount={5}
                  width="auto"
                  tickFormatter={(hours: number) =>
                    `${formatSleepHours(hours)} h`
                  }
                />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{
                    stroke: '#a8ae9d',
                    strokeWidth: 1,
                    strokeDasharray: '3 4',
                  }}
                  content={({ active, label }) => {
                    const record = recordsById.get(Number(label))
                    if (!active || !record) return null
                    return (
                      <div
                        className="sleep-evolution-tooltip"
                        role="status"
                        aria-live="polite"
                        data-testid="sleep-chart-tooltip"
                      >
                        <p>{formatSleepDate(record.sleepDate)}</p>
                        <strong>
                          {formatSleepHours(record.hoursSlept, true)}{' '}
                          <span>h</span>
                        </strong>
                        <span className="sleep-evolution-record-id">
                          Registro #{record.id}
                        </span>
                      </div>
                    )
                  }}
                />
                <Area
                  type="linear"
                  dataKey="hoursSlept"
                  name="Horas dormidas"
                  stroke="#a71930"
                  strokeWidth={2}
                  fill="#a71930"
                  fillOpacity={0.07}
                  dot={SleepPoint}
                  activeDot={{
                    r: 5,
                    fill: '#a71930',
                    stroke: '#fffefa',
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </SleepChartWindow>

      <p className="sleep-evolution-explanation" id={explanationId}>
        Cada punto corresponde a un descanso. El eje horizontal ordena los
        registros por fecha y omite los días sin datos.
      </p>
      <p className="sleep-evolution-keyboard" id={keyboardHelpId}>
        Toca un punto o recorre el gráfico con las flechas del teclado.
      </p>
    </figure>
  )
}
