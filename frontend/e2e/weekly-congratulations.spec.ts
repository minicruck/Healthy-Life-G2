import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('abre el icono de felicitación semanal y permite cerrarlo', async ({ page }) => {
  await page.route('**/api/training-goal', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        daysPerWeek: null,
        completedDays: 0,
        remainingDays: null,
        weekStart: '2026-11-23',
        weekEnd: '2026-11-29',
        updatedAt: null,
      }),
    }),
  )
  await page.route('**/api/sleep-goal', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        minHours: null,
        updatedAt: null,
        fromDate: '2026-11-18',
        toDate: '2026-11-24',
        days: [],
        latest: null,
        checked: null,
        alert: false,
      }),
    }),
  )
  await page.route('**/api/sleep', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/hydration-goal', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ litersPerDay: null, updatedAt: null }),
    }),
  )
  await page.route('**/api/water/today', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ date: '2026-11-24', totalMl: 0 }),
    }),
  )
  await page.route('**/api/water', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  await page.goto('/')
  await page.getByRole('button', { name: 'Abrir felicitación semanal' }).click()

  await expect(page.getByRole('dialog', { name: '¡Buen trabajo, demo-user!' })).toBeVisible()
  await expect(page.getByText('Tu siguiente logro te espera')).toBeVisible()

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])

  await page.getByRole('button', { name: 'Cerrar felicitación' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
})
