import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterActivityPage from './RegisterActivityPage'

const fetchMock = vi.fn<typeof fetch>()
const getFetchMock = vi.fn<typeof fetch>()
const success = 'Horas de sueño registradas correctamente.'
const sleepRecord = {
  id: 1,
  sleepDate: '2026-10-11',
  hoursSlept: 7.5,
  sleepType: 'night',
  createdAt: '2026-10-11T15:00:00.000Z',
}
const jsonResponse = (body: unknown, status = 201) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'))
  fetchMock.mockReset()
  getFetchMock.mockReset()
  getFetchMock.mockImplementation(async () => jsonResponse([], 200))
  // Keep the original assertions specific to POST, independently of dashboard reads.
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === 'POST'
      ? fetchMock(input, init)
      : getFetchMock(input, init),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function openSleep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Horas de sueño' }))
  return {
    date: screen.getByLabelText(/Fecha del sueño/),
    hours: screen.getByRole('spinbutton', { name: 'Horas dormidas' }),
    type: screen.getByRole('combobox', { name: 'Tipo de descanso' }),
    save: screen.getByRole('button', { name: 'Guardar horas de sueño' }),
  }
}

describe('HU2 en la aplicación de Healthy Life', () => {
  it('muestra HU1 por defecto y permite elegir HU2 con el teclado', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    expect(getFetchMock).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Actividad física' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Registrar actividad física',
    )
    expect(
      screen.getByRole('button', { name: 'Guardar actividad' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('spinbutton', { name: 'Horas dormidas' }),
    ).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Actividad física' }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Horas de sueño' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Registrar horas de sueño',
    )
    expect(
      screen.getByRole('button', { name: 'Horas de sueño' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('spinbutton', { name: 'Horas dormidas' }),
    ).toBeVisible()
    expect(
      screen.getByText('Ir al formulario', { selector: '.skip-link' }),
    ).toHaveAttribute('href', '#sleep-form')
  })

  it('conserva el borrador de HU1 y su endpoint al volver desde HU2', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    await user.selectOptions(screen.getByRole('combobox'), 'walking')
    fireEvent.change(screen.getByLabelText(/Fecha de la actividad/), {
      target: { value: '2026-10-11' },
    })
    await user.type(
      screen.getByRole('textbox', { name: 'Observaciones' }),
      '  Paseo  ',
    )
    await openSleep(user)
    await user.click(screen.getByRole('button', { name: 'Actividad física' }))
    expect(screen.getByRole('textbox', { name: 'Observaciones' })).toHaveValue(
      '  Paseo  ',
    )
    expect(screen.getByRole('combobox')).toHaveValue('walking')
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 2,
        activityType: 'walking',
        activityDate: '2026-10-11',
        notes: 'Paseo',
        createdAt: sleepRecord.createdAt,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Guardar actividad' }))
    expect(
      await screen.findByText('Actividad registrada correctamente.'),
    ).toBeVisible()
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3001/api/activities',
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      activityType: 'walking',
      activityDate: '2026-10-11',
      notes: 'Paseo',
    })
  })

  it.each([8, 7.5, 24])(
    'envía %s horas como número y confirma el 201 válido',
    async (hoursSlept) => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValue(jsonResponse({ ...sleepRecord, hoursSlept }))
      render(<RegisterActivityPage />)
      const fields = await openSleep(user)
      fireEvent.change(fields.date, {
        target: { value: sleepRecord.sleepDate },
      })
      await user.selectOptions(fields.type, 'night')
      await user.type(fields.hours, String(hoursSlept))
      expect(screen.queryByText(success)).not.toBeInTheDocument()
      await user.click(fields.save)
      expect(await screen.findByText(success)).toBeVisible()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/sleep')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        sleepDate: sleepRecord.sleepDate,
        hoursSlept,
        sleepType: 'night',
      })
      expect(fields.hours).toHaveValue(null)
    },
  )

  it('vincula los errores, enfoca la fecha vacía e impide enviar', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    const fields = await openSleep(user)
    fireEvent.change(fields.date, { target: { value: '' } })
    await user.click(fields.save)
    expect(fields.date).toHaveFocus()
    for (const field of [fields.date, fields.hours]) {
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveAccessibleDescription()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['0', '-1', '24.1'])(
    'rechaza %s horas sin realizar HTTP',
    async (hours) => {
      const user = userEvent.setup()
      render(<RegisterActivityPage />)
      const fields = await openSleep(user)
      await user.type(fields.hours, hours)
      await user.click(fields.save)
      expect(fields.hours).toHaveAttribute('aria-invalid', 'true')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('bloquea envíos simultáneos y espera al servidor para confirmar', async () => {
    let finish!: (response: Response) => void
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    const fields = await openSleep(user)
    fireEvent.change(fields.date, { target: { value: sleepRecord.sleepDate } })
    await user.selectOptions(fields.type, 'night')
    await user.type(fields.hours, '7.5')
    await user.dblClick(fields.save)
    fireEvent.submit(fields.save.closest('form')!)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Guardando horas de sueño…' }),
    ).toBeDisabled()
    expect(fields.hours).toBeDisabled()
    expect(fields.date).toBeDisabled()
    expect(fields.type).toBeDisabled()
    expect(screen.queryByText(success)).not.toBeInTheDocument()
    await act(async () => finish(jsonResponse(sleepRecord)))
    expect(await screen.findByText(success)).toBeVisible()
  })

  it.each(['network', 'validation', 'unexpected'])(
    'conserva los datos y no anuncia éxito ante %s',
    async (failure) => {
      if (failure === 'network')
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      else if (failure === 'validation')
        fetchMock.mockResolvedValue(
          jsonResponse(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Las horas de sueño no son válidas.',
              },
            },
            400,
          ),
        )
      else
        fetchMock.mockResolvedValue(
          jsonResponse({ ...sleepRecord, hoursSlept: 4 }),
        )
      const user = userEvent.setup()
      render(<RegisterActivityPage />)
      const fields = await openSleep(user)
      fireEvent.change(fields.date, {
        target: { value: sleepRecord.sleepDate },
      })
      await user.selectOptions(fields.type, 'night')
      await user.type(fields.hours, '7.5')
      await user.click(fields.save)
      expect(await screen.findByRole('alert')).toBeVisible()
      expect(screen.queryByText(success)).not.toBeInTheDocument()
      expect(fields.hours).toHaveValue(7.5)
      expect(fields.date).toHaveValue(sleepRecord.sleepDate)
      expect(fields.save).toBeEnabled()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    },
  )
})
