import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterActivityPage from './RegisterActivityPage'

const successMessage = 'Actividad registrada correctamente.'
const fetchMock = vi.fn<typeof fetch>()

function activityResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    activityType: 'walking',
    activityDate: '2026-10-09',
    notes: null,
    createdAt: '2026-10-09T10:30:00.000Z',
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 201) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fields() {
  return {
    type: screen.getByRole('combobox', { name: 'Tipo de actividad' }),
    date: screen.getByLabelText(/Fecha de la actividad/),
    notes: screen.getByRole('textbox', { name: 'Observaciones' }),
    submit: screen.getByRole('button', { name: 'Guardar actividad' }),
  }
}

async function completeRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
) {
  const form = fields()
  await user.selectOptions(form.type, 'walking')
  fireEvent.change(form.date, { target: { value: '2026-10-09' } })
  return form
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

describe('Registrar actividad física', () => {
  it('presenta los campos de HU1, sus cinco opciones y la fecha local de hoy', () => {
    render(<RegisterActivityPage />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Registrar actividad física',
      }),
    ).toBeInTheDocument()
    const form = fields()
    expect(form.date).toHaveAccessibleName('Fecha de la actividad')
    expect(form.type).toHaveValue('')
    for (const [name, value] of [
      ['Caminar', 'walking'],
      ['Correr', 'running'],
      ['Bicicleta', 'cycling'],
      ['Gimnasio / entrenamiento', 'gym'],
      ['Otra', 'other'],
    ]) {
      expect(screen.getByRole('option', { name })).toHaveValue(value)
    }
    const today = new Date()
    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    expect(form.date).toHaveValue(localDate)
    expect(form.notes).toHaveValue('')
    expect(form.submit).toBeEnabled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/duración|intensidad|usuario/i),
    ).not.toBeInTheDocument()
  })

  it('permite seleccionar cada tipo de actividad', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    for (const activity of ['walking', 'running', 'cycling', 'gym', 'other']) {
      await user.selectOptions(fields().type, activity)
      expect(fields().type).toHaveValue(activity)
    }
  })

  it('muestra el historial con registros ordenados de más reciente a más antiguo', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        [
          { id: 2, activityType: 'walking', activityDate: '2026-10-09', notes: 'Paseo tardío', createdAt: '2026-10-09T20:00:00Z' },
          { id: 1, activityType: 'running', activityDate: '2026-10-08', notes: 'Sesión matutina', createdAt: '2026-10-08T08:00:00Z' },
        ],
        200,
      ),
    )

    render(<RegisterActivityPage />)

    await user.click(screen.getByRole('button', { name: 'Ver historial' }))

    expect(
      await screen.findByRole('heading', { name: 'Historial de actividades' }),
    ).toBeInTheDocument()
    const listItems = screen.getAllByRole('listitem')
    expect(listItems).toHaveLength(2)
    expect(listItems[0]).toHaveTextContent('Paseo tardío')
    expect(listItems[1]).toHaveTextContent('Sesión matutina')
  })

  it('muestra un mensaje cuando no hay registros disponibles', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(jsonResponse([], 200))

    render(<RegisterActivityPage />)

    await user.click(screen.getByRole('button', { name: 'Ver historial' }))

    expect(
      await screen.findByText('No hay registros disponibles.'),
    ).toBeInTheDocument()
  })

  it('valida los campos obligatorios sin enviar y vincula los errores a sus campos', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    const form = fields()
    fireEvent.change(form.date, { target: { value: '' } })
    await user.click(form.submit)

    expect(form.type).toHaveAttribute('aria-invalid', 'true')
    expect(form.date).toHaveAttribute('aria-invalid', 'true')
    for (const input of [form.type, form.date]) {
      const descriptionIds =
        input.getAttribute('aria-describedby')?.split(' ') ?? []
      expect(descriptionIds.length).toBeGreaterThan(0)
      expect(
        descriptionIds.some((id) =>
          Boolean(document.getElementById(id)?.textContent),
        ),
      ).toBe(true)
    }
    expect(form.type).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('muestra el error al abandonar un campo obligatorio vacío', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    const { type } = fields()
    await user.click(type)
    await user.tab()
    expect(type).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('impide enviar una fecha inexistente que rechaza el selector nativo', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    const form = await completeRequiredFields(user)
    fireEvent.change(form.date, { target: { value: '2026-02-30' } })
    await user.click(form.submit)
    expect(form.date).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    'Ruta por el parque',
    '  Ruta por el parque',
    'Ruta por el parque  ',
    '  Ruta por el parque  ',
  ])(
    'normaliza las observaciones %j en el JSON y confirma solo después del 201 válido',
    async (notes) => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValue(
        jsonResponse(
          activityResponse({
            activityType: 'cycling',
            notes: 'Ruta por el parque',
          }),
        ),
      )
      render(<RegisterActivityPage />)
      const form = await completeRequiredFields(user)
      await user.selectOptions(form.type, 'cycling')
      await user.type(form.notes, notes)
      expect(form.notes).toHaveValue(notes)
      await user.click(form.submit)

      expect(await screen.findByText(successMessage)).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toBe('http://localhost:3001/api/activities')
      expect(init?.method).toBe('POST')
      expect(new Headers(init?.headers).get('Content-Type')).toBe(
        'application/json',
      )
      expect(JSON.parse(String(init?.body))).toEqual({
        activityType: 'cycling',
        activityDate: '2026-10-09',
        notes: 'Ruta por el parque',
      })
      expect(form.type).toHaveValue('')
      expect(form.notes).toHaveValue('')
    },
  )

  it.each(['', '   ', '\n\t '])(
    'omite las observaciones opcionales %j del JSON',
    async (notes) => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValue(jsonResponse(activityResponse()))
      render(<RegisterActivityPage />)
      const form = await completeRequiredFields(user)
      if (notes) await user.type(form.notes, notes)
      await user.click(form.submit)

      await screen.findByText(successMessage)
      expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
        activityType: 'walking',
        activityDate: '2026-10-09',
      })
    },
  )

  it('acepta exactamente 500 caracteres', async () => {
    const user = userEvent.setup()
    const notes = 'a'.repeat(500)
    fetchMock.mockResolvedValue(jsonResponse(activityResponse({ notes })))
    render(<RegisterActivityPage />)
    const form = await completeRequiredFields(user)
    fireEvent.change(form.notes, { target: { value: notes } })
    await user.click(form.submit)
    await screen.findByText(successMessage)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).notes).toBe(
      notes,
    )
  })

  it('rechaza más de 500 caracteres sin truncarlos ni enviar la petición', async () => {
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    const form = await completeRequiredFields(user)
    const notes = 'a'.repeat(501)
    fireEvent.change(form.notes, { target: { value: notes } })
    await user.click(form.submit)
    expect(form.notes).toHaveValue(notes)
    expect(form.notes).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('bloquea los campos y los envíos simultáneos mientras espera al servidor', async () => {
    let finishRequest!: (response: Response) => void
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finishRequest = resolve
        }),
    )
    const user = userEvent.setup()
    render(<RegisterActivityPage />)
    const form = await completeRequiredFields(user)
    await user.dblClick(form.submit)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Guardando actividad…' }),
    ).toBeDisabled()
    expect(form.type).toBeDisabled()
    expect(form.date).toBeDisabled()
    expect(form.notes).toBeDisabled()
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument()
    // Also exercise the form handler directly: a disabled button alone is not a request lock.
    fireEvent.submit(form.submit.closest('form')!)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishRequest(jsonResponse(activityResponse()))
    })
    expect(await screen.findByText(successMessage)).toBeInTheDocument()
    expect(form.type).toBeEnabled()
    expect(form.date).toBeEnabled()
    expect(form.notes).toBeEnabled()
  })

  it('muestra el mensaje español del 400 y conserva los datos para reintentar', async () => {
    const user = userEvent.setup()
    const message = 'La fecha de la actividad no es válida.'
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message } }, 400),
    )
    render(<RegisterActivityPage />)
    const form = await completeRequiredFields(user)
    await user.type(form.notes, '  Caminata tranquila  ')
    await user.click(form.submit)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(form.type).toHaveValue('walking')
    expect(form.date).toHaveValue('2026-10-09')
    expect(form.notes).toHaveValue('  Caminata tranquila  ')
    expect(form.submit).toBeEnabled()
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument()

    await user.selectOptions(form.type, 'running')
    expect(screen.getByText(message)).toBeInTheDocument()
    fetchMock.mockResolvedValue(
      jsonResponse(
        activityResponse({
          activityType: 'running',
          notes: 'Caminata tranquila',
        }),
      ),
    )
    await user.click(form.submit)
    expect(await screen.findByText(successMessage)).toBeInTheDocument()
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })

  it.each([
    [404, 'NOT_FOUND'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [500, 'INTERNAL_ERROR'],
  ])(
    'muestra un error, nunca éxito, ante HTTP %i (%s)',
    async (status, code) => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValue(
        jsonResponse(
          { error: { code, message: 'No se pudo completar la operación.' } },
          status,
        ),
      )
      render(<RegisterActivityPage />)
      const form = await completeRequiredFields(user)
      await user.click(form.submit)
      expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
      expect(screen.queryByText(successMessage)).not.toBeInTheDocument()
      expect(form.type).toHaveValue('walking')
      expect(form.submit).toBeEnabled()
    },
  )

  it('distingue el error de red y permite reintentar sin perder los datos', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<RegisterActivityPage />)
    const form = await completeRequiredFields(user)
    await user.click(form.submit)
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument()
    expect(form.type).toHaveValue('walking')
    expect(form.submit).toBeEnabled()
  })

  it.each([
    ['un 200 en vez de 201', () => jsonResponse(activityResponse(), 200)],
    ['JSON incompleto con 201', () => jsonResponse({ id: 1 })],
    [
      'HTML con 201',
      () => new Response('<html>Error del servidor</html>', { status: 201 }),
    ],
    [
      'JSON mal formado con 201',
      () => new Response('{ broken', { status: 201 }),
    ],
  ])('no confirma el registro ante %s', async (_description, response) => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(response())
    render(<RegisterActivityPage />)
    const form = await completeRequiredFields(user)
    await user.click(form.submit)
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument()
    expect(form.type).toHaveValue('walking')
    expect(form.submit).toBeEnabled()
  })

  it('retira la confirmación anterior cuando un nuevo intento falla', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(jsonResponse(activityResponse()))
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<RegisterActivityPage />)
    await user.click((await completeRequiredFields(user)).submit)
    await screen.findByText(successMessage)
    await user.click((await completeRequiredFields(user)).submit)
    await screen.findByRole('alert')
    await waitFor(() =>
      expect(screen.queryByText(successMessage)).not.toBeInTheDocument(),
    )
  })

  it('permite cambiar a la pestaña de calidad del sueño situada junto a objetivo de sueño', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(jsonResponse([], 200))
    render(<RegisterActivityPage />)

    const qualityBtn = screen.getByRole('button', {
      name: 'Calidad del sueño',
    })
    expect(qualityBtn).toBeInTheDocument()
    expect(qualityBtn).toHaveAttribute('aria-pressed', 'false')

    await user.click(qualityBtn)

    expect(qualityBtn).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Registrar calidad del sueño',
      }),
    ).toBeInTheDocument()
  })
})
