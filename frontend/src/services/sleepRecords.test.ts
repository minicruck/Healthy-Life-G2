import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SleepRecord } from '../types/sleep'
import { getSleepRecords, SleepApiError } from './sleep'

const sleep: SleepRecord = {
  id: 1,
  sleepDate: '2026-10-09',
  hoursSlept: 7.5,
  sleepType: 'night',
  createdAt: '2026-10-10T10:30:00.000Z',
}
const fetchMock = vi.fn<typeof fetch>()
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_API_BASE_URL', '')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('GET /api/sleep', () => {
  it('consulta la API real sin cuerpo ni userId y devuelve los registros del servidor', async () => {
    fetchMock.mockResolvedValue(jsonResponse([sleep]))
    await expect(getSleepRecords()).resolves.toEqual([sleep])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/sleep', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: expect.any(AbortSignal),
    })
  })

  it('usa la URL configurada y elimina espacios y barras finales', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ' https://healthy.example.test/e2/// ')
    fetchMock.mockResolvedValue(jsonResponse([sleep]))
    await getSleepRecords()
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://healthy.example.test/e2/api/sleep',
    )
  })

  it('solo representa ausencia de datos con un array vacío confirmado por HTTP 200', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await expect(getSleepRecords()).resolves.toEqual([])
  })

  it.each(['night', 'nap', 'other', null] as const)(
    'acepta el tipo válido o null explícito para un registro histórico (%s)',
    async (sleepType) => {
      const record = { ...sleep, sleepType }
      fetchMock.mockResolvedValue(jsonResponse([record]))
      await expect(getSleepRecords()).resolves.toEqual([record])
    },
  )

  it('conserva un registro histórico futuro y sin clasificar sin inventar un tipo', async () => {
    const record = { ...sleep, sleepDate: '2099-12-31', sleepType: null }
    fetchMock.mockResolvedValue(jsonResponse([record]))
    await expect(getSleepRecords()).resolves.toEqual([record])
  })

  it('conserva el orden recibido y permite distintos registros del mismo día', async () => {
    const records: SleepRecord[] = [
      { ...sleep, id: 4, sleepDate: '2026-10-11', hoursSlept: 8 },
      { ...sleep, id: 2, sleepDate: '2026-10-11', hoursSlept: 7 },
      { ...sleep, id: 3, sleepDate: '2026-10-10', hoursSlept: 6.5 },
      sleep,
    ]
    fetchMock.mockResolvedValue(jsonResponse(records))
    await expect(getSleepRecords()).resolves.toEqual(records)
  })

  it('rechaza identificadores repetidos aunque los registros tengan fechas diferentes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([sleep, { ...sleep, sleepDate: '2026-10-10' }]),
    )
    await expect(getSleepRecords()).rejects.toMatchObject({
      kind: 'unexpected',
      status: 200,
    })
  })

  it.each([1e-9, 0.0001, 7.125, 24])(
    'conserva horas decimales válidas sin redondear (%s)',
    async (hoursSlept) => {
      fetchMock.mockResolvedValue(jsonResponse([{ ...sleep, hoursSlept }]))
      await expect(getSleepRecords()).resolves.toEqual([
        { ...sleep, hoursSlept },
      ])
    },
  )

  it.each([
    '0001-01-01',
    '0099-12-31',
    '2000-02-29',
    '2024-02-29',
    '9999-12-31',
  ])(
    'acepta una fecha gregoriana real y conserva el día (%s)',
    async (sleepDate) => {
      fetchMock.mockResolvedValue(jsonResponse([{ ...sleep, sleepDate }]))
      await expect(getSleepRecords()).resolves.toEqual([
        { ...sleep, sleepDate },
      ])
    },
  )

  it.each([
    '2026-10-10T10:30:00Z',
    '2026-10-10T10:30:00.1Z',
    '2026-10-10T10:30:00.123456789Z',
    '2026-10-10T10:30:00+00:00',
    '2024-02-29T23:59:59.999+00:00',
  ])('acepta fechas de creación válidas en UTC (%s)', async (createdAt) => {
    fetchMock.mockResolvedValue(jsonResponse([{ ...sleep, createdAt }]))
    await expect(getSleepRecords()).resolves.toEqual([{ ...sleep, createdAt }])
  })

  it.each([null, {}, { records: [] }, '', '[]', 0, false])(
    'rechaza un cuerpo que no sea un array, sin convertirlo en vacío (%j)',
    async (body) => {
      fetchMock.mockResolvedValue(jsonResponse(body))
      await expect(getSleepRecords()).rejects.toMatchObject({
        kind: 'unexpected',
        status: 200,
      })
    },
  )

  it.each([
    null,
    [],
    {},
    8,
    'registro',
    { ...sleep, id: 0 },
    { ...sleep, id: -1 },
    { ...sleep, id: 1.5 },
    { ...sleep, id: '1' },
    { ...sleep, id: null },
    { ...sleep, id: undefined },
    { ...sleep, id: Number.MAX_SAFE_INTEGER + 1 },
    { ...sleep, sleepDate: undefined },
    { ...sleep, sleepDate: null },
    { ...sleep, sleepDate: '2026-02-30' },
    { ...sleep, sleepDate: '1900-02-29' },
    { ...sleep, sleepDate: '0000-01-01' },
    { ...sleep, sleepDate: '2026-10-09\n' },
    { ...sleep, sleepDate: '2026-10-09T00:00:00Z' },
    { ...sleep, hoursSlept: undefined },
    { ...sleep, hoursSlept: null },
    { ...sleep, hoursSlept: '7.5' },
    { ...sleep, hoursSlept: true },
    { ...sleep, hoursSlept: 0 },
    { ...sleep, hoursSlept: -1 },
    { ...sleep, hoursSlept: 24.01 },
    { ...sleep, sleepType: undefined },
    { ...sleep, sleepType: '' },
    { ...sleep, sleepType: 'unknown' },
    { ...sleep, sleepType: 'NIGHT' },
    { ...sleep, sleepType: ' night ' },
    { ...sleep, sleepType: 1 },
    { ...sleep, sleepType: true },
    { ...sleep, sleepType: {} },
    { ...sleep, createdAt: undefined },
    { ...sleep, createdAt: null },
    { ...sleep, createdAt: '2026-10-10' },
    { ...sleep, createdAt: '2026-02-30T10:30:00Z' },
    { ...sleep, createdAt: '2026-10-10T24:00:00Z' },
    { ...sleep, createdAt: '2026-10-10T10:60:00Z' },
    { ...sleep, createdAt: '2026-10-10T10:30:60Z' },
    { ...sleep, createdAt: '2026-10-10T10:30:00+02:00' },
    { ...sleep, createdAt: '2026-10-10T10:30:00' },
    { ...sleep, createdAt: '2026-10-10T10:30:00.000Z\n' },
  ])(
    'rechaza la respuesta completa si uno de sus registros es inválido (%j)',
    async (record) => {
      fetchMock.mockResolvedValue(jsonResponse([{ ...sleep, id: 2 }, record]))
      const result = getSleepRecords()
      await expect(result).rejects.toBeInstanceOf(SleepApiError)
      await expect(result).rejects.toMatchObject({
        kind: 'unexpected',
        status: 200,
      })
    },
  )

  it('rechaza un número JSON cuyo exponente excede el rango finito', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '[{"id":1,"sleepDate":"2026-10-09","hoursSlept":1e400,"sleepType":"night","createdAt":"2026-10-10T10:30:00Z"}]',
        { status: 200 },
      ),
    )
    await expect(getSleepRecords()).rejects.toMatchObject({
      kind: 'unexpected',
      status: 200,
    })
  })

  it.each([201, 202, 206])(
    'no acepta un array con estado HTTP %i en lugar de 200',
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse([sleep], status))
      await expect(getSleepRecords()).rejects.toMatchObject({
        kind: 'unexpected',
        status,
      })
    },
  )

  it('rechaza un HTTP 204 sin datos en lugar de mostrar una lista vacía', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(getSleepRecords()).rejects.toMatchObject({
      kind: 'unexpected',
      status: 204,
    })
  })

  it.each(['', '<html>Error</html>', '[{ incomplete'])(
    'rechaza respuestas HTTP 200 con JSON inválido (%j)',
    async (body) => {
      fetchMock.mockResolvedValue(new Response(body, { status: 200 }))
      await expect(getSleepRecords()).rejects.toMatchObject({
        kind: 'unexpected',
        status: 200,
      })
    },
  )

  it('muestra un mensaje de validación 400 válido en español', async () => {
    const message = 'La consulta de sueño no es válida.'
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message } }, 400),
    )
    await expect(getSleepRecords()).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      message,
    })
  })

  it.each([
    null,
    {},
    { error: { code: 'OTHER', message: 'INTERNAL_DETAIL' } },
    { error: { code: 'VALIDATION_ERROR', message: '' } },
    { error: { code: 'VALIDATION_ERROR', message: ' \t\n' } },
    { error: { code: 'VALIDATION_ERROR', message: 'x'.repeat(501) } },
    { error: { code: 'VALIDATION_ERROR', message: 8 } },
  ])(
    'usa un mensaje seguro si el error 400 está mal formado (%j)',
    async (body) => {
      fetchMock.mockResolvedValue(jsonResponse(body, 400))
      await expect(getSleepRecords()).rejects.toMatchObject({
        kind: 'http',
        status: 400,
        message: expect.stringContaining('No se han podido consultar'),
      })
    },
  )

  it.each([
    [404, 'NOT_FOUND', 'No se ha encontrado el servicio de consulta'],
    [500, 'INTERNAL_ERROR', 'El servidor no ha podido cargar los registros'],
    [503, 'UNAVAILABLE', 'El servidor no ha podido cargar los registros'],
  ])(
    'trata HTTP %i sin exponer detalles internos ni reintentar',
    async (status, code, message) => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { error: { code, message: 'SQLITE_PRIVATE_ERROR' } },
          status,
        ),
      )
      await expect(getSleepRecords()).rejects.toMatchObject({
        kind: 'http',
        status,
        message: expect.stringContaining(message),
      })
      expect(fetchMock).toHaveBeenCalledOnce()
    },
  )

  it('conserva el estado HTTP cuando el cuerpo del error no es JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Error</html>', { status: 500 }),
    )
    await expect(getSleepRecords()).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    })
  })

  it('trata otros estados HTTP con un mensaje de consulta seguro', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ private: 'INTERNAL_DETAIL' }, 401),
    )
    await expect(getSleepRecords()).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      message: expect.stringContaining('No se han podido consultar'),
    })
  })

  it('distingue un error de red de un listado vacío', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getSleepRecords()).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('No se ha podido conectar'),
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('espera 15 segundos, aborta y limpia el temporizador sin reintentar', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => new Promise(() => {}))
    let settled = false
    const request = getSleepRecords()
    const result = expect(request).rejects.toMatchObject({ kind: 'timeout' })
    void request.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    await vi.advanceTimersByTimeAsync(14_999)
    expect(settled).toBe(false)
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aplica el plazo también a la lectura del cuerpo de respuesta', async () => {
    vi.useFakeTimers()
    const response = jsonResponse([sleep])
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}))
    fetchMock.mockResolvedValue(response)
    const result = expect(getSleepRecords()).rejects.toMatchObject({
      kind: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(15_000)
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
  })

  it.each([200, 500])(
    'limpia temporizadores y listeners al finalizar con HTTP %i',
    async (status) => {
      vi.useFakeTimers()
      const controller = new AbortController()
      const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
      fetchMock.mockResolvedValue(
        jsonResponse(status === 200 ? [sleep] : {}, status),
      )
      const request = getSleepRecords({ signal: controller.signal })
      if (status === 200) {
        await expect(request).resolves.toEqual([sleep])
      } else {
        await expect(request).rejects.toMatchObject({ kind: 'http', status })
      }
      expect(vi.getTimerCount()).toBe(0)
      expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    },
  )

  it('cancela la consulta en curso al abortar y retira su listener', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const result = expect(
      getSleepRecords({ signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('cancelado'),
    })
    controller.abort()
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('no inicia una petición cuyo signal ya está cancelado', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      getSleepRecords({ signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'network' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
