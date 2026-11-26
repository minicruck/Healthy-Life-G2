import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import ActivityHistory from './ActivityHistory'

afterEach(() => vi.unstubAllGlobals())

it('recupera el historial después de un fallo y permite consultar todos los registros', async () => {
  const user = userEvent.setup()
  const records = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    activityType: 'walking',
    activityDate: '2026-10-09',
    createdAt: '2026-10-09T10:30:00.000Z',
    notes: `Paseo ${index + 1}`,
  }))
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(Response.json(records))
  vi.stubGlobal('fetch', fetchMock)
  render(<ActivityHistory />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Comprueba la conexión',
  )
  expect(screen.queryByText('No hay registros disponibles.')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Reintentar consulta' }))
  const list = await screen.findByRole('list', {
    name: 'Actividades registradas',
  })
  expect(within(list).getAllByRole('listitem')).toHaveLength(10)
  expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Paseo 12')
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  expect(within(list).getByText('Paseo 1')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Anterior' }))
  expect(within(list).getByText('Paseo 12')).toBeVisible()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
