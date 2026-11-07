import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SleepGoalForm from './SleepGoalForm'
import { sleepAlertMessage, validateSleepGoalHours } from '../services/sleepGoal'

const fetchMock = vi.fn<typeof fetch>()
const empty = {
  minHours: null,
  updatedAt: null,
  fromDate: '2026-11-01',
  toDate: '2026-11-07',
  days: [],
  latest: null,
  alert: false,
}
const withGoal = {
  ...empty,
  minHours: 8,
  updatedAt: '2026-11-07T08:00:00.000Z',
  days: [
    { date: '2026-11-07', totalHours: 6.5, met: false },
    { date: '2026-11-06', totalHours: 9, met: true },
  ],
  latest: { date: '2026-11-07', totalHours: 6.5, met: false },
  alert: true,
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('HU10 · Objetivo mínimo de sueño', () => {
  it('sin objetivo ni registros invita a configurarlo e indica que aún no hay registros', async () => {
    fetchMock.mockResolvedValueOnce(json(empty))
    render(<SleepGoalForm />)
    expect(await screen.findByText('Establece cuántas horas quieres dormir')).toBeVisible()
    expect(screen.getByText('Aún no hay registros de sueño en los últimos 7 días.')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('guarda 9 horas con PUT y muestra el objetivo', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json(empty))
    fetchMock.mockResolvedValueOnce(json({ ...empty, minHours: 9, updatedAt: '2026-11-07T08:00:00.000Z' }))
    render(<SleepGoalForm />)
    await user.type(await screen.findByLabelText(/Horas mínimas de sueño/), '9')
    await user.click(screen.getByRole('button', { name: 'Guardar objetivo' }))

    expect(await screen.findByText('9 h como mínimo')).toBeVisible()
    expect(screen.getByText('Objetivo de sueño guardado correctamente.')).toBeVisible()
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3001/api/sleep-goal',
      expect.objectContaining({ method: 'PUT', body: '{"minHours":9}' }),
    )
  })

  it('acepta coma decimal', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json(empty))
    fetchMock.mockResolvedValueOnce(json({ ...empty, minHours: 7.5, updatedAt: '2026-11-07T08:00:00.000Z' }))
    render(<SleepGoalForm />)
    await user.type(await screen.findByLabelText(/Horas mínimas de sueño/), '7,5')
    await user.click(screen.getByRole('button', { name: 'Guardar objetivo' }))
    expect(await screen.findByText('7,5 h como mínimo')).toBeVisible()
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3001/api/sleep-goal',
      expect.objectContaining({ body: '{"minHours":7.5}' }),
    )
  })

  it.each(['', '-1', '0', '25', 'ocho'])('rechaza "%s" sin hacer PUT', async (value) => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json(empty))
    render(<SleepGoalForm />)
    const field = await screen.findByLabelText(/Horas mínimas de sueño/)
    if (value) await user.type(field, value)
    await user.click(screen.getByRole('button', { name: 'Guardar objetivo' }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('avisa cuando el último día no alcanza el objetivo y muestra el cumplimiento diario', async () => {
    fetchMock.mockResolvedValueOnce(json(withGoal))
    render(<SleepGoalForm />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No has alcanzado tu objetivo de sueño')
    expect(alert).toHaveTextContent('El 7/11/2026 dormiste 6,5 h, 1,5 h menos que tu objetivo de 8 h.')
    expect(screen.getByText('No cumplido')).toBeVisible()
    expect(screen.getByText('Cumplido')).toBeVisible()
    await waitFor(() => expect(screen.getByLabelText(/Horas mínimas de sueño/)).toHaveValue('8'))
  })

  it('comunica el error si la API no responde', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Servicio no disponible'))
    render(<SleepGoalForm />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
  })
})

describe('HU10 · reglas del servicio', () => {
  it('valida el rango (0, 24]', () => {
    expect(validateSleepGoalHours('24')).toBeNull()
    expect(validateSleepGoalHours('0,5')).toBeNull()
    expect(validateSleepGoalHours('24,5')).not.toBeNull()
    expect(validateSleepGoalHours('0')).not.toBeNull()
  })

  it('no genera aviso si no hay objetivo o se cumple', () => {
    expect(sleepAlertMessage(empty)).toBeNull()
    expect(sleepAlertMessage({ ...withGoal, alert: false })).toBeNull()
  })
})
