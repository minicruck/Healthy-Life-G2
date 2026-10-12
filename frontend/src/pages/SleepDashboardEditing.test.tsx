import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SleepDashboard from '../components/SleepDashboard'
import type { SleepRecord } from '../types/sleep'

vi.mock('../components/SleepEvolutionChart', () => ({ default: () => null }))
vi.mock('../components/SleepDailyChart', () => ({ default: () => null }))
const fetchMock = vi.fn<typeof fetch>()
const original: SleepRecord = {
  id: 2,
  sleepDate: '2026-10-12',
  hoursSlept: 1.5,
  sleepType: 'nap',
  createdAt: '2026-10-12T08:00:00.000Z',
}
const records: SleepRecord[] = [
  { ...original, id: 1, hoursSlept: 7, sleepType: 'night' },
  original,
  { ...original, id: 3, hoursSlept: 1, sleepType: 'other' },
  {
    ...original,
    id: 4,
    sleepDate: '2026-10-11',
    hoursSlept: 8,
    sleepType: 'night',
  },
]
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
async function edit(user: ReturnType<typeof userEvent.setup>) {
  const section = await screen.findByRole('region', {
    name: 'Tu descanso día a día',
  })
  await user.click(
    within(section).getByRole('button', { name: 'Editar registro #2' }),
  )
  return screen.getByRole('dialog', { name: 'Editar descanso' })
}

describe('edición integrada con el dashboard', () => {
  it('recalcula el ejemplo completo tras PATCH y GET, manteniendo 4 registros', async () => {
    const user = userEvent.setup()
    const saved = { ...original, hoursSlept: 2 }
    fetchMock
      .mockResolvedValueOnce(json(records))
      .mockResolvedValueOnce(json(saved))
      .mockResolvedValueOnce(
        json(records.map((record) => (record.id === 2 ? saved : record))),
      )
    render(<SleepDashboard active revision={0} />)
    expect(
      await screen.findByTestId('sleep-stat-daily-average'),
    ).toHaveTextContent('8,75')
    const dialog = await edit(user)
    fireEvent.change(within(dialog).getByRole('spinbutton'), {
      target: { value: '2' },
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar cambios' }),
    )
    await screen.findByText('Descanso actualizado correctamente.')
    await waitFor(() =>
      expect(screen.getByTestId('sleep-stat-total')).toHaveTextContent('18'),
    )
    expect(screen.getByTestId('sleep-stat-count')).toHaveTextContent('4')
    expect(screen.getByTestId('sleep-stat-daily-average')).toHaveTextContent(
      '9',
    )
    expect(screen.getByTestId('sleep-day-total-2026-10-12')).toHaveTextContent(
      '10 h',
    )
    expect(
      screen.getByRole('heading', { name: 'Tu descanso en cifras' }),
    ).toHaveFocus()
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3001/api/sleep/2')
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      sleepDate: '2026-10-12',
      hoursSlept: 2,
      sleepType: 'nap',
    })
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'GET'),
    ).toHaveLength(2)
  })

  it('cancelar descarta el borrador sin modificar las cifras ni enviar peticiones', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async () => json(records))
    render(<SleepDashboard active revision={0} />)
    const dialog = await edit(user)
    fireEvent.change(within(dialog).getByRole('spinbutton'), {
      target: { value: '10' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('sleep-stat-total')).toHaveTextContent('17,5')
    expect(within(await edit(user)).getByRole('spinbutton')).toHaveValue(1.5)
  })

  it('un error PATCH conserva los datos y no causa reintentos automáticos', async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(json(records))
      .mockRejectedValueOnce(new TypeError('offline'))
    render(<SleepDashboard active revision={0} />)
    const dialog = await edit(user)
    fireEvent.change(within(dialog).getByRole('spinbutton'), {
      target: { value: '2' },
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar cambios' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'No se ha confirmado la actualización',
    )
    expect(within(dialog).getByRole('spinbutton')).toHaveValue(2)
    expect(
      screen.queryByText('Descanso actualizado correctamente.'),
    ).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('GET fallido tras PATCH mantiene la confirmación y reintenta únicamente la consulta', async () => {
    const user = userEvent.setup()
    const saved = { ...original, hoursSlept: 2 }
    fetchMock
      .mockResolvedValueOnce(json(records))
      .mockResolvedValueOnce(json(saved))
      .mockRejectedValueOnce(new TypeError('offline'))
    render(<SleepDashboard active revision={0} />)
    const dialog = await edit(user)
    fireEvent.change(within(dialog).getByRole('spinbutton'), {
      target: { value: '2' },
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar cambios' }),
    )
    expect(
      await screen.findByText('Descanso actualizado correctamente.'),
    ).toBeVisible()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se han podido actualizar las estadísticas',
    )
    fetchMock.mockResolvedValueOnce(
      json(records.map((record) => (record.id === 2 ? saved : record))),
    )
    await user.click(
      screen.getByRole('button', { name: 'Reintentar consulta' }),
    )
    expect(await screen.findByTestId('sleep-stat-total')).toHaveTextContent(
      '18',
    )
    expect(
      screen.getByText('Descanso actualizado correctamente.'),
    ).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
    ).toHaveLength(1)
  })

  it('la edición de fecha cambia los grupos y el filtro sin borrar la fila', async () => {
    const user = userEvent.setup()
    const saved = { ...original, sleepDate: '2026-09-01' }
    fetchMock
      .mockResolvedValueOnce(json(records))
      .mockResolvedValueOnce(json(saved))
      .mockResolvedValueOnce(
        json(records.map((record) => (record.id === 2 ? saved : record))),
      )
    render(<SleepDashboard active revision={0} />)
    const dialog = await edit(user)
    fireEvent.change(within(dialog).getByLabelText(/Fecha del sueño/), {
      target: { value: '2026-09-01' },
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar cambios' }),
    )
    await waitFor(() =>
      expect(screen.getByTestId('sleep-stat-count')).toHaveTextContent('3'),
    )
    expect(screen.getByTestId('sleep-stat-total')).toHaveTextContent('16')
    await user.click(screen.getByRole('button', { name: 'Todo el historial' }))
    expect(screen.getByTestId('sleep-stat-count')).toHaveTextContent('4')
    expect(screen.getByTestId('sleep-stat-days')).toHaveTextContent('3')
    expect(screen.getByTestId('sleep-day-total-2026-09-01')).toHaveTextContent(
      '1,5 h',
    )
  })

  it('bloquea los envíos simultáneos mientras espera la confirmación real', async () => {
    const user = userEvent.setup()
    let finish!: (response: Response) => void
    fetchMock
      .mockResolvedValueOnce(json(records))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce(json(records))
    render(<SleepDashboard active revision={0} />)
    const dialog = await edit(user)
    const form = within(dialog)
      .getByRole('button', { name: 'Guardar cambios' })
      .closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled()
    expect(
      screen.queryByText('Descanso actualizado correctamente.'),
    ).not.toBeInTheDocument()
    await act(async () => finish(json(original)))
    await screen.findByText('Descanso actualizado correctamente.')
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
    ).toHaveLength(1)
  })
})
