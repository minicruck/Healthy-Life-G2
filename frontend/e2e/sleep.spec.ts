import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const endpoint = 'http://localhost:3001/api/sleep'
const success = 'Horas de sueño registradas correctamente.'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-12T12:00:00.000Z'))
  await page.route(endpoint, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, json: [] })
      : route.fallback(),
  )
})

test('el selector funciona por teclado y conserva el borrador de HU1', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Registrar actividad física',
  )
  await page
    .getByLabel('Observaciones', { exact: false })
    .fill('Paseo pendiente')
  await page
    .getByRole('button', { name: 'Actividad física', exact: true })
    .focus()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Horas de sueño', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Registrar horas de sueño',
  )
  await expect(
    page.getByRole('button', { name: 'Horas de sueño', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('button', { name: 'Actividad física', exact: true })
    .click()
  await expect(page.getByLabel('Observaciones', { exact: false })).toHaveValue(
    'Paseo pendiente',
  )
  await expect(
    page.getByRole('button', { name: 'Guardar actividad' }),
  ).toBeVisible()
})

test('registra horas decimales y mantiene accesibilidad y diseño responsive', async ({
  page,
}, testInfo) => {
  let payload: unknown
  await page.route(endpoint, (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    payload = route.request().postDataJSON()
    return route.fulfill({
      status: 201,
      json: {
        id: 1,
        sleepDate: '2026-10-11',
        hoursSlept: 7.5,
        sleepType: 'night',
        createdAt: '2026-10-11T15:00:00.000Z',
      },
    })
  })
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Horas de sueño', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Registrar horas de sueño',
  )
  const initialAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(initialAxe.violations).toEqual([])
  await page.getByLabel('Fecha del sueño').fill('2026-10-11')
  await page.getByRole('spinbutton', { name: 'Horas dormidas' }).fill('7.5')
  await page.getByLabel('Tipo de descanso').selectOption('night')
  await page.screenshot({
    path: testInfo.outputPath('sleep-form-controlled-mock.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Guardar horas de sueño' }).click()
  await expect(page.getByText(success)).toBeVisible()
  expect(payload).toEqual({
    sleepDate: '2026-10-11',
    hoursSlept: 7.5,
    sleepType: 'night',
  })
  await expect(page.locator('.feedback-success')).toHaveCSS('opacity', '1')
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(result.violations).toEqual([])
  await page.screenshot({
    path: testInfo.outputPath('sleep-success-controlled-mock.png'),
    fullPage: true,
  })
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await expect(
      page.getByRole('button', { name: 'Guardar horas de sueño' }),
    ).toBeVisible()
  }
})

test('muestra errores de validación y de red sin perder las horas', async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.request().method() === 'POST'
      ? route.abort('connectionrefused')
      : route.fallback(),
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Horas de sueño', exact: true })
    .click()
  const hours = page.getByRole('spinbutton', { name: 'Horas dormidas' })
  await page.getByLabel('Tipo de descanso').selectOption('night')
  await hours.fill('0')
  await page.getByRole('button', { name: 'Guardar horas de sueño' }).click()
  await expect(hours).toHaveAttribute('aria-invalid', 'true')
  await expect(hours).toBeFocused()
  const validationAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(validationAxe.violations).toEqual([])
  await hours.fill('7.5')
  await page.getByRole('button', { name: 'Guardar horas de sueño' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText(success)).toHaveCount(0)
  await expect(hours).toHaveValue('7.5')
})
