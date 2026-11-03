import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HydrationGoalForm from './HydrationGoalForm'

const fetchMock = vi.fn<typeof fetch>()

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('configuración de la meta diaria de agua', () => {
  it('indica que no hay meta y permite guardar una válida', async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(response({ litersPerDay: null, updatedAt: null }))
      .mockResolvedValueOnce(
        response({ litersPerDay: 2, updatedAt: '2026-11-03T12:30:00.000Z' }),
      )
    render(<HydrationGoalForm />)

    expect(
      await screen.findByText('Todavía no tienes un objetivo definido.'),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Litros de agua al día/), '2')
    await user.click(screen.getByRole('button', { name: 'Guardar objetivo' }))

    expect(
      await screen.findByText('Meta guardada correctamente.'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      litersPerDay: 2,
    })
  })

  it.each(['', '0', '-1'])(
    'rechaza el valor inválido %j sin modificar la meta',
    async (value) => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValueOnce(
        response({ litersPerDay: 2, updatedAt: '2026-11-03T12:30:00.000Z' }),
      )
      render(<HydrationGoalForm />)
      const input = await screen.findByLabelText(/Litros de agua al día/)
      await user.clear(input)
      if (value) await user.type(input, value)
      await user.click(screen.getByRole('button', { name: 'Guardar objetivo' }))

      expect(
        await screen.findByText('Introduce una meta mayor que 0 litros.'),
      ).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledOnce()
    },
  )
})
