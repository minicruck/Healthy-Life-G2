// HU4 — Registrar intensidad del entrenamiento (SCRUM-5): CA1, CA2 y CA3 en la pantalla real.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterActivityPage from './RegisterActivityPage'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 201) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function saved(intensity: string) {
  return {
    id: 7,
    activityType: 'running',
    activityDate: '2026-11-20',
    notes: null,
    intensity,
    createdAt: '2026-11-20T18:00:00.000Z',
  }
}

async function fillTraining(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Tipo de actividad' }),
    'running',
  )
  fireEvent.change(screen.getByLabelText(/Fecha de la actividad/), {
    target: { value: '2026-11-20' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('HU4 · Intensidad del entrenamiento', () => {
  it('ofrece tres niveles agrupados bajo una pregunta accesible', () => {
    render(<RegisterActivityPage />)
    const group = screen.getByRole('group', {
      name: 'Intensidad del entrenamiento',
    })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'low',
      'moderate',
      'high',
    ])
    expect(screen.getByRole('radio', { name: 'Alta' })).toHaveAccessibleDescription(
      'Muy exigente: te costaba hablar.',
    )
  })

  it.each([
    ['Baja', 'low'],
    ['Moderada', 'moderate'],
    ['Alta', 'high'],
  ])(
    'CA1: guarda el entrenamiento con intensidad %s y confirma el registro',
    async (label, value) => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValue(jsonResponse(saved(value)))
      render(<RegisterActivityPage />)
      await fillTraining(user)
      await user.click(screen.getByRole('radio', { name: label }))
      await user.click(screen.getByRole('button', { name: 'Guardar actividad' }))

      expect(
        await screen.findByText('Actividad registrada correctamente.'),
      ).toBeInTheDocument()
      expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
        activityType: 'running',
        activityDate: '2026-11-20',
        intensity: value,
      })
      // Tras guardar, el formulario vuelve a empezar sin intensidad marcada.
      expect(screen.getByRole('radio', { name: label })).not.toBeChecked()
    },
  )

  it('CA1: no confirma si el servidor devuelve otra intensidad distinta a la enviada', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(jsonResponse(saved('low')))
    render(<RegisterActivityPage />)
    await fillTraining(user)
    await user.click(screen.getByRole('radio', { name: 'Alta' }))
    await user.click(screen.getByRole('button', { name: 'Guardar actividad' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha confirmado el registro',
    )
    expect(screen.getByRole('radio', { name: 'Alta' })).toBeChecked()
  })

  it('CA2: el historial muestra la intensidad de cada entrenamiento', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        [
          { ...saved('high'), id: 3, activityDate: '2026-11-21' },
          { ...saved('low'), id: 2, activityDate: '2026-11-20' },
          { ...saved('moderate'), id: 1, activityDate: '2026-11-19', intensity: null },
        ],
        200,
      ),
    )
    render(<RegisterActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Ver historial' }))

    await screen.findByRole('heading', { name: 'Historial de actividades' })
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Intensidad alta')
    expect(items[1]).toHaveTextContent('Intensidad baja')
    // Registros guardados antes de HU4: se indica sin inventar un nivel.
    expect(items[2]).toHaveTextContent('Intensidad sin registrar')
  })

  it('CA3: sin intensidad no guarda, lo explica y lleva el foco al selector', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    await fillTraining(user)
    await user.click(screen.getByRole('button', { name: 'Guardar actividad' }))

    expect(fetchMock).not.toHaveBeenCalled()
    const group = screen.getByRole('group', {
      name: 'Intensidad del entrenamiento',
    })
    expect(group).toHaveAttribute('aria-invalid', 'true')
    expect(group).toHaveAccessibleDescription(
      expect.stringContaining('Selecciona la intensidad del entrenamiento.'),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Revisa los campos indicados antes de guardar.',
    )
    expect(screen.getByRole('radio', { name: 'Baja' })).toHaveFocus()
  })

  it('CA3: al elegir una intensidad desaparece el error y ya se puede guardar', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(jsonResponse(saved('moderate')))
    render(<RegisterActivityPage />)
    await fillTraining(user)
    await user.click(screen.getByRole('button', { name: 'Guardar actividad' }))
    expect(
      screen.getByText('Selecciona la intensidad del entrenamiento.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Moderada' }))
    expect(
      screen.queryByText('Selecciona la intensidad del entrenamiento.'),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar actividad' }))
    expect(
      await screen.findByText('Actividad registrada correctamente.'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
