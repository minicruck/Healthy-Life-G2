import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SleepPayload, SleepRecord } from '../types/sleep'
import { createSleep, SleepApiError } from './sleep'

const payload: SleepPayload = {
  sleepDate: '2026-10-09',
  hoursSlept: 7.5,
  sleepType: 'night',
}
const sleep: SleepRecord = {
  id: 1,
  ...payload,
  createdAt: '2026-10-09T10:30:00.000Z',
}
const fetchMock = vi.fn<typeof fetch>()
const jsonResponse = (body: unknown, status = 201) =>
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

describe('POST /api/sleep', () => {
  it('posts exact JSON to the real endpoint and accepts a matching HTTP 201', async () => {
    fetchMock.mockResolvedValue(jsonResponse(sleep))
    await expect(createSleep(payload)).resolves.toEqual(sleep)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/sleep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: expect.any(AbortSignal),
    })
  })

  it('trims the configured base URL and removes trailing slashes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ' https://healthy.example.test/e2/// ')
    fetchMock.mockResolvedValue(jsonResponse(sleep))
    await createSleep(payload)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://healthy.example.test/e2/api/sleep',
    )
  })

  it.each([1e-9, 0.0001, 7.125, 24])(
    'transmits hours as a number without imposing rounding or a step (%s)',
    async (hoursSlept) => {
      const record = { ...sleep, hoursSlept }
      fetchMock.mockResolvedValue(jsonResponse(record))
      await expect(createSleep({ ...payload, hoursSlept })).resolves.toEqual(
        record,
      )
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
        ...payload,
        hoursSlept,
      })
    },
  )

  it('strips extra runtime fields including userId and fields from other stories', async () => {
    fetchMock.mockResolvedValue(jsonResponse(sleep))
    await createSleep({
      ...payload,
      userId: 6,
      activityType: 'walking',
      notes: 'Private notes',
      duration: 60,
    } as SleepPayload)
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(
      payload,
    )
  })

  it.each([
    0,
    -1,
    24.01,
    Infinity,
    -Infinity,
    NaN,
    '8',
    null,
    undefined,
    true,
    [8],
    {},
  ])('rejects invalid runtime hours before fetch (%j)', async (hoursSlept) => {
    await expect(
      createSleep({ ...payload, hoursSlept } as SleepPayload),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['', '2026-02-30', '1900-02-29', '2026-10-09T00:00:00Z'])(
    'rejects invalid dates before fetch (%j)',
    async (sleepDate) => {
      await expect(createSleep({ ...payload, sleepDate })).rejects.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each(['2026-10-13', '2099-12-31', '9999-12-31'])(
    'rejects future dates before fetch (%s)',
    async (sleepDate) => {
      await expect(createSleep({ ...payload, sleepDate })).rejects.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each(['0001-01-01', '2000-02-29', '2026-10-12'])(
    'accepts past dates and today without changing their calendar day (%s)',
    async (sleepDate) => {
      const submitted = { ...payload, sleepDate }
      fetchMock.mockResolvedValue(jsonResponse({ ...sleep, ...submitted }))
      await expect(createSleep(submitted)).resolves.toMatchObject(submitted)
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(
        submitted,
      )
    },
  )

  it('uses the Madrid day when UTC is still on the previous date', async () => {
    vi.setSystemTime(new Date('2026-10-11T22:30:00Z'))
    const submitted = { ...payload, sleepDate: '2026-10-12' }
    fetchMock.mockResolvedValue(jsonResponse({ ...sleep, ...submitted }))
    await expect(createSleep(submitted)).resolves.toMatchObject(submitted)
    await expect(
      createSleep({ ...submitted, sleepDate: '2026-10-13' }),
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each(['night', 'nap', 'other'] as const)(
    'requires and transmits a supported sleep type (%s)',
    async (sleepType) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...sleep, sleepType }))
      await expect(
        createSleep({ ...payload, sleepType }),
      ).resolves.toMatchObject({
        sleepType,
      })
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
        ...payload,
        sleepType,
      })
    },
  )

  it.each([
    null,
    undefined,
    '',
    'NIGHT',
    ' night ',
    'unknown',
    1,
    true,
    {},
    [],
  ])(
    'rejects missing or invalid sleep types before fetch (%j)',
    async (sleepType) => {
      await expect(
        createSleep({ ...payload, sleepType } as SleepPayload),
      ).rejects.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each([200, 202])(
    'does not confirm a successful-looking HTTP %i response',
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(sleep, status))
      await expect(createSleep(payload)).rejects.toMatchObject({
        kind: 'unexpected',
        status,
      })
    },
  )

  it('rejects an empty HTTP 204 response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(createSleep(payload)).rejects.toMatchObject({
      kind: 'unexpected',
      status: 204,
    })
  })

  it('exposes the agreed Spanish 400 validation message', async () => {
    const message =
      'Las horas de sueño deben ser mayores que 0 y como máximo 24.'
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message } }, 400),
    )
    await expect(createSleep(payload)).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      message,
    })
  })

  it.each([1, 500])(
    'accepts a validation message at the allowed length boundary (%i)',
    async (length) => {
      const message = 'a'.repeat(length)
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: 'VALIDATION_ERROR', message } }, 400),
      )
      await expect(createSleep(payload)).rejects.toMatchObject({ message })
    },
  )

  it.each([
    [404, 'NOT_FOUND', 'No se ha encontrado el servicio de registro'],
    [413, 'PAYLOAD_TOO_LARGE', 'La petición es demasiado grande'],
    [500, 'INTERNAL_ERROR', 'El servidor no ha podido completar el registro'],
  ])(
    'handles HTTP %i with a safe message and no automatic retry',
    async (status, code, message) => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { error: { code, message: 'SQLITE_PRIVATE_ERROR' } },
          status,
        ),
      )
      await expect(createSleep(payload)).rejects.toMatchObject({
        kind: 'http',
        status,
        message: expect.stringContaining(message),
      })
      expect(fetchMock).toHaveBeenCalledOnce()
    },
  )

  it.each([
    null,
    {},
    { error: { code: 'OTHER', message: 'PRIVATE_DIAGNOSTIC' } },
    { error: { code: 'VALIDATION_ERROR', message: '' } },
    { error: { code: 'VALIDATION_ERROR', message: ' \t\n' } },
    { error: { code: 'VALIDATION_ERROR', message: 'x'.repeat(501) } },
    { error: { code: 'VALIDATION_ERROR', message: 123 } },
  ])('uses a safe fallback for malformed 400 error data (%j)', async (body) => {
    fetchMock.mockResolvedValue(jsonResponse(body, 400))
    await expect(createSleep(payload)).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      message: expect.stringContaining('El servidor no ha aceptado los datos'),
    })
  })

  it('keeps the HTTP status when an error body contains HTML', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Service unavailable</html>', { status: 500 }),
    )
    await expect(createSleep(payload)).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    })
  })

  it('handles other failed HTTP statuses without disclosing diagnostics', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: 'PRIVATE_DIAGNOSTIC' } }, 401),
    )
    await expect(createSleep(payload)).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      message: expect.not.stringContaining('PRIVATE_DIAGNOSTIC'),
    })
  })

  it('distinguishes a network failure and never retries a possibly stored POST', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(createSleep(payload)).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('No se ha podido conectar'),
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects invalid JSON in an HTTP 201 response', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON', { status: 201 }))
    await expect(createSleep(payload)).rejects.toMatchObject({
      kind: 'unexpected',
      status: 201,
    })
  })

  it.each([
    null,
    [],
    {},
    { ...sleep, id: 0 },
    { ...sleep, id: -1 },
    { ...sleep, id: 1.5 },
    { ...sleep, id: Number.MAX_SAFE_INTEGER + 1 },
    { ...sleep, id: '1' },
    { ...sleep, sleepDate: '2026-02-30' },
    { ...sleep, sleepDate: '2026-10-10' },
    { ...sleep, sleepDate: null },
    { ...sleep, hoursSlept: 0 },
    { ...sleep, hoursSlept: -1 },
    { ...sleep, hoursSlept: 24.01 },
    { ...sleep, hoursSlept: 8 },
    { ...sleep, hoursSlept: '7.5' },
    { ...sleep, hoursSlept: undefined },
    { ...sleep, hoursSlept: null },
    { ...sleep, sleepType: undefined },
    { ...sleep, sleepType: null },
    { ...sleep, sleepType: 'nap' },
    { ...sleep, sleepType: 'unknown' },
    { ...sleep, sleepType: 'NIGHT' },
    { ...sleep, sleepType: ' night ' },
    { ...sleep, sleepType: 1 },
    { ...sleep, createdAt: null },
    { ...sleep, createdAt: '2026-10-09' },
    { ...sleep, createdAt: '2026-02-30T10:30:00.000Z' },
    { ...sleep, createdAt: '1900-02-29T10:30:00Z' },
    { ...sleep, createdAt: '2026-10-09T24:00:00.000Z' },
    { ...sleep, createdAt: '2026-10-09T10:60:00.000Z' },
    { ...sleep, createdAt: '2026-10-09T10:30:60.000Z' },
    { ...sleep, createdAt: '2026-10-09T10:30:00+02:00' },
    { ...sleep, createdAt: '2026-10-09T10:30:00' },
    { ...sleep, createdAt: '2026-10-09T10:30:00.000Z\n' },
  ])('rejects malformed or unrelated HTTP 201 data (%j)', async (body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))
    const result = createSleep(payload)
    await expect(result).rejects.toBeInstanceOf(SleepApiError)
    await expect(result).rejects.toMatchObject({
      kind: 'unexpected',
      status: 201,
    })
  })

  it.each([
    '2026-10-09T10:30:00Z',
    '2026-10-09T10:30:00.1Z',
    '2026-10-09T10:30:00.123456789Z',
    '2026-10-09T10:30:00+00:00',
    '2024-02-29T23:59:59.999+00:00',
  ])(
    'accepts a real UTC timestamp in ISO 8601 format (%s)',
    async (createdAt) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...sleep, createdAt }))
      await expect(createSleep(payload)).resolves.toHaveProperty(
        'createdAt',
        createdAt,
      )
    },
  )

  it('waits 15 seconds before timing out, aborts the request and never retries', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => new Promise(() => {}))
    let settled = false
    const request = createSleep(payload)
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

  it('applies the same deadline to reading the response body', async () => {
    vi.useFakeTimers()
    const response = jsonResponse(sleep)
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}))
    fetchMock.mockResolvedValue(response)
    const result = expect(createSleep(payload)).rejects.toMatchObject({
      kind: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(15_000)
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
  })

  it('cleans up its timer and caller listener on successful completion', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    fetchMock.mockResolvedValue(jsonResponse(sleep))
    await createSleep(payload, { signal: controller.signal })
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('cleans up its timer and caller listener after a rejected response', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    fetchMock.mockResolvedValue(jsonResponse({}, 500))
    await expect(
      createSleep(payload, { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'http', status: 500 })
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('cancels an in-flight request when its caller aborts', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const result = expect(
      createSleep(payload, { signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('cancelado'),
    })
    controller.abort()
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not fetch when the caller signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      createSleep(payload, { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'network' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
