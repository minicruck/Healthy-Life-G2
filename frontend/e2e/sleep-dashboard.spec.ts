import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { SleepRecord } from '../src/types/sleep'

const endpoint = 'http://localhost:3001/api/sleep'
const success = 'Horas de sueño registradas correctamente.'

function record(
  id: number,
  sleepDate: string,
  hoursSlept: number,
): SleepRecord {
  return {
    id,
    sleepDate,
    hoursSlept,
    sleepType: 'night',
    createdAt: `2026-10-11T12:${String(id).padStart(2, '0')}:00.000Z`,
  }
}

// Deliberately unsorted: duplicate dates, both inclusive boundaries and a future date.
const history = [
  record(17, '2026-10-12', 9),
  record(15, '2026-10-11', 0.25),
  record(16, '2026-09-11', 4),
  record(12, '2026-10-05', 8),
  record(14, '2026-09-12', 0.75),
  record(11, '2026-10-11', 7.5),
  record(13, '2026-10-04', 6),
]

const recent = [history[3], history[5], history[1]]
const lastMonth = [history[4], history[6], ...recent]
const allHistory = [history[2], ...lastMonth, history[0]]

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T12:00:00.000Z'))
})

async function enterSleep(page: Page) {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Horas de sueño', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Tu descanso en cifras', exact: true }),
  ).toBeVisible()
}

async function mockHistory(page: Page, records: SleepRecord[] = history) {
  const requests = { get: 0, post: 0 }
  await page.route(endpoint, (route) => {
    if (route.request().method() === 'GET') {
      requests.get += 1
      return route.fulfill({ status: 200, json: records })
    }
    requests.post += 1
    return route.fulfill({ status: 405, json: { error: 'Unexpected POST' } })
  })
  return requests
}

async function assertStats(
  page: Page,
  values: {
    average: string
    total: string
    count: string
    max: string
    min: string
  },
) {
  for (const [name, value] of Object.entries(values)) {
    await expect(page.getByTestId(`sleep-stat-${name}`)).toHaveText(value)
  }
}

async function assertPoints(page: Page, records: SleepRecord[]) {
  const dots = page.locator('circle[data-sleep-record-id]')
  await expect(dots).toHaveCount(records.length)
  await expect
    .poll(() =>
      dots.evaluateAll((elements) =>
        elements.map((element) => ({
          id: Number(element.getAttribute('data-sleep-record-id')),
          date: element.getAttribute('data-sleep-date'),
          hours: Number(element.getAttribute('data-hours-slept')),
        })),
      ),
    )
    .toEqual(
      records.map((item) => ({
        id: item.id,
        date: item.sleepDate,
        hours: item.hoursSlept,
      })),
    )
}

async function assertAccessible(page: Page) {
  // Audit the settled colors, after the existing entrance/focus transitions.
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    )
  })
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(result.violations).toEqual([])
}

async function fillSleep(page: Page) {
  await page.getByLabel('Fecha del sueño').fill('2026-10-11')
  await page.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('7.5')
  await page.getByLabel('Tipo de descanso').selectOption('night')
}

test('consulta solo HU2 y filtra el mismo historial con límites inclusivos y sin agrupar fechas', async ({
  page,
}) => {
  const requests = await mockHistory(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', {
      name: 'Registrar actividad física',
      exact: true,
    }),
  ).toBeVisible()
  expect(requests).toEqual({ get: 0, post: 0 })

  await page
    .getByRole('button', { name: 'Horas de sueño', exact: true })
    .click()
  await assertStats(page, {
    average: '5,25',
    total: '15,75',
    count: '3',
    max: '8',
    min: '0,25',
  })
  await assertPoints(page, recent)
  await expect(
    page.getByRole('button', { name: 'Últimos 7 días', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(requests).toEqual({ get: 1, post: 0 })

  await page
    .getByRole('button', { name: 'Últimos 30 días', exact: true })
    .click()
  await assertStats(page, {
    average: '4,5',
    total: '22,5',
    count: '5',
    max: '8',
    min: '0,25',
  })
  await assertPoints(page, lastMonth)

  await page
    .getByRole('button', { name: 'Todo el historial', exact: true })
    .click()
  await assertStats(page, {
    average: '5,07',
    total: '35,5',
    count: '7',
    max: '9',
    min: '0,25',
  })
  await assertPoints(page, allHistory)

  await page
    .getByRole('button', { name: 'Últimos 7 días', exact: true })
    .click()
  await assertPoints(page, recent)
  expect(requests).toEqual({ get: 1, post: 0 })
})

test('expone los puntos exactos por ratón, teclado y tabla accesible', async ({
  page,
}) => {
  await mockHistory(page)
  await enterSleep(page)
  await assertPoints(page, recent)

  const point = page.locator('circle[data-sleep-record-id="11"]')
  await point.hover()
  const tooltip = page.getByTestId('sleep-chart-tooltip')
  await expect(tooltip).toContainText('Registro #11')
  await expect(tooltip).toContainText('7,5')

  const chart = page.getByRole('application', {
    name: 'Evolución de las horas de sueño por registro',
  })
  await page.mouse.move(0, 0)
  await chart.focus()
  await expect(chart).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(tooltip).toContainText('Registro #12')
  await page.keyboard.press('ArrowRight')
  await expect(tooltip).toContainText('Registro #11')
  await page.keyboard.press('ArrowRight')
  await expect(tooltip).toContainText('Registro #15')
  await expect(tooltip).toContainText('0,25')
  await expect(chart).toBeFocused()

  const summary = page
    .locator('summary')
    .filter({ hasText: 'Ver todos los registros' })
  await summary.focus()
  await page.keyboard.press('Enter')
  const table = page.getByRole('table', {
    name: 'Datos de la evolución del sueño',
  })
  await expect(table).toBeVisible()
  await expect(table.locator('tbody tr')).toHaveCount(3)
  for (const item of recent) {
    const row = table.locator(`tr[data-sleep-row-id="${item.id}"]`)
    await expect(row.locator('time')).toHaveAttribute(
      'datetime',
      item.sleepDate,
    )
    await expect(
      row.getByRole('cell', { name: `#${item.id}`, exact: true }),
    ).toBeVisible()
    await expect(
      row.getByRole('cell', {
        name: `${String(item.hoursSlept).replace('.', ',')} h`,
        exact: true,
      }),
    ).toBeVisible()
  }
  await assertAccessible(page)
})

test('se adapta a 320, 375, 768, 1024 y 1440 px sin ocultar datos ni desbordar', async ({
  page,
}, testInfo) => {
  await mockHistory(page)
  await enterSleep(page)
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1080 })
    await assertPoints(page, recent)
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }))
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
    const chart = page.getByTestId('sleep-evolution-chart')
    await expect(chart).toBeVisible()
    expect((await chart.boundingBox())?.width).toBeGreaterThan(100)
    await expect(
      page.getByRole('button', { name: 'Guardar horas de sueño' }),
    ).toBeEnabled()
    if (width === 375 || width === 1440) {
      await assertAccessible(page)
      await page.screenshot({
        path: testInfo.outputPath(
          `sleep-dashboard-controlled-mock-${width}.png`,
        ),
        fullPage: true,
      })
    }
  }
})

test('el historial vacío no inventa puntos y mantiene disponible el formulario', async ({
  page,
}) => {
  const requests = await mockHistory(page, [])
  await enterSleep(page)
  await expect(
    page.getByRole('heading', { name: 'Tu descanso empieza con un registro' }),
  ).toBeVisible()
  await expect(page.getByTestId('sleep-stat-count')).toHaveCount(0)
  await expect(page.locator('circle[data-sleep-record-id]')).toHaveCount(0)
  await expect(page.getByTestId('sleep-evolution-chart')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Guardar horas de sueño' }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Reintentar consulta' }),
  ).toHaveCount(0)
  await assertAccessible(page)
  expect(requests).toEqual({ get: 1, post: 0 })
})

test('distingue una consulta pendiente de un historial vacío confirmado', async ({
  page,
}) => {
  let release!: () => void
  const responseReady = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(endpoint, async (route) => {
    await responseReady
    return route.fulfill({ status: 200, json: [] })
  })
  await enterSleep(page)
  await expect(
    page.getByText('Cargando tus registros…', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Tu descanso empieza con un registro' }),
  ).toHaveCount(0)
  await expect(page.getByTestId('sleep-stat-count')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Guardar horas de sueño' }),
  ).toBeEnabled()
  release()
  await expect(
    page.getByRole('heading', { name: 'Tu descanso empieza con un registro' }),
  ).toBeVisible()
  await expect(
    page.getByText('Cargando tus registros…', { exact: true }),
  ).toHaveCount(0)
})

test('un período sin datos permite ampliar el filtro sin repetir la consulta', async ({
  page,
}) => {
  const old = record(30, '2026-08-01', 6.5)
  const requests = await mockHistory(page, [old])
  await enterSleep(page)
  await expect(
    page.getByRole('heading', { name: 'No hay registros en este período' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Tu descanso empieza con un registro' }),
  ).toHaveCount(0)
  await expect(page.getByTestId('sleep-stat-count')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Ver todo el historial', exact: true })
    .click()
  await assertPoints(page, [old])
  await assertStats(page, {
    average: '6,5',
    total: '6,5',
    count: '1',
    max: '6,5',
    min: '6,5',
  })
  expect(requests).toEqual({ get: 1, post: 0 })
})

test('un error de consulta se reintenta sin perder el borrador ni enviar POST', async ({
  page,
}) => {
  let gets = 0
  let posts = 0
  await page.route(endpoint, (route) => {
    if (route.request().method() !== 'GET') {
      posts += 1
      return route.fulfill({ status: 405, json: {} })
    }
    gets += 1
    return gets === 1
      ? route.abort('connectionrefused')
      : route.fulfill({ status: 200, json: history })
  })
  await enterSleep(page)
  const retry = page.getByRole('button', {
    name: 'Reintentar consulta',
    exact: true,
  })
  await expect(retry).toBeVisible()
  await expect(page.getByText(success)).toHaveCount(0)
  await fillSleep(page)
  await assertAccessible(page)
  await retry.focus()
  await page.keyboard.press('Enter')
  await assertPoints(page, recent)
  await expect(
    page.getByRole('spinbutton', { name: 'Horas dormidas' }),
  ).toHaveValue('7.5')
  await expect(page.getByLabel('Fecha del sueño')).toHaveValue('2026-10-11')
  expect(gets).toBe(2)
  expect(posts).toBe(0)
})

test('rechaza datos de consulta inválidos en vez de presentar un historial vacío', async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: 200,
      json: [{ ...history[0], hoursSlept: '9' }],
    }),
  )
  await enterSleep(page)
  await expect(
    page.getByRole('button', { name: 'Reintentar consulta' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toContainText(
    'datos de sueño inesperados',
  )
  await expect(page.locator('circle[data-sleep-record-id]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Guardar horas de sueño' }),
  ).toBeEnabled()
  await assertAccessible(page)
})

test('un 201 confirmado conserva el éxito aunque falle la actualización del historial', async ({
  page,
}) => {
  let gets = 0
  let posts = 0
  let payload: unknown
  const saved = record(21, '2026-10-11', 7.5)
  await page.route(endpoint, (route) => {
    if (route.request().method() === 'POST') {
      posts += 1
      payload = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: saved })
    }
    gets += 1
    if (gets === 2)
      return route.fulfill({
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR' } },
      })
    return route.fulfill({
      status: 200,
      json: gets === 1 ? history : [saved, ...history],
    })
  })
  await enterSleep(page)
  await assertPoints(page, recent)
  await fillSleep(page)
  await page.getByRole('button', { name: 'Guardar horas de sueño' }).click()
  await expect(page.getByText(success, { exact: true })).toBeVisible()
  await expect(
    page.getByRole('spinbutton', { name: 'Horas dormidas' }),
  ).toHaveValue('')
  const retry = page.getByRole('button', {
    name: 'Reintentar consulta',
    exact: true,
  })
  await expect(retry).toBeVisible()
  expect(payload).toEqual({
    sleepDate: '2026-10-11',
    hoursSlept: 7.5,
    sleepType: 'night',
  })
  expect(gets).toBe(2)
  expect(posts).toBe(1)
  await assertAccessible(page)

  await retry.click()
  await assertStats(page, {
    average: '5,81',
    total: '23,25',
    count: '4',
    max: '8',
    min: '0,25',
  })
  await assertPoints(page, [...recent, saved])
  await expect(page.getByText(success, { exact: true })).toBeVisible()
  expect(gets).toBe(3)
  expect(posts).toBe(1)
})

test('espera la confirmación 201 antes de consultar de nuevo y bloquea envíos simultáneos', async ({
  page,
}) => {
  let release!: () => void
  const responseReady = new Promise<void>((resolve) => {
    release = resolve
  })
  const saved = record(22, '2026-10-11', 7.5)
  let gets = 0
  let posts = 0
  let payload: unknown
  await page.route(endpoint, async (route) => {
    if (route.request().method() === 'GET') {
      gets += 1
      return route.fulfill({ status: 200, json: gets === 1 ? [] : [saved] })
    }
    posts += 1
    payload = route.request().postDataJSON()
    await responseReady
    return route.fulfill({ status: 201, json: saved })
  })
  await enterSleep(page)
  await expect(
    page.getByRole('heading', { name: 'Tu descanso empieza con un registro' }),
  ).toBeVisible()
  await fillSleep(page)
  await page.getByRole('button', { name: 'Guardar horas de sueño' }).click()
  await expect(
    page.getByRole('button', { name: 'Guardando horas de sueño…' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('spinbutton', { name: 'Horas dormidas' }),
  ).toBeDisabled()
  await expect(page.getByText(success)).toHaveCount(0)
  expect(gets).toBe(1)
  expect(posts).toBe(1)
  expect(payload).toEqual({
    sleepDate: '2026-10-11',
    hoursSlept: 7.5,
    sleepType: 'night',
  })
  release()
  await expect(page.getByText(success, { exact: true })).toBeVisible()
  await assertStats(page, {
    average: '7,5',
    total: '7,5',
    count: '1',
    max: '7,5',
    min: '7,5',
  })
  await assertPoints(page, [saved])
  expect(gets).toBe(2)
  expect(posts).toBe(1)
})

test('un 201 incoherente no confirma ni actualiza las estadísticas', async ({
  page,
}) => {
  let gets = 0
  let posts = 0
  await page.route(endpoint, (route) => {
    if (route.request().method() === 'GET') {
      gets += 1
      return route.fulfill({ status: 200, json: history })
    }
    posts += 1
    return route.fulfill({ status: 201, json: record(23, '2026-10-11', 8) })
  })
  await enterSleep(page)
  await assertPoints(page, recent)
  await fillSleep(page)
  await page.getByRole('button', { name: 'Guardar horas de sueño' }).click()
  await expect(page.getByRole('alert')).toContainText('respuesta inesperada')
  await expect(page.getByText(success)).toHaveCount(0)
  await expect(
    page.getByRole('spinbutton', { name: 'Horas dormidas' }),
  ).toHaveValue('7.5')
  await assertStats(page, {
    average: '5,25',
    total: '15,75',
    count: '3',
    max: '8',
    min: '0,25',
  })
  expect(gets).toBe(1)
  expect(posts).toBe(1)
})

test('un fallo al cargar la gráfica conserva las cifras, la tabla y los formularios', async ({
  page,
}) => {
  await mockHistory(page)
  await page.route('**/src/components/SleepEvolutionChart.tsx*', (route) =>
    route.abort('connectionrefused'),
  )
  await enterSleep(page)
  await expect(page.getByRole('alert')).toContainText(
    'No se ha podido cargar la gráfica',
  )
  await assertStats(page, {
    average: '5,25',
    total: '15,75',
    count: '3',
    max: '8',
    min: '0,25',
  })
  await page
    .locator('summary')
    .filter({ hasText: 'Ver todos los registros' })
    .click()
  await expect(
    page
      .getByRole('table', { name: 'Datos de la evolución del sueño' })
      .locator('tbody tr'),
  ).toHaveCount(3)
  await expect(
    page.getByRole('button', { name: 'Guardar horas de sueño' }),
  ).toBeEnabled()
  await page
    .getByRole('button', { name: 'Actividad física', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Registrar actividad física',
  )
  await expect(
    page.getByRole('button', { name: 'Guardar actividad' }),
  ).toBeEnabled()
})
