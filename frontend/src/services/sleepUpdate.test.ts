import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SleepPayload, SleepRecord } from '../types/sleep'
import { SleepApiError, updateSleep } from './sleep'

const original: SleepRecord = {
  id: 7,
  sleepDate: '2026-10-09',
  hoursSlept: 6,
  sleepType: 'night',
  createdAt: '2026-10-10T10:30:00.000Z',
}
const payload: SleepPayload = {
  sleepDate: '2026-10-11',
  hoursSlept: 1.25,
  sleepType: 'nap',
}
const updated: SleepRecord = { ...original, ...payload }
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

describe('PATCH /api/sleep/:id', () => {
  it('envía solo los campos editables al registro correcto y confirma un HTTP 200 coincidente', async () => {
    fetchMock.mockResolvedValue(jsonResponse(updated))
    await expect(updateSleep(original, payload)).resolves.toEqual(updated)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sleep/7',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: expect.any(AbortSignal),
      },
    )
    expect(original.hoursSlept).toBe(6)
    expect(original.sleepType).toBe('night')
  })

  it('respeta la URL configurada sin espacios ni barras finales', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ' https://healthy.example.test/e2/// ')
    fetchMock.mockResolvedValue(jsonResponse(updated))
    await updateSleep(original, payload)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://healthy.example.test/e2/api/sleep/7',
    )
  })

  it('elimina userId, id, createdAt y campos ajenos del JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse(updated))
    await updateSleep(original, {
      ...payload,
      userId: 'other-user',
      id: 99,
      createdAt: '2026-10-12T12:00:00Z',
      notes: 'unrelated',
    } as SleepPayload)
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(
      payload,
    )
  })

  it('permite corregir y clasificar un registro histórico futuro con tipo null', async () => {
    const historical: SleepRecord = {
      ...original,
      sleepDate: '2099-12-31',
      sleepType: null,
    }
    fetchMock.mockResolvedValue(jsonResponse(updated))
    await expect(updateSleep(historical, payload)).resolves.toEqual(updated)
    expect(historical.sleepType).toBeNull()
    expect(historical.sleepDate).toBe('2099-12-31')
  })

  it.each(['night', 'nap', 'other'] as const)(
    'admite y confirma exactamente el tipo %s',
    async (sleepType) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...updated, sleepType }))
      await expect(
        updateSleep(original, { ...payload, sleepType }),
      ).resolves.toEqual({ ...updated, sleepType })
    },
  )

  it.each([1e-9, 0.0001, 7.125, 24])(
    'conserva las horas sin redondear (%s)',
    async (hoursSlept) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...updated, hoursSlept }))
      await expect(
        updateSleep(original, { ...payload, hoursSlept }),
      ).resolves.toEqual({ ...updated, hoursSlept })
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
        ...payload,
        hoursSlept,
      })
    },
  )

  it.each([
    null,
    {},
    { ...original, id: 0 },
    { ...original, id: -1 },
    { ...original, id: 1.5 },
    { ...original, id: '7' },
    { ...original, id: Number.MAX_SAFE_INTEGER + 1 },
    { ...original, sleepDate: '2026-02-30' },
    { ...original, hoursSlept: 0 },
    { ...original, sleepType: undefined },
    { ...original, sleepType: 'unknown' },
    { ...original, createdAt: undefined },
    { ...original, createdAt: '2026-10-10' },
  ])(
    'rechaza un registro original inválido antes del envío (%j)',
    async (record) => {
      await expect(
        updateSleep(record as SleepRecord, payload),
      ).rejects.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each([
    { ...payload, sleepDate: '' },
    { ...payload, sleepDate: '2026-02-30' },
    { ...payload, sleepDate: '0000-01-01' },
    { ...payload, sleepDate: '2026-10-13' },
    { ...payload, sleepDate: '2099-12-31' },
    { ...payload, hoursSlept: 0 },
    { ...payload, hoursSlept: -1 },
    { ...payload, hoursSlept: 24.01 },
    { ...payload, hoursSlept: Infinity },
    { ...payload, hoursSlept: NaN },
    { ...payload, hoursSlept: '1.25' },
    { ...payload, sleepType: null },
    { ...payload, sleepType: undefined },
    { ...payload, sleepType: '' },
    { ...payload, sleepType: 'NAP' },
    { ...payload, sleepType: ' nap ' },
    { ...payload, sleepType: 'unknown' },
  ])(
    'no envía una edición inválida ni conserva null como clasificación (%j)',
    async (submitted) => {
      await expect(
        updateSleep(original, submitted as SleepPayload),
      ).rejects.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('permite el día de Madrid aunque UTC aún esté en el día anterior', async () => {
    vi.setSystemTime(new Date('2026-10-11T22:30:00Z'))
    const submitted = { ...payload, sleepDate: '2026-10-12' }
    fetchMock.mockResolvedValue(jsonResponse({ ...original, ...submitted }))
    await expect(updateSleep(original, submitted)).resolves.toMatchObject(
      submitted,
    )
  })

  it.each([201, 202, 206])(
    'rechaza datos válidos con HTTP %s porque la edición exige HTTP 200',
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(updated, status))
      await expect(updateSleep(original, payload)).rejects.toMatchObject({
        kind: 'unexpected',
        status,
      })
    },
  )

  it('rechaza un HTTP 204 sin confirmación', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(updateSleep(original, payload)).rejects.toMatchObject({
      kind: 'unexpected',
      status: 204,
    })
  })

  it.each([
    null,
    [],
    {},
    { ...updated, id: 8 },
    { ...updated, id: '7' },
    { ...updated, id: 0 },
    { ...updated, sleepDate: original.sleepDate },
    { ...updated, sleepDate: '2026-02-30' },
    { ...updated, hoursSlept: original.hoursSlept },
    { ...updated, hoursSlept: '1.25' },
    { ...updated, hoursSlept: 0 },
    { ...updated, sleepType: original.sleepType },
    { ...updated, sleepType: null },
    { ...updated, sleepType: undefined },
    { ...updated, sleepType: 'unknown' },
    { ...updated, createdAt: '2026-10-12T12:00:00.000Z' },
    { ...updated, createdAt: '2026-10-10T10:30:00Z' },
    { ...updated, createdAt: '2026-02-30T10:30:00.000Z' },
    { ...updated, createdAt: undefined },
  ])(
    'rechaza respuestas malformadas, datos distintos o identidad modificada (%j)',
    async (body) => {
      fetchMock.mockResolvedValue(jsonResponse(body))
      const result = updateSleep(original, payload)
      await expect(result).rejects.toBeInstanceOf(SleepApiError)
      await expect(result).rejects.toMatchObject({
        kind: 'unexpected',
        status: 200,
        message: expect.stringContaining('No podemos confirmar los cambios'),
      })
      expect(fetchMock).toHaveBeenCalledOnce()
    },
  )

  it('conserva una copia de la identidad original durante la petición', async () => {
    const mutable = { ...original }
    fetchMock.mockResolvedValue(jsonResponse(updated))
    const request = updateSleep(mutable, payload)
    mutable.id = 99
    mutable.createdAt = '2026-10-12T12:00:00Z'
    await expect(request).resolves.toEqual(updated)
  })

  it.each(['', '<html>Error</html>', '{ incomplete'])(
    'rechaza JSON inválido en HTTP 200 (%j)',
    async (body) => {
      fetchMock.mockResolvedValue(new Response(body, { status: 200 }))
      await expect(updateSleep(original, payload)).rejects.toMatchObject({
        kind: 'unexpected',
        status: 200,
      })
    },
  )

  it('muestra el mensaje acordado de validación HTTP 400', async () => {
    const message = 'La fecha del sueño no puede ser futura.'
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message } }, 400),
    )
    await expect(updateSleep(original, payload)).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      message,
    })
  })

  it.each([
    [400, 'OTHER', 'El servidor no ha aceptado los datos'],
    [404, 'NOT_FOUND', 'No se ha encontrado el registro de sueño'],
    [413, 'PAYLOAD_TOO_LARGE', 'La petición es demasiado grande'],
    [500, 'INTERNAL_ERROR', 'El servidor no ha podido guardar los cambios'],
    [503, 'UNAVAILABLE', 'El servidor no ha podido guardar los cambios'],
    [401, 'UNAUTHORIZED', 'No se han podido guardar los cambios'],
  ])(
    'trata HTTP %s sin exponer detalles internos ni reintentar',
    async (status, code, message) => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { error: { code, message: 'PRIVATE_DIAGNOSTIC' } },
          status,
        ),
      )
      await expect(updateSleep(original, payload)).rejects.toMatchObject({
        kind: 'http',
        status,
        message: expect.stringContaining(message),
      })
      expect(fetchMock).toHaveBeenCalledOnce()
    },
  )

  it('mantiene el estado HTTP si el cuerpo del error no es JSON', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON', { status: 500 }))
    await expect(updateSleep(original, payload)).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    })
  })

  it('distingue un error de red y solo reintenta ante una nueva llamada explícita', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(updateSleep(original, payload)).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('No se ha podido conectar'),
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    fetchMock.mockResolvedValueOnce(jsonResponse(updated))
    await expect(updateSleep(original, payload)).resolves.toEqual(updated)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('aborta a los 15 segundos y limpia temporizador y listener sin reintentar', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const result = expect(
      updateSleep(original, payload, { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(14_999)
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('aplica el mismo plazo al cuerpo de respuesta', async () => {
    vi.useFakeTimers()
    const response = jsonResponse(updated)
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}))
    fetchMock.mockResolvedValue(response)
    const result = expect(updateSleep(original, payload)).rejects.toMatchObject(
      {
        kind: 'timeout',
      },
    )
    await vi.advanceTimersByTimeAsync(15_000)
    await result
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each([200, 500])('retira recursos tras HTTP %s', async (status) => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    fetchMock.mockResolvedValue(
      jsonResponse(status === 200 ? updated : {}, status),
    )
    const request = updateSleep(original, payload, {
      signal: controller.signal,
    })
    if (status === 200) {
      await expect(request).resolves.toEqual(updated)
    } else {
      await expect(request).rejects.toMatchObject({ kind: 'http', status })
    }
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('cancela una edición en curso sin reintentar y libera recursos', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const result = expect(
      updateSleep(original, payload, { signal: controller.signal }),
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

  it('no inicia una edición si el signal ya está cancelado', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      updateSleep(original, payload, { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'network' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
