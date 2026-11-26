import { useState, type ReactNode } from 'react'
import './HistoryList.css'

const PAGE_SIZE = 10

type HistoryListProps<T extends { id: number }> = {
  records: readonly T[]
  label: string
  className: string
  children: (record: T) => ReactNode
}

export default function HistoryList<T extends { id: number }>({
  records,
  label,
  className,
  children,
}: HistoryListProps<T>) {
  const [selectedPage, setSelectedPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const page = Math.min(selectedPage, pageCount)
  const start = (page - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, records.length)

  return (
    <>
      <ul className={className} aria-label={label}>
        {records.slice(start, end).map(children)}
      </ul>
      {pageCount > 1 && (
        <nav
          className="history-pagination"
          aria-label={`Páginas de ${label.toLowerCase()}`}
        >
          <button
            type="button"
            className="secondary-button"
            disabled={page === 1}
            onClick={() => setSelectedPage(page - 1)}
          >
            Anterior
          </button>
          <span role="status">
            {start + 1}–{end} de {records.length}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={page === pageCount}
            onClick={() => setSelectedPage(page + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
    </>
  )
}
