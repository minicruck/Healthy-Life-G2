import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterActivityPage from './RegisterActivityPage'

const postMock = vi.fn<typeof fetch>()
const getMock = vi.fn<typeof fetch>()
let totalRequestCount = 0
let historyRequestCount = 0

const waterEntry = {
  id: 1,
  amountMl: 250,
  consumedDate: '2026-11-03',
  createdAt: '2026-11-03T08:30:00.000Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  postMock.mockReset()
  getMock.mockReset()
  totalRequestCount = 0
  historyRequestCount = 0
  getMock.mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/api/hydration-goal')) {
      return jsonResponse({ litersPerDay: null, updatedAt: null })
    }
    if (url.endsWith('/api/water/today')) {
      totalRequestCount += 1
      return jsonResponse({
        date: '2026-11-03',
        totalMl: totalRequestCount === 1 ? 0 : 250,
      })
    }
    historyRequestCount += 1
    return jsonResponse(historyRequestCount === 1 ? [] : [waterEntry])
  })
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === 'POST' ? postMock(input, init) : getMock(input, init),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('HU3 en la aplicación de Healthy Life', () => {
  it('permite abrir el registro de agua y muestra cero al no haber consumos', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)

    await user.click(screen.getByRole('button', { name: 'Agua' }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Registrar consumo de agua',
    )
    expect(screen.getByText('E1 · Hidratación')).toBeVisible()
    expect(
      screen.getByText('E1', { selector: '.section-marker' }),
    ).toBeVisible()
    expect(screen.getByText(/Módulo E1/)).toBeVisible()
    expect(await screen.findByText('0 ml')).toBeVisible()
    expect(
      await screen.findByText('Aún no hay consumos registrados.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Agua' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.queryByRole('button', { name: 'Meta de agua' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Objetivo diario' }),
    ).toBeVisible()
    expect(
      await screen.findByRole('spinbutton', { name: /Litros de agua al día/ }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Consumo de hoy' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Ir al formulario' }),
    ).toHaveAttribute('href', '#water-form')
  })

  it('valida cantidades vacías, cero y negativas sin enviarlas', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Agua' }))
    const amount = screen.getByRole('spinbutton', {
      name: 'Cantidad de agua (ml)',
    })
    const submit = screen.getByRole('button', { name: 'Añadir al total' })

    await user.click(submit)
    expect(
      await screen.findByText('Indica la cantidad de agua consumida.'),
    ).toBeVisible()
    await user.clear(amount)
    await user.type(amount, '0')
    await user.click(submit)
    expect(
      await screen.findByText(
        'La cantidad debe ser un número entero de mililitros mayor que 0.',
      ),
    ).toBeVisible()
    await user.clear(amount)
    fireEvent.change(amount, { target: { value: '-5' } })
    expect(amount).toHaveValue(-5)
    await user.click(submit)
    expect(
      screen.getByText(
        'La cantidad debe ser un número entero de mililitros mayor que 0.',
      ),
    ).toBeVisible()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('guarda el consumo y actualiza el total diario consultado', async () => {
    const user = userEvent.setup()
    postMock.mockResolvedValue(
      jsonResponse(
        {
          ...waterEntry,
          dailyTotalMl: 250,
        },
        201,
      ),
    )
    render(<RegisterActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Agua' }))
    const amount = screen.getByRole('spinbutton', {
      name: 'Cantidad de agua (ml)',
    })
    await user.type(amount, '250')
    await user.click(screen.getByRole('button', { name: 'Añadir al total' }))

    expect(
      await screen.findByText('Consumo de agua registrado correctamente.'),
    ).toBeVisible()
    expect(screen.getByText(/Total diario/)).toHaveTextContent('250 ml')
    expect(await screen.findByRole('listitem')).toHaveTextContent('250 ml')
    expect(postMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/water',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amountMl: 250 }),
      }),
    )
  })

  it('muestra los consumos guardados en una lista sencilla por fecha', async () => {
    const user = userEvent.setup()
    getMock.mockImplementation(async (input) =>
      String(input).endsWith('/api/water/today')
        ? jsonResponse({ date: '2026-11-03', totalMl: 750 })
        : jsonResponse([
            { ...waterEntry, id: 2, amountMl: 500 },
            {
              ...waterEntry,
              id: 3,
              amountMl: 900,
              consumedDate: '2026-11-02',
            },
          ]),
    )
    render(<RegisterActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Agua' }))

    const records = await screen.findAllByRole('listitem')
    expect(records).toHaveLength(2)
    expect(records[0]).toHaveTextContent('3 de noviembre de 2026')
    expect(records[0]).toHaveTextContent('500 ml')
    expect(records[1]).toHaveTextContent('2 de noviembre de 2026')
    expect(records[1]).toHaveTextContent('900 ml')
  })
})
