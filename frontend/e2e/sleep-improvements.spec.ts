import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { SleepRecord } from '../src/types/sleep'

const endpoint = 'http://localhost:3001/api/sleep'
const createdMessage = 'Horas de sueño registradas correctamente.'
const updatedMessage = 'Descanso actualizado correctamente.'
const today = '2026-10-12'

function record(
  id: number,
  sleepDate: string,
  hoursSlept: number,
  sleepType: 'night' | 'nap' | 'other' | null,
): SleepRecord {
  return {
    id,
    sleepDate,
    hoursSlept,
    sleepType,
    createdAt: '2026-10-12T10:00:00.000Z',
  }
}

const example = [
  record(1, today, 7, 'night'),
  record(2, today, 1.5, 'nap'),
  record(3, today, 1, 'other'),
  record(4, '2026-10-11', 8, 'night'),
]

async function mockApi(page: Page, initial: SleepRecord[] = example) {
  const state = {
    records: initial.map((item) => ({ ...item })),
    gets: 0,
    posts: [] as unknown[],
    patches: [] as { id: number; body: unknown }[],
    patchMode: 'success' as 'success' | 'network' | 'server' | 'unexpected',
    patchPending: undefined as Promise<void> | undefined,
    failNextRead: false,
    failReadAfterPatch: false,
  }
  await page.route(
    /^http:\/\/localhost:3001\/api\/sleep(?:\/\d+)?$/,
    async (route) => {
      const request = route.request()
      if (request.method() === 'GET' && request.url() === endpoint) {
        state.gets += 1
        if (state.failNextRead) {
          state.failNextRead = false
          return route.fulfill({
            status: 500,
            json: { error: { code: 'INTERNAL_ERROR' } },
          })
        }
        return route.fulfill({ status: 200, json: state.records })
      }
      if (request.method() === 'POST') {
        const body = request.postDataJSON()
        state.posts.push(body)
        const saved = record(
          100 + state.posts.length,
          body.sleepDate,
          body.hoursSlept,
          body.sleepType,
        )
        state.records.push(saved)
        return route.fulfill({ status: 201, json: saved })
      }
      if (request.method() === 'PATCH') {
        const id = Number(request.url().split('/').at(-1))
        const body = request.postDataJSON()
        state.patches.push({ id, body })
        await state.patchPending
        if (state.patchMode === 'network')
          return route.abort('connectionrefused')
        if (state.patchMode === 'server')
          return route.fulfill({
            status: 500,
            json: { error: { code: 'INTERNAL_ERROR' } },
          })
        const original = state.records.find((item) => item.id === id)
        if (!original)
          return route.fulfill({
            status: 404,
            json: { error: { code: 'NOT_FOUND' } },
          })
        if (state.patchMode === 'unexpected') {
          return route.fulfill({
            status: 200,
            json: { ...original, ...body, id: id + 1000 },
          })
        }
        const saved = { ...original, ...body }
        state.records = state.records.map((item) =>
          item.id === id ? saved : item,
        )
        state.failNextRead = state.failReadAfterPatch
        return route.fulfill({ status: 200, json: saved })
      }
      return route.fulfill({ status: 405, json: {} })
    },
  )
  return state
}

async function enterSleep(page: Page) {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Horas de sueño', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Registrar horas de sueño',
      exact: true,
    }),
  ).toBeVisible()
}

async function assertStats(page: Page, expected: Record<string, string>) {
  for (const [key, value] of Object.entries(expected)) {
    await expect(page.getByTestId(`sleep-stat-${key}`)).toHaveText(value)
  }
}

async function assertAccessible(page: Page) {
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

async function openEditor(page: Page, id: number) {
  const summary = page
    .locator('summary')
    .filter({ hasText: 'Ver todos los registros' })
  if (
    !(await summary
      .locator('..')
      .evaluate((element) => element.hasAttribute('open')))
  )
    await summary.click()
  const table = page.getByRole('table', {
    name: 'Datos de la evolución del sueño',
  })
  const button = table
    .locator(`tr[data-sleep-row-id="${id}"]`)
    .getByRole('button', { name: /Editar/ })
  await button.click()
  const dialog = page.getByRole('dialog', { name: 'Editar descanso' })
  await expect(dialog).toBeVisible()
  const chevron = await dialog.locator('.select-chevron').boundingBox()
  expect(chevron).not.toBeNull()
  expect(chevron!.width).toBeLessThanOrEqual(20)
  expect(chevron!.height).toBeLessThanOrEqual(20)

  return { dialog, button }
}

async function assertBars(
  page: Page,
  values: { date: string; type: string; hours: number }[],
) {
  const dates = [...new Set(values.map((item) => item.date))].sort()
  const labels: Record<string, string> = {
    night: 'Sueño nocturno',
    nap: 'Siesta',
    other: 'Otro',
    unclassified: 'Sin clasificar',
  }
  const chart = page.getByRole('application', {
    name: 'Horas totales de sueño por día y tipo',
  })
  await expect(chart).toBeVisible()
  await expect(
    page
      .getByTestId('sleep-daily-chart')
      .locator('.recharts-bar-rectangle path'),
  ).toHaveCount(values.length)
  await page.mouse.move(0, 0)
  await chart.focus()
  for (let step = 0; step < dates.length; step += 1)
    await page.keyboard.press('ArrowLeft')
  const tooltip = page.getByTestId('sleep-daily-tooltip')
  for (const [index, date] of dates.entries()) {
    if (index > 0) await page.keyboard.press('ArrowRight')
    const formattedDate = new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`))
    await expect(tooltip.locator('p')).toHaveText(formattedDate)
    const segments = values.filter((item) => item.date === date)
    await expect(tooltip.locator('dl > div')).toHaveCount(segments.length)
    for (const segment of segments) {
      const row = tooltip
        .locator('dl > div')
        .filter({ hasText: labels[segment.type] })
      await expect(row.locator('dd')).toHaveText(
        `${String(segment.hours).replace('.', ',')} h`,
      )
    }
    const total = segments.reduce((sum, item) => sum + item.hours, 0)
    await expect(tooltip.locator('strong')).toHaveText(
      `${String(total).replace('.', ',')} h en total`,
    )
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-12T12:00:00.000Z'))
})

test('obliga a elegir un tipo y registra noche, siesta y otro como entradas independientes', async ({
  page,
}) => {
  const api = await mockApi(page, [])
  await enterSleep(page)
  const form = page.locator('#sleep-form')
  const type = form.getByLabel('Tipo de descanso')
  await form.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('7')
  await form.getByRole('button', { name: 'Guardar horas de sueño' }).click()
  await expect(type).toHaveAttribute('aria-invalid', 'true')
  await expect(type).toBeFocused()
  expect(api.posts).toEqual([])
  expect(
    await type
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      ),
  ).toEqual(['', 'night', 'nap', 'other'])
  for (const [sleepType, hoursSlept] of [
    ['night', 7],
    ['nap', 1.5],
    ['other', 1],
  ] as const) {
    await form.getByLabel('Fecha del sueño').fill(today)
    await form
      .getByRole('spinbutton', { name: 'Horas dormidas' })
      .fill(String(hoursSlept))
    await type.selectOption(sleepType)
    await form.getByRole('button', { name: 'Guardar horas de sueño' }).click()
    await expect(page.getByText(createdMessage, { exact: true })).toBeVisible()
    await expect(page.getByTestId('sleep-stat-count')).toHaveText(
      String(api.posts.length),
    )
  }
  expect(api.posts).toEqual([
    { sleepDate: today, hoursSlept: 7, sleepType: 'night' },
    { sleepDate: today, hoursSlept: 1.5, sleepType: 'nap' },
    { sleepDate: today, hoursSlept: 1, sleepType: 'other' },
  ])
  expect(new Set(api.records.map((item) => item.id)).size).toBe(3)
  await assertStats(page, {
    total: '9,5',
    count: '3',
    'daily-average': '9,5',
    days: '1',
  })
  await expect(page.getByTestId(`sleep-day-total-${today}`)).toHaveText(/9,5/)
})

test('conserva las métricas por registro y añade totales diarios, tipos, barras y media diaria', async ({
  page,
}) => {
  const api = await mockApi(page)
  await enterSleep(page)
  await expect(
    page.getByRole('heading', { name: 'Tu descanso día a día', exact: true }),
  ).toBeVisible()
  await assertStats(page, {
    average: '4,38',
    total: '17,5',
    count: '4',
    max: '8',
    min: '1',
    'daily-average': '8,75',
    days: '2',
  })
  await expect(page.locator('circle[data-sleep-record-id]')).toHaveCount(4)
  await expect(page.getByTestId(`sleep-day-total-${today}`)).toHaveText(/9,5/)
  await expect(page.getByTestId('sleep-day-total-2026-10-11')).toHaveText(/8/)
  const day = page.locator(`details[data-sleep-day="${today}"]`)
  await expect(day.locator('.sleep-day-records > li')).toHaveCount(3)
  for (const label of ['Sueño nocturno', 'Siesta', 'Otro'])
    await expect(day.getByText(label, { exact: true })).toBeVisible()
  await assertBars(page, [
    { date: '2026-10-11', type: 'night', hours: 8 },
    { date: today, type: 'night', hours: 7 },
    { date: today, type: 'nap', hours: 1.5 },
    { date: today, type: 'other', hours: 1 },
  ])
  await expect(page.locator('details[data-sleep-day]')).toHaveCount(2)
  await expect(
    page.locator('details[data-sleep-day="2026-10-11"] > summary'),
  ).toContainText('1 registro')
  await assertAccessible(page)
  expect(api.gets).toBe(1)
})

test('edita la siesta sin crear otro registro y recalcula todas las vistas tras el 200', async ({
  page,
}) => {
  const api = await mockApi(page)
  await enterSleep(page)
  const { dialog } = await openEditor(page, 2)
  await expect(dialog.getByLabel('Fecha del sueño')).toHaveValue(today)
  await expect(
    dialog.getByRole('spinbutton', { name: 'Horas dormidas' }),
  ).toHaveValue('1.5')
  await expect(dialog.getByLabel('Tipo de descanso')).toHaveValue('nap')
  await dialog.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('2')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible()
  expect(api.patches).toEqual([
    { id: 2, body: { sleepDate: today, hoursSlept: 2, sleepType: 'nap' } },
  ])
  expect(api.posts).toHaveLength(0)
  expect(api.records).toHaveLength(4)
  expect(api.records.find((item) => item.id === 2)?.createdAt).toBe(
    example[1].createdAt,
  )
  await assertStats(page, {
    average: '4,5',
    total: '18',
    count: '4',
    'daily-average': '9',
    days: '2',
  })
  await expect(page.getByTestId(`sleep-day-total-${today}`)).toHaveText(/10/)
  await expect(
    page.locator('circle[data-sleep-record-id="2"]'),
  ).toHaveAttribute('data-hours-slept', '2')
  await assertBars(page, [
    { date: '2026-10-11', type: 'night', hours: 8 },
    { date: today, type: 'night', hours: 7 },
    { date: today, type: 'nap', hours: 2 },
    { date: today, type: 'other', hours: 1 },
  ])
})

test('cambiar fecha y tipo mueve el descanso de grupo y respeta los filtros sin borrarlo', async ({
  page,
}) => {
  const api = await mockApi(page)
  await enterSleep(page)
  const { dialog } = await openEditor(page, 2)
  await dialog.getByLabel('Fecha del sueño').fill('2026-10-01')
  await dialog.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('2')
  await dialog.getByLabel('Tipo de descanso').selectOption('other')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible()
  await assertStats(page, {
    total: '16',
    count: '3',
    'daily-average': '8',
    days: '2',
  })
  await expect(
    page
      .locator('.sleep-daily-section')
      .getByRole('button', { name: 'Editar registro #2', exact: true }),
  ).toHaveCount(0)
  await expect(page.locator('circle[data-sleep-record-id="2"]')).toHaveCount(0)
  expect(api.records).toHaveLength(4)
  expect(api.patches).toEqual([
    {
      id: 2,
      body: { sleepDate: '2026-10-01', hoursSlept: 2, sleepType: 'other' },
    },
  ])
  await page
    .getByRole('button', { name: 'Últimos 30 días', exact: true })
    .click()
  await assertStats(page, {
    total: '18',
    count: '4',
    'daily-average': '6',
    days: '3',
  })
  await expect(page.getByTestId('sleep-day-total-2026-10-01')).toHaveText(/2/)
  await expect(
    page.locator('circle[data-sleep-record-id="2"]'),
  ).toHaveAttribute('data-sleep-date', '2026-10-01')
  await page
    .getByRole('button', { name: 'Todo el historial', exact: true })
    .click()
  await assertBars(page, [
    { date: '2026-10-01', type: 'other', hours: 2 },
    { date: '2026-10-11', type: 'night', hours: 8 },
    { date: today, type: 'night', hours: 7 },
    { date: today, type: 'other', hours: 1 },
  ])
  expect(api.gets).toBe(2)
})

test('cancelar por botón o Escape conserva datos y devuelve el foco al control de edición', async ({
  page,
}) => {
  const api = await mockApi(page)
  await enterSleep(page)
  for (const action of ['button', 'escape']) {
    const { dialog, button } = await openEditor(page, 2)
    await dialog.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('3')
    if (action === 'button')
      await dialog
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click()
    else await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(button).toBeFocused()
  }
  expect(api.patches).toHaveLength(0)
  expect(api.gets).toBe(1)
  await assertStats(page, {
    total: '17,5',
    count: '4',
    'daily-average': '8,75',
  })
})

test('un fallo de PATCH conserva el borrador y solo reenvía al guardar de forma explícita', async ({
  page,
}) => {
  const api = await mockApi(page)
  api.patchMode = 'network'
  await enterSleep(page)
  const { dialog } = await openEditor(page, 2)
  await dialog.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('2')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(
    dialog.getByRole('spinbutton', { name: 'Horas dormidas' }),
  ).toHaveValue('2')
  await expect(dialog.getByLabel('Tipo de descanso')).toHaveValue('nap')
  await expect(page.getByText(updatedMessage, { exact: true })).toHaveCount(0)
  await assertAccessible(page)
  expect(api.patches).toHaveLength(1)
  expect(api.gets).toBe(1)
  api.patchMode = 'success'
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible()
  expect(api.patches).toHaveLength(2)
  expect(api.patches[0]).toEqual(api.patches[1])
  expect(api.gets).toBe(2)
})

test('bloquea envíos simultáneos y espera el 200 antes de confirmar la edición', async ({
  page,
}) => {
  const api = await mockApi(page)
  let release!: () => void
  api.patchPending = new Promise<void>((resolve) => {
    release = resolve
  })
  await enterSleep(page)
  const { dialog } = await openEditor(page, 2)
  await dialog.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('2')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(
    dialog.getByRole('spinbutton', { name: 'Horas dormidas' }),
  ).toBeDisabled()
  await expect(dialog.getByLabel('Tipo de descanso')).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeDisabled()
  await expect(page.getByText(updatedMessage, { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(api.patches).toHaveLength(1)
  expect(api.gets).toBe(1)
  release()
  await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible()
  await assertStats(page, { total: '18', count: '4', 'daily-average': '9' })
  expect(api.patches).toHaveLength(1)
  expect(api.gets).toBe(2)
})

test('un 200 con otro identificador no muestra éxito ni refresca el historial', async ({
  page,
}) => {
  const api = await mockApi(page)
  api.patchMode = 'unexpected'
  await enterSleep(page)
  const { dialog } = await openEditor(page, 2)
  await dialog.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('2')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(
    dialog.getByRole('spinbutton', { name: 'Horas dormidas' }),
  ).toHaveValue('2')
  await expect(page.getByText(updatedMessage, { exact: true })).toHaveCount(0)
  expect(api.patches).toHaveLength(1)
  expect(api.gets).toBe(1)
})

test('mantiene el éxito de PATCH si falla la consulta posterior y permite reintentar solo GET', async ({
  page,
}) => {
  const api = await mockApi(page)
  api.failReadAfterPatch = true
  await enterSleep(page)
  const { dialog } = await openEditor(page, 2)
  await dialog.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('2')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible()
  const retry = page.getByRole('button', {
    name: 'Reintentar consulta',
    exact: true,
  })
  await expect(retry).toBeVisible()
  expect(api.patches).toHaveLength(1)
  await retry.click()
  await assertStats(page, { total: '18', count: '4', 'daily-average': '9' })
  await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible()
  expect(api.patches).toHaveLength(1)
  expect(api.gets).toBe(3)
})

test('conserva históricos sin clasificar y permite asignarles un tipo al editar', async ({
  page,
}) => {
  const legacy = record(5, '2026-10-10', 0.5, null)
  const api = await mockApi(page, [...example, legacy])
  await enterSleep(page)
  const legacyDay = page.locator('details[data-sleep-day="2026-10-10"]')
  await legacyDay.locator('summary').click()
  await expect(
    legacyDay.getByText('Sin clasificar', { exact: true }),
  ).toBeVisible()
  const { dialog } = await openEditor(page, 5)
  await expect(dialog.getByLabel('Tipo de descanso')).toHaveValue('')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog.getByLabel('Tipo de descanso')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(api.patches).toHaveLength(0)
  await dialog.getByLabel('Tipo de descanso').selectOption('nap')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible()
  expect(api.records.find((item) => item.id === 5)).toEqual({
    ...legacy,
    sleepType: 'nap',
  })
  await assertStats(page, {
    total: '18',
    count: '5',
    'daily-average': '6',
    days: '3',
  })
})

test('muestra futuros antiguos solo en todo el historial y obliga a corregirlos al editar', async ({
  page,
}) => {
  const legacyFuture = record(6, '2026-10-13', 2, null)
  const api = await mockApi(page, [...example, legacyFuture])
  await enterSleep(page)
  await expect(page.locator('circle[data-sleep-record-id="6"]')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Últimos 30 días', exact: true })
    .click()
  await expect(page.locator('circle[data-sleep-record-id="6"]')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Todo el historial', exact: true })
    .click()
  await expect(page.locator('circle[data-sleep-record-id="6"]')).toHaveCount(1)
  await expect(
    page.locator('details[data-sleep-day="2026-10-13"]'),
  ).toContainText(/futura/i)
  const { dialog } = await openEditor(page, 6)
  await expect(dialog.getByLabel('Fecha del sueño')).toHaveAttribute(
    'max',
    today,
  )
  await dialog.getByLabel('Tipo de descanso').selectOption('other')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog.getByLabel('Fecha del sueño')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(dialog.getByText(/fecha futura/i)).toBeVisible()
  expect(api.patches).toHaveLength(0)
  await dialog.getByLabel('Fecha del sueño').fill(today)
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible()
  await expect(
    page.locator('details[data-sleep-day="2026-10-13"]'),
  ).toHaveCount(0)
  expect(api.records.find((item) => item.id === 6)?.sleepDate).toBe(today)
})

test('el diario y la edición funcionan a cinco anchos, con teclado, axe y movimiento reducido', async ({
  page,
}, testInfo) => {
  await mockApi(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enterSleep(page)
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1080 })
    await expect(page.getByTestId('sleep-daily-chart')).toBeVisible()
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
    const edit = page
      .locator('.sleep-daily-section')
      .getByRole('button', { name: 'Editar registro #2', exact: true })
    await edit.scrollIntoViewIfNeeded()
    await edit.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Editar descanso' })
    await expect(dialog).toBeVisible()
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press('Tab')
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true)
    }
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true)
    if (width === 375 || width === 1440) {
      await assertAccessible(page)
      await page.screenshot({
        path: testInfo.outputPath(`sleep-edit-controlled-mock-${width}.png`),
        fullPage: true,
      })
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(edit).toBeFocused()
    if (width === 375 || width === 1440) {
      await assertAccessible(page)
      await page.screenshot({
        path: testInfo.outputPath(`sleep-daily-controlled-mock-${width}.png`),
        fullPage: true,
      })
    }
  }
})

test.describe('calendario de Madrid incluso con navegador en otra zona', () => {
  test.use({ timezoneId: 'America/Los_Angeles' })
  test('limita el calendario y rechaza mañana en medianoche y cambios de horario', async ({
    page,
  }) => {
    const api = await mockApi(page, [])
    for (const sample of [
      {
        now: '2026-10-11T22:30:00.000Z',
        today: '2026-10-12',
        future: '2026-10-13',
      },
      {
        now: '2026-03-28T23:30:00.000Z',
        today: '2026-03-29',
        future: '2026-03-30',
      },
      {
        now: '2026-03-29T22:30:00.000Z',
        today: '2026-03-30',
        future: '2026-03-31',
      },
      {
        now: '2026-10-25T23:30:00.000Z',
        today: '2026-10-26',
        future: '2026-10-27',
      },
    ]) {
      await page.clock.setFixedTime(new Date(sample.now))
      await enterSleep(page)
      const date = page.getByLabel('Fecha del sueño')
      await expect(date).toHaveAttribute('max', sample.today)
      await expect(date).toHaveValue(sample.today)
      await date.fill(sample.future)
      await page.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('7')
      await page.getByLabel('Tipo de descanso').selectOption('night')
      await page.getByRole('button', { name: 'Guardar horas de sueño' }).click()
      await expect(date).toHaveAttribute('aria-invalid', 'true')
      await expect(date).toBeFocused()
      await expect(
        page.getByText(/No puedes registrar.*fecha futura/),
      ).toBeVisible()
      expect(api.posts).toHaveLength(0)
    }
  })
})
