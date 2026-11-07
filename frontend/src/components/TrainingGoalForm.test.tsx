import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingGoalForm from './TrainingGoalForm'

const fetchMock = vi.fn<typeof fetch>()
const summary = {
  daysPerWeek: 3,
  completedDays: 1,
  remainingDays: 2,
  weekStart: '2026-11-02',
  weekEnd: '2026-11-08',
  updatedAt: '2026-11-05T10:00:00.000Z',
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

describe('HU8 · Objetivo semanal de entrenamiento', () => {
  it('muestra un estado vacío y permite definir el objetivo', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json({ ...summary, daysPerWeek: null, remainingDays: null, updatedAt: null }))
    fetchMock.mockResolvedValueOnce(json(summary))

    render(<TrainingGoalForm />)
    expect(await screen.findByText('Establece tu meta semanal')).toBeVisible()
    await user.type(screen.getByRole('spinbutton'), '3')
    await user.click(screen.getByRole('button', { name: 'Guardar objetivo' }))

    expect(await screen.findByText('1 de 3 días')).toBeVisible()
    expect(screen.getByText('Te quedan 2 días para cumplirlo.')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1')
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3001/api/training-goal',
      expect.objectContaining({ method: 'PUT', body: '{"daysPerWeek":3}' }),
    )
  })

  it('bloquea valores fuera del rango, decimales y vacíos sin hacer PUT', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json(summary))
    render(<TrainingGoalForm />)
    const field = await screen.findByRole('spinbutton')
    await waitFor(() => expect(field).toHaveValue(3))
    await user.clear(field)
    await user.type(field, '8')
    await user.click(screen.getByRole('button', { name: 'Guardar objetivo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('entre 1 y 7')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('actualiza el progreso y comunica los fallos sin perder el objetivo', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json(summary))
    fetchMock.mockResolvedValueOnce(json({ ...summary, completedDays: 3, remainingDays: 0 }))
    render(<TrainingGoalForm />)
    expect(await screen.findByText('1 de 3 días')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Actualizar progreso' }))
    expect(await screen.findByText('¡Has alcanzado tu objetivo semanal!')).toBeVisible()
  })

  it('avisa cuando la API no responde', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Servicio no disponible'))
    render(<TrainingGoalForm />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
  })
})
