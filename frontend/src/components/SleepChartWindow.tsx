import { useState, type ReactNode } from 'react'

const windowSize = 14

type SleepChartWindowProps<T> = {
  items: T[]
  unit: 'registros' | 'días'
  children: (visible: T[]) => ReactNode
}

/** Keep recent entries in view first. Moving the window never changes period totals. */
export default function SleepChartWindow<T>({
  items,
  unit,
  children,
}: SleepChartWindowProps<T>) {
  const [offset, setOffset] = useState(0)
  if (items.length <= windowSize) return <>{children(items)}</>

  const last = Math.ceil(items.length / windowSize) - 1
  const current = Math.min(offset, last)
  const end = items.length - current * windowSize
  const start = Math.max(0, end - windowSize)

  return (
    <>
      <div
        className="sleep-chart-window"
        role="group"
        aria-label={`Tramos de ${unit}`}
      >
        <span aria-live="polite" aria-atomic="true">
          {start + 1}–{end} de {items.length} {unit}
        </span>
        <button
          type="button"
          disabled={current === last}
          onClick={() => setOffset(current + 1)}
        >
          Más antiguos
        </button>
        <button
          type="button"
          disabled={current === 0}
          onClick={() => setOffset(current - 1)}
        >
          Más recientes
        </button>
      </div>
      {children(items.slice(start, end))}
    </>
  )
}
