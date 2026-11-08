import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SleepQualityForm from './SleepQualityForm'
import { getMadridToday } from '../lib/sleepCalendar'

const fetchMock = vi.fn<typeof fetch>()
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Calidad del sueño (CA1 - CA5)', () => {
  const today = getMadridToday()

  it('CA1: cuando elige fecha y valoración de 1 a 5 y guarda, se registra y se confirma', async () => {
    const user = userEvent.setup()
    // 1. Carga inicial del historial (vacío)
    fetchMock.mockResolvedValueOnce(json([]))
    // 2. Guardado exitoso (POST)
    fetchMock.mockResolvedValueOnce(
      json(
        {
          id: 1,
          sleepDate: today,
          rating: 4,
          notes: 'Dormí muy bien',
          createdAt: '2026-11-08T00:00:00.000Z',
          updatedAt: '2026-11-08T00:00:00.000Z',
          replaced: false,
        },
        201,
      ),
    )
    // 3. Recarga del historial tras guardar
    fetchMock.mockResolvedValueOnce(
      json([
        {
          id: 1,
          sleepDate: today,
          rating: 4,
          notes: 'Dormí muy bien',
          createdAt: '2026-11-08T00:00:00.000Z',
          updatedAt: '2026-11-08T00:00:00.000Z',
        },
      ]),
    )

    render(<SleepQualityForm />)

    // Comprobar estado inicial
    expect(
      await screen.findByText(
        'Todavía no tienes valoraciones de calidad de sueño registradas.',
      ),
    ).toBeInTheDocument()

    // Seleccionar valoración 4 (Buena)
    const rating4Btn = screen.getByRole('radio', { name: /4.*Buena/i })
    await user.click(rating4Btn)
    expect(rating4Btn).toHaveAttribute('aria-checked', 'true')

    // Escribir comentario opcional
    await user.type(
      screen.getByLabelText(/Comentario o sensaciones/),
      'Dormí muy bien',
    )

    // Guardar
    await user.click(
      screen.getByRole('button', { name: 'Guardar calidad del sueño' }),
    )

    // CA1: Se confirma el registro
    expect(
      await screen.findByText(
        'Valoración de calidad del sueño registrada correctamente.',
      ),
    ).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sleep-quality',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sleepDate: today,
          rating: 4,
          notes: 'Dormí muy bien',
          overwrite: false,
        }),
      }),
    )
  })

  it('CA2: la valoración es obligatoria (1 a 5); si falta, no se guarda y se avisa', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json([]))
    render(<SleepQualityForm />)

    await screen.findByText(
      'Todavía no tienes valoraciones de calidad de sueño registradas.',
    )

    // Intentar guardar sin haber seleccionado valoración
    await user.click(
      screen.getByRole('button', { name: 'Guardar calidad del sueño' }),
    )

    // CA2: Mensaje de error visible
    expect(
      await screen.findByText(
        'La valoración es obligatoria y debe ser un valor entre 1 y 5.',
      ),
    ).toBeInTheDocument()

    // No se debe haber llamado a POST
    expect(fetchMock).toHaveBeenCalledTimes(1) // Solo el GET inicial
  })

  it('CA3: no se permiten fechas futuras; se informa del error', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json([]))
    render(<SleepQualityForm />)

    await screen.findByText(
      'Todavía no tienes valoraciones de calidad de sueño registradas.',
    )

    // Elegir valoración válida
    await user.click(screen.getByRole('radio', { name: /5.*Excelente/i }))

    // Introducir fecha futura
    const dateInput = screen.getByLabelText(/Fecha de la noche de descanso/)
    await user.clear(dateInput)
    await user.type(dateInput, '2099-12-31')

    await user.click(
      screen.getByRole('button', { name: 'Guardar calidad del sueño' }),
    )

    // CA3: Informa del error de fecha futura
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se permiten fechas futuras.')

    // No se llama al servidor
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('CA4: una valoración por noche: si ya existe, se ofrece sustituirla sin duplicar', async () => {
    const user = userEvent.setup()
    const existingRecord = {
      id: 10,
      sleepDate: today,
      rating: 2,
      notes: 'Mala noche',
      createdAt: '2026-11-07T00:00:00.000Z',
      updatedAt: '2026-11-07T00:00:00.000Z',
    }

    // Inicialmente ya hay un registro para hoy
    fetchMock.mockResolvedValueOnce(json([existingRecord]))

    render(<SleepQualityForm />)

    // Esperar a que cargue
    expect(
      await screen.findByText(/Último descanso valorado/i),
    ).toBeInTheDocument()

    // Seleccionamos valoración 5 para la misma fecha (hoy)
    await user.click(screen.getByRole('radio', { name: /5.*Excelente/i }))
    await user.click(
      screen.getByRole('button', { name: 'Guardar calidad del sueño' }),
    )

    // CA4: Se ofrece sustituirla
    expect(
      await screen.findByText('Ya existe una valoración para esta noche'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/¿Deseas sustituirla sin duplicar\?/i),
    ).toBeInTheDocument()

    // Mockeamos la respuesta de sustitución con overwrite: true
    fetchMock.mockResolvedValueOnce(
      json({
        ...existingRecord,
        rating: 5,
        replaced: true,
      }),
    )
    fetchMock.mockResolvedValueOnce(
      json([{ ...existingRecord, rating: 5 }]),
    )

    // Hacemos clic en Sustituir valoración
    const replaceBtn = screen.getByRole('button', {
      name: 'Sustituir valoración',
    })
    await user.click(replaceBtn)

    // Confirmación de sustitución
    expect(
      await screen.findByText(
        'Valoración actualizada correctamente sin duplicar.',
      ),
    ).toBeInTheDocument()

    // Verificamos que se envió overwrite: true
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sleep-quality',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sleepDate: today,
          rating: 5,
          notes: null,
          overwrite: true,
        }),
      }),
    )
  })

  it('CA5: comentario opcional de hasta 200 caracteres se guarda junto a la valoración', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json([]))
    render(<SleepQualityForm />)

    await screen.findByText(
      'Todavía no tienes valoraciones de calidad de sueño registradas.',
    )

    // Escribir comentario
    const notesInput = screen.getByLabelText(/Comentario o sensaciones/)
    await user.type(notesInput, 'He dormido 8 horas sin interrupciones.')

    // El contador de caracteres refleja el texto
    expect(screen.getByText(/38/)).toBeInTheDocument()
    expect(screen.getByText(/\/200 caracteres/)).toBeInTheDocument()
  })
})
