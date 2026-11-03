import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getHydrationGoal, saveHydrationGoal } from './hydrationGoal'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('meta diaria de hidratación', () => {
  it('carga una respuesta sin meta', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ litersPerDay: null, updatedAt: null }), {
        status: 200,
      }),
    )
    await expect(getHydrationGoal()).resolves.toEqual({
      litersPerDay: null,
      updatedAt: null,
    })
  })

  it('guarda una meta válida', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          litersPerDay: 2,
          updatedAt: '2026-11-03T12:30:00.000Z',
        }),
        { status: 200 },
      ),
    )
    await expect(saveHydrationGoal(2)).resolves.toMatchObject({
      litersPerDay: 2,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/hydration-goal',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ litersPerDay: 2 }),
      }),
    )
  })
})
