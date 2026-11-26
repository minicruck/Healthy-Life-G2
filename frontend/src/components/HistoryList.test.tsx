import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import HistoryList from './HistoryList'

const records = Array.from({ length: 25 }, (_, index) => ({
  id: 25 - index,
}))

function history(entries: typeof records) {
  return (
    <HistoryList
      records={entries}
      label="Consumos registrados"
      className="water-history-list"
    >
      {(entry) => <li key={entry.id}>Consumo {entry.id}</li>}
    </HistoryList>
  )
}

describe('paginación del historial', () => {
  it('vuelve a la primera página al añadir un registro desde la tercera', async () => {
    const user = userEvent.setup()
    const { rerender } = render(history(records))
    const list = screen.getByRole('list', { name: 'Consumos registrados' })
    const next = screen.getByRole('button', { name: 'Siguiente' })

    await user.click(next)
    await user.click(next)
    expect(screen.getByRole('status')).toHaveTextContent('21–25 de 25')
    expect(within(list).queryByText('Consumo 25')).not.toBeInTheDocument()

    rerender(history([{ id: 26 }, ...records]))

    expect(screen.getByRole('status')).toHaveTextContent('1–10 de 26')
    expect(within(list).getByText('Consumo 26')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  })

  it('mantiene la página si la cantidad no cambia y la reinicia al eliminar', async () => {
    const user = userEvent.setup()
    const { rerender } = render(history(records))

    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    rerender(history([...records]))
    expect(screen.getByRole('status')).toHaveTextContent('11–20 de 25')

    rerender(history(records.slice(1)))
    expect(screen.getByRole('status')).toHaveTextContent('1–10 de 24')
  })
})
