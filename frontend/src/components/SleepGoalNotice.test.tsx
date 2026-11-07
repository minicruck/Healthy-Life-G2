import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SleepGoalNotice from './SleepGoalNotice'

const fetchMock = vi.fn<typeof fetch>()
const base = {
  minHours: 8,
  updatedAt: '2026-11-07T08:00:00.000Z',
  fromDate: '2026-11-01',
  toDate: '2026-11-07',
  days: [],
  latest: null,
  checked: null,
  alert: false,
}
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('HU10 · avisos en la pantalla de sueño', () => {
  it('CA3: sin objetivo, lo indica y permite ir a configurarlo', async () => {
    const user = userEvent.setup()
    const onConfigure = vi.fn()
    fetchMock.mockResolvedValueOnce(json({ ...base, minHours: null, updatedAt: null }))
    render(<SleepGoalNotice active revision={0} onConfigure={onConfigure} />)
    expect(await screen.findByText('Aún no has establecido un objetivo mínimo de sueño.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Configurar objetivo' }))
    expect(onConfigure).toHaveBeenCalledTimes(1)
  })

  it('CA4: tras guardar un registro por debajo del objetivo, muestra la notificación', async () => {
    fetchMock.mockResolvedValueOnce(json(base))
    const { rerender } = render(<SleepGoalNotice active revision={0} onConfigure={() => {}} />)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const latest = { date: '2026-11-07', totalHours: 5, met: false }
    fetchMock.mockResolvedValueOnce(json({ ...base, days: [latest], latest, checked: latest, alert: true }))
    rerender(<SleepGoalNotice active revision={1} onConfigure={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El 7/11/2026 dormiste 5 h, 3 h menos que tu objetivo de 8 h.',
    )
  })

  it('no muestra nada si se cumple el objetivo, si la API falla o si la pestaña no está activa', async () => {
    const latest = { date: '2026-11-07', totalHours: 9, met: true }
    fetchMock.mockResolvedValueOnce(json({ ...base, days: [latest], latest, checked: latest }))
    const { container, rerender } = render(
      <SleepGoalNotice active revision={0} onConfigure={() => {}} />,
    )
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(container).toBeEmptyDOMElement()

    fetchMock.mockRejectedValueOnce(new Error('caída'))
    rerender(<SleepGoalNotice active revision={1} onConfigure={() => {}} />)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(container).toBeEmptyDOMElement()

    rerender(<SleepGoalNotice active={false} revision={2} onConfigure={() => {}} />)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('evalúa el día del registro guardado aunque haya un día más reciente que cumple', async () => {
    // Caso de la revisión: 9 h hoy, se guardan 5 h de ayer con objetivo de 8 h.
    const today = { date: '2026-11-07', totalHours: 9, met: true }
    const yesterday = { date: '2026-11-06', totalHours: 5, met: false }
    fetchMock.mockResolvedValueOnce(
      json({ ...base, days: [today, yesterday], latest: today, checked: yesterday, alert: true }),
    )
    render(<SleepGoalNotice active revision={1} checkDate="2026-11-06" onConfigure={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El 6/11/2026 dormiste 5 h, 3 h menos que tu objetivo de 8 h.',
    )
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/sleep-goal?date=2026-11-06')
  })
})
