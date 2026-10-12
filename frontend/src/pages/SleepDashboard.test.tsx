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
import type { SleepRecord } from '../types/sleep'
import RegisterActivityPage from './RegisterActivityPage'

const endpoint = 'http://localhost:3001/api/sleep'
const savedMessage = 'Horas de sueño registradas correctamente.'
const fetchMock = vi.fn<typeof fetch>()
const getMock = vi.fn<typeof fetch>()
const postMock = vi.fn<typeof fetch>()
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const record = (
  id: number,
  sleepDate: string,
  hoursSlept: number,
): SleepRecord => ({
  id,
  sleepDate,
  hoursSlept,
  sleepType: 'night',
  createdAt: '2026-10-11T10:00:00.000Z',
})
const currentRecord = record(1, '2026-10-11', 8)

beforeEach(() => {
  // Only freeze Date: user events and async request settling keep real timers.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
  fetchMock.mockReset()
  getMock.mockReset()
  postMock.mockReset()
  getMock.mockImplementation(async () => jsonResponse([]))
  fetchMock.mockImplementation((input, init) =>
    init?.method === 'POST' ? postMock(input, init) : getMock(input, init),
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_API_BASE_URL', '')
  // jsdom has no layout observer. Keep the real chart and its accessible table.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: { width: 640, height: 260 },
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        )
      }
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function openDashboard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Horas de sueño' }))
  expect(
    screen.getByRole('heading', { name: 'Tu descanso en cifras' }),
  ).toBeVisible()
}

async function submitSleep(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Tipo de descanso' }),
    'night',
  )
  fireEvent.change(screen.getByLabelText(/Fecha del sueño/), {
    target: { value: '2026-10-11' },
  })
  await user.type(
    screen.getByRole('spinbutton', { name: 'Horas dormidas' }),
    '7.5',
  )
  await user.click(
    screen.getByRole('button', { name: 'Guardar horas de sueño' }),
  )
}

function expectStats(values: {
  average: number
  total: number
  count: number
  max: number
  min: number
}) {
  for (const [name, value] of Object.entries(values)) {
    expect(screen.getByTestId(`sleep-stat-${name}`).textContent).toBe(
      String(value).replace('.', ','),
    )
  }
}

describe('Seguimiento de sueño en la aplicación', () => {
  it('consulta solo al entrar en HU2 y conserva intactas las peticiones de HU1', async () => {
    const user = userEvent.setup()
    getMock.mockImplementation(async () => jsonResponse([currentRecord]))
    render(<RegisterActivityPage />)
    expect(fetchMock).not.toHaveBeenCalled()
    await user.type(
      screen.getByRole('textbox', { name: 'Observaciones' }),
      'Borrador de actividad',
    )
    expect(fetchMock).not.toHaveBeenCalled()

    await openDashboard(user)
    await screen.findByTestId('sleep-stat-count')
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(postMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Actividad física' }))
    expect(screen.getByRole('textbox', { name: 'Observaciones' })).toHaveValue(
      'Borrador de actividad',
    )
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('filtra por días inclusivos hasta hoy y calcula estadísticas de los registros reales sin hacer nuevos GET', async () => {
    const user = userEvent.setup()
    getMock.mockImplementation(async () =>
      jsonResponse([
        record(5, '2026-10-12', 12),
        currentRecord,
        record(2, '2026-10-05', 6),
        record(3, '2026-09-12', 10),
        record(4, '2026-09-11', 4),
      ]),
    )
    render(<RegisterActivityPage />)
    await openDashboard(user)
    await screen.findByTestId('sleep-stat-count')
    expect(
      screen.getByRole('button', { name: 'Últimos 7 días' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expectStats({ average: 7, total: 14, count: 2, max: 8, min: 6 })
    for (const label of [
      'Media por registro',
      'Total de horas',
      'Registros',
      'Máximo registrado',
      'Mínimo registrado',
    ]) {
      expect(screen.getByText(label)).toBeVisible()
    }

    await user.click(screen.getByRole('button', { name: 'Últimos 30 días' }))
    expectStats({ average: 8, total: 24, count: 3, max: 10, min: 6 })
    await user.click(screen.getByRole('button', { name: 'Todo el historial' }))
    expectStats({ average: 8, total: 40, count: 5, max: 12, min: 4 })
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(postMock).not.toHaveBeenCalled()
  })

  it('cuenta cada registro del mismo día sin inventar ceros para fechas ausentes', async () => {
    const user = userEvent.setup()
    getMock.mockImplementation(async () =>
      jsonResponse([
        currentRecord,
        record(2, '2026-10-11', 6),
        record(3, '2026-10-09', 4),
      ]),
    )
    render(<RegisterActivityPage />)
    await openDashboard(user)
    await screen.findByTestId('sleep-stat-count')
    expectStats({ average: 6, total: 18, count: 3, max: 8, min: 4 })
    await user.click(await screen.findByText(/Ver todos los registros/))
    const table = screen.getByRole('table', {
      name: 'Datos de la evolución del sueño',
    })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.getAttribute('data-sleep-row-id'))).toEqual([
      '3',
      '1',
      '2',
    ])
    expect(rows.map((row) => row.querySelector('time')?.dateTime)).toEqual([
      '2026-10-09',
      '2026-10-11',
      '2026-10-11',
    ])
    expect(
      rows.map((row) => within(row).getAllByRole('cell')[1].textContent),
    ).toEqual(['4 h', '8 h', '6 h'])
  })

  it('actualiza el período al volver a la pestaña después de medianoche local sin repetir el GET', async () => {
    const user = userEvent.setup()
    getMock.mockImplementation(async () =>
      jsonResponse([
        record(1, '2026-10-05', 6),
        record(2, '2026-10-11', 8),
        record(3, '2026-10-12', 10),
      ]),
    )
    render(<RegisterActivityPage />)
    await openDashboard(user)
    await screen.findByTestId('sleep-stat-count')
    expectStats({ average: 7, total: 14, count: 2, max: 8, min: 6 })
    expect(
      screen.getByText(
        'Hasta el 11 oct 2026, incluido. Sin contar fechas futuras.',
      ),
    ).toBeVisible()

    // El calendario del proyecto cambia a medianoche de Madrid, incluso en un proceso UTC.
    vi.setSystemTime(new Date('2026-10-11T22:01:00Z'))
    fireEvent(document, new Event('visibilitychange'))

    expect(
      screen.getByText(
        'Hasta el 12 oct 2026, incluido. Sin contar fechas futuras.',
      ),
    ).toBeVisible()
    expectStats({ average: 9, total: 18, count: 2, max: 10, min: 8 })
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(postMock).not.toHaveBeenCalled()
  })

  it('espera el GET sin presentar estadísticas inventadas ni impedir escribir en el formulario', async () => {
    let finish!: (response: Response) => void
    getMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    await openDashboard(user)
    expect(screen.getByText('Cargando tus registros…')).toHaveAttribute(
      'role',
      'status',
    )
    expect(screen.queryByTestId('sleep-stat-average')).not.toBeInTheDocument()
    const hours = screen.getByRole('spinbutton', { name: 'Horas dormidas' })
    await user.type(hours, '7.5')
    expect(hours).toHaveValue(7.5)
    expect(
      screen.getByRole('button', { name: 'Guardar horas de sueño' }),
    ).toBeEnabled()
    await act(async () => finish(jsonResponse([currentRecord])))
    await screen.findByTestId('sleep-stat-count')
    expectStats({ average: 8, total: 8, count: 1, max: 8, min: 8 })
    expect(hours).toHaveValue(7.5)
  })

  it('una lista vacía confirmada no muestra medias ni extremos ficticios', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    await openDashboard(user)
    expect(
      await screen.findByRole('heading', {
        name: 'Tu descanso empieza con un registro',
      }),
    ).toBeVisible()
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('sleep-stat-average')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sleep-stat-max')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sleep-stat-min')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Guardar horas de sueño' }),
    ).toBeEnabled()
  })

  it('distingue un período sin datos de un historial vacío y permite ampliar el período', async () => {
    const user = userEvent.setup()
    getMock.mockImplementation(async () =>
      jsonResponse([record(1, '2026-08-01', 8)]),
    )
    render(<RegisterActivityPage />)
    await openDashboard(user)
    expect(
      await screen.findByRole('heading', {
        name: 'No hay registros en este período',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Tu descanso empieza con un registro',
      }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('sleep-stat-average')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Ver todo el historial' }),
    )
    expectStats({ average: 8, total: 8, count: 1, max: 8, min: 8 })
    expect(
      screen.getByRole('button', { name: 'Todo el historial' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it.each(['network', 'invalid-json', 'invalid-record'])(
    'muestra un error de consulta ante %s, permite reintentar y conserva el borrador',
    async (failure) => {
      if (failure === 'network')
        getMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      else if (failure === 'invalid-json')
        getMock.mockResolvedValueOnce(new Response('not JSON', { status: 200 }))
      else
        getMock.mockResolvedValueOnce(
          jsonResponse([
            currentRecord,
            { ...record(2, '2026-10-11', 7), hoursSlept: '7' },
          ]),
        )
      const user = userEvent.setup()
      render(<RegisterActivityPage />)
      await openDashboard(user)
      expect(await screen.findByRole('alert')).toBeVisible()
      expect(screen.queryByTestId('sleep-stat-average')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('heading', {
          name: 'Tu descanso empieza con un registro',
        }),
      ).not.toBeInTheDocument()
      const hours = screen.getByRole('spinbutton', { name: 'Horas dormidas' })
      await user.type(hours, '7.5')
      getMock.mockImplementation(async () => jsonResponse([currentRecord]))
      await user.click(
        screen.getByRole('button', { name: 'Reintentar consulta' }),
      )
      await screen.findByTestId('sleep-stat-count')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expectStats({ average: 8, total: 8, count: 1, max: 8, min: 8 })
      expect(hours).toHaveValue(7.5)
      expect(getMock).toHaveBeenCalledTimes(2)
      expect(postMock).not.toHaveBeenCalled()
    },
  )

  it('actualiza desde el GET real después del POST confirmado, sin añadir registros optimistas', async () => {
    const user = userEvent.setup()
    const saved = record(9, '2026-10-11', 7.5)
    let finishRefresh!: (response: Response) => void
    getMock
      .mockResolvedValueOnce(jsonResponse([currentRecord]))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishRefresh = resolve
          }),
      )
    postMock.mockResolvedValueOnce(jsonResponse(saved, 201))
    render(<RegisterActivityPage />)
    await openDashboard(user)
    await screen.findByTestId('sleep-stat-count')
    await submitSleep(user)
    expect(await screen.findByText(savedMessage)).toBeVisible()
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(postMock.mock.calls[0][1]?.body))).toEqual({
      sleepDate: '2026-10-11',
      hoursSlept: 7.5,
      sleepType: 'night',
    })
    expect(
      screen.queryByTestId('sleep-stat-count')?.textContent ?? '',
    ).not.toBe('2')
    // The server list is authoritative even if it differs from the just-created record.
    await act(async () => finishRefresh(jsonResponse([saved])))
    await waitFor(() =>
      expectStats({ average: 7.5, total: 7.5, count: 1, max: 7.5, min: 7.5 }),
    )
    expect(screen.getByText(savedMessage)).toBeVisible()
  })

  it('mantiene el éxito del POST cuando falla la actualización del dashboard', async () => {
    const user = userEvent.setup()
    getMock
      .mockResolvedValueOnce(jsonResponse([currentRecord]))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    postMock.mockResolvedValueOnce(
      jsonResponse(record(2, '2026-10-11', 7.5), 201),
    )
    render(<RegisterActivityPage />)
    await openDashboard(user)
    await screen.findByTestId('sleep-stat-count')
    await submitSleep(user)
    expect(await screen.findByText(savedMessage)).toBeVisible()
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Reintentar consulta' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('spinbutton', { name: 'Horas dormidas' }),
    ).toHaveValue(null)
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(postMock).toHaveBeenCalledTimes(1)
  })

  it('no refresca el dashboard si el POST devuelve un registro que no coincide', async () => {
    const user = userEvent.setup()
    getMock.mockImplementation(async () => jsonResponse([currentRecord]))
    postMock.mockResolvedValueOnce(
      jsonResponse(record(2, '2026-10-11', 5), 201),
    )
    render(<RegisterActivityPage />)
    await openDashboard(user)
    await screen.findByTestId('sleep-stat-count')
    await submitSleep(user)
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByText(savedMessage)).not.toBeInTheDocument()
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('spinbutton', { name: 'Horas dormidas' }),
    ).toHaveValue(7.5)
    expectStats({ average: 8, total: 8, count: 1, max: 8, min: 8 })
  })

  it('cancela consultas al salir de HU2 y descarta respuestas antiguas al volver, conservando el borrador', async () => {
    const user = userEvent.setup()
    let finishOld!: (response: Response) => void
    getMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOld = resolve
          }),
      )
      .mockResolvedValueOnce(jsonResponse([currentRecord]))
    render(<RegisterActivityPage />)
    await openDashboard(user)
    await user.type(
      screen.getByRole('spinbutton', { name: 'Horas dormidas' }),
      '6.5',
    )
    const firstSignal = getMock.mock.calls[0][1]?.signal
    await user.click(screen.getByRole('button', { name: 'Actividad física' }))
    expect(firstSignal?.aborted).toBe(true)
    expect(getMock).toHaveBeenCalledTimes(1)
    await openDashboard(user)
    await screen.findByTestId('sleep-stat-count')
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole('spinbutton', { name: 'Horas dormidas' }),
    ).toHaveValue(6.5)
    await act(async () =>
      finishOld(jsonResponse([record(99, '2026-10-11', 20)])),
    )
    expectStats({ average: 8, total: 8, count: 1, max: 8, min: 8 })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
