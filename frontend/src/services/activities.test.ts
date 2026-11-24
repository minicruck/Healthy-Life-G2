import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity, ActivityPayload } from '../types/activity'
import { ApiError, createActivity, listActivities } from './activities'

const payload: ActivityPayload = {
  activityType: 'walking',
  activityDate: '2026-10-09',
  intensity: 'moderate',
  notes: 'Paseo por el parque',
}
const activity: Activity = {
  id: 1,
  ...payload,
  notes: payload.notes!,
  createdAt: '2026-10-09T10:30:00.000Z',
}
const fetchMock = vi.fn<typeof fetch>()
const jsonResponse = (body: unknown, status = 201) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
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

describe('POST /api/activities', () => {
  it('posts the exact contract JSON to the real endpoint and accepts a valid 201', async () => {
    fetchMock.mockResolvedValue(jsonResponse(activity))
    await expect(createActivity(payload)).resolves.toEqual(activity)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/activities',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: expect.any(AbortSignal),
      },
    )
  })

  it('uses the configured URL and removes trailing slashes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ' https://healthy.example.test/e2/// ')
    fetchMock.mockResolvedValue(jsonResponse(activity))
    await createActivity(payload)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://healthy.example.test/e2/api/activities',
    )
  })

  it.each([
    '  Paseo por el parque',
    'Paseo por el parque  ',
    '  Paseo por el parque  ',
  ])(
    'sends normalized notes (%j) and accepts the matching 201',
    async (notes) => {
      fetchMock.mockResolvedValue(jsonResponse(activity))
      await expect(createActivity({ ...payload, notes })).resolves.toEqual(
        activity,
      )
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(
        payload,
      )
    },
  )

  it.each(['  Paseo por el parque  ', 'Paseo  por el parque'])(
    'still rejects response notes that differ from the normalized request (%j)',
    async (notes) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...activity, notes }))
      await expect(
        createActivity({ ...payload, notes: '  Paseo por el parque  ' }),
      ).rejects.toMatchObject({ kind: 'unexpected', status: 201 })
    },
  )

  it.each([undefined, '', '   ', ' \n\t '])(
    'omits blank optional notes (%j) and expects null in the response',
    async (notes) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...activity, notes: null }))
      await expect(
        createActivity({ ...payload, notes }),
      ).resolves.toHaveProperty('notes', null)
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
        activityType: 'walking',
        activityDate: '2026-10-09',
        intensity: 'moderate',
      })
    },
  )

  it('strips extra runtime fields, including userId and duration', async () => {
    fetchMock.mockResolvedValue(jsonResponse(activity))
    await createActivity({
      ...payload,
      userId: 6,
      duration: 30,
    } as ActivityPayload)
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(
      payload,
    )
  })

  it('rejects invalid local input before making a request', async () => {
    await expect(
      createActivity({ ...payload, activityDate: '2026-02-30' }),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([200, 202])(
    'never confirms a successful-looking HTTP %i response',
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(activity, status))
      await expect(createActivity(payload)).rejects.toMatchObject({
        kind: 'unexpected',
        status,
      })
    },
  )

  it('rejects an empty HTTP 204 response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(createActivity(payload)).rejects.toMatchObject({
      kind: 'unexpected',
      status: 204,
    })
  })

  it('shows the agreed Spanish 400 validation message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'La fecha de la actividad no es válida.',
          },
        },
        400,
      ),
    )
    await expect(createActivity(payload)).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      message: 'La fecha de la actividad no es válida.',
    })
  })

  it.each([
    [404, 'NOT_FOUND', 'No se ha encontrado el servicio de registro'],
    [413, 'PAYLOAD_TOO_LARGE', 'La petición es demasiado grande'],
    [500, 'INTERNAL_ERROR', 'El servidor no ha podido completar el registro'],
  ])(
    'handles HTTP %i without leaking internal diagnostics',
    async (status, code, message) => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { error: { code, message: 'SQLITE_PRIVATE_ERROR' } },
          status,
        ),
      )
      await expect(createActivity(payload)).rejects.toMatchObject({
        kind: 'http',
        status,
        message: expect.stringContaining(message),
      })
      expect(fetchMock).toHaveBeenCalledOnce()
    },
  )

  it('keeps HTTP status context when an error response is not JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Service unavailable</html>', { status: 500 }),
    )
    await expect(createActivity(payload)).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    })
  })

  it.each([
    {},
    { error: { code: 'OTHER', message: 'private' } },
    { error: { code: 'VALIDATION_ERROR', message: '' } },
    { error: { code: 'VALIDATION_ERROR', message: 'x'.repeat(501) } },
  ])('provides a safe fallback for malformed 400 error data', async (body) => {
    fetchMock.mockResolvedValue(jsonResponse(body, 400))
    await expect(createActivity(payload)).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      message: expect.stringContaining('El servidor no ha aceptado los datos'),
    })
  })

  it('handles an unspecified failed HTTP status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHORIZED' } }, 401),
    )
    await expect(createActivity(payload)).rejects.toMatchObject({
      kind: 'http',
      status: 401,
    })
  })

  it('distinguishes a network failure and never retries the POST', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(createActivity(payload)).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('No se ha podido conectar'),
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects invalid JSON in an HTTP 201 response', async () => {
    fetchMock.mockResolvedValue(
      new Response('this is not JSON', { status: 201 }),
    )
    await expect(createActivity(payload)).rejects.toMatchObject({
      kind: 'unexpected',
      status: 201,
    })
  })

  it.each([
    null,
    [],
    {},
    { ...activity, id: 0 },
    { ...activity, id: 1.5 },
    { ...activity, id: '1' },
    { ...activity, activityType: 'swimming' },
    { ...activity, activityType: 'running' },
    { ...activity, activityDate: '2026-02-30' },
    { ...activity, activityDate: '2026-10-10' },
    { ...activity, notes: undefined },
    { ...activity, notes: 4 },
    { ...activity, notes: null },
    { ...activity, notes: 'Different activity' },
    { ...activity, notes: 'x'.repeat(501) },
    // HU4: la respuesta debe confirmar la misma intensidad enviada.
    { ...activity, intensity: undefined },
    { ...activity, intensity: null },
    { ...activity, intensity: 'high' },
    { ...activity, intensity: 'extreme' },
    { ...activity, createdAt: '2026-10-09' },
    { ...activity, createdAt: '2026-02-30T10:30:00.000Z' },
    { ...activity, createdAt: '2026-10-09T24:00:00.000Z' },
    { ...activity, createdAt: '2026-10-09T10:60:00.000Z' },
    { ...activity, createdAt: '2026-10-09T10:30:60.000Z' },
    { ...activity, createdAt: '2026-10-09T10:30:00+02:00' },
    { ...activity, createdAt: '2026-10-09T10:30:00.000Z\n' },
  ])(
    'rejects malformed or unrelated HTTP 201 activity data: %j',
    async (body) => {
      fetchMock.mockResolvedValue(jsonResponse(body))
      await expect(createActivity(payload)).rejects.toBeInstanceOf(ApiError)
    },
  )

  it('accepts an ISO UTC timestamp without fractional seconds', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...activity, createdAt: '2026-10-09T10:30:00Z' }),
    )
    await expect(createActivity(payload)).resolves.toHaveProperty(
      'createdAt',
      '2026-10-09T10:30:00Z',
    )
  })

  it('also accepts ISO 8601 UTC expressed with an explicit zero offset', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...activity, createdAt: '2026-10-09T10:30:00+00:00' }),
    )
    await expect(createActivity(payload)).resolves.toHaveProperty(
      'createdAt',
      '2026-10-09T10:30:00+00:00',
    )
  })

  it('times out after 15 seconds, aborts the request and does not retry', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const request = createActivity(payload)
    const result = expect(request).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(15_000)
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('also limits the time spent reading the response body', async () => {
    vi.useFakeTimers()
    const response = jsonResponse(activity)
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}))
    fetchMock.mockResolvedValue(response)
    const result = expect(createActivity(payload)).rejects.toMatchObject({
      kind: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(15_000)
    await result
  })

  it('cleans up its timeout and signal listener after success', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    fetchMock.mockResolvedValue(jsonResponse(activity))
    await createActivity(payload, { signal: controller.signal })
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('cancels an in-flight request when the caller aborts', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const result = expect(
      createActivity(payload, { signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('cancelado'),
    })
    controller.abort()
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
  })

  it('does not start a request for an already cancelled signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      createActivity(payload, { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'network' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('HU4 · intensidad en GET /api/activities', () => {
  const stored = { ...activity, id: 2, intensity: 'high' }

  it('devuelve la intensidad de cada registro del historial', async () => {
    fetchMock.mockResolvedValue(jsonResponse([stored], 200))
    await expect(listActivities()).resolves.toEqual([stored])
  })

  it.each([null, undefined])(
    'acepta registros anteriores a HU4 sin intensidad (%j) como null',
    async (intensity) => {
      fetchMock.mockResolvedValue(
        jsonResponse([{ ...stored, intensity }], 200),
      )
      await expect(listActivities()).resolves.toEqual([
        { ...stored, intensity: null },
      ])
    },
  )

  it('rechaza una intensidad desconocida en el historial', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ ...stored, intensity: 'extreme' }], 200),
    )
    await expect(listActivities()).rejects.toMatchObject({ kind: 'unexpected' })
  })
})
