import { expect, test, type Page } from '@playwright/test'
import type { Activity } from '../src/types/activity'

const endpoint = 'http://localhost:3001/api/activities'
const original = {
  id: 17,
  activityType: 'walking',
  activityDate: '2026-10-05',
  notes: 'Paseo por el parque',
  intensity: 'high',
  createdAt: '2026-10-05T18:00:00.000Z',
} satisfies Activity
const other = {
  id: 18,
  activityType: 'cycling',
  activityDate: original.activityDate,
  notes: 'Vuelta en bicicleta',
  intensity: null,
  createdAt: '2026-10-05T19:00:00.000Z',
} satisfies Activity

async function openHistory(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ver historial' }).click()
  await expect(page.getByText(original.notes, { exact: true })).toBeVisible()
}

function item(page: Page, notes: string) {
  return page.getByRole('listitem').filter({ hasText: notes })
}

function confirmation(page: Page) {
  return page.getByRole('dialog').or(page.getByRole('alertdialog'))
}

test('edita el registro elegido y consulta el progreso actualizado en HU8', async ({
  page,
}) => {
  let target: Activity = { ...original }
  await page.route(endpoint, (route) =>
    route.fulfill({ json: [target, other] }),
  )
  await page.route(endpoint + '/' + original.id, async (route) => {
    expect(route.request().method()).toBe('PATCH')
    const changes = {
      activityType: 'running' as const,
      activityDate: '2026-10-06',
      notes: 'Carrera corregida',
      intensity: 'low' as const,
    }
    expect(route.request().postDataJSON()).toEqual(changes)
    target = { ...target, ...changes }
    await route.fulfill({ status: 200, json: target })
  })
  await page.route('**/api/training-goal', (route) => {
    const completedDays = new Set([target.activityDate, other.activityDate])
      .size
    return route.fulfill({
      json: {
        daysPerWeek: 3,
        completedDays,
        remainingDays: 3 - completedDays,
        weekStart: '2026-10-05',
        weekEnd: '2026-10-11',
        updatedAt: original.createdAt,
      },
    })
  })
  await openHistory(page)
  await item(page, original.notes)
    .getByRole('button', { name: /editar/i })
    .click()
  const dialog = page.getByRole('dialog')
  const kind = dialog.getByLabel('Tipo de actividad')
  const date = dialog.getByLabel(/fecha/i)
  const notes = dialog.getByRole('textbox')
  await expect(kind).toHaveValue(original.activityType)
  await expect(date).toHaveValue(original.activityDate)
  await expect(notes).toHaveValue(original.notes)
  await expect(dialog.getByLabel('Intensidad del entrenamiento')).toHaveValue('high')
  await kind.selectOption('running')
  await dialog.getByLabel('Intensidad del entrenamiento').selectOption('low')
  await date.fill('2026-10-06')
  await notes.fill('Carrera corregida')
  await dialog.getByRole('button', { name: /guardar/i }).click()
  await expect(dialog).not.toBeVisible()
  await expect(item(page, 'Carrera corregida')).toContainText('Correr')
  await expect(item(page, 'Carrera corregida')).toContainText('Intensidad baja')
  await expect(item(page, other.notes)).toContainText('Intensidad sin registrar')
  await expect(item(page, other.notes)).toContainText('Bicicleta')
  await page.getByRole('button', { name: 'Objetivo de entrenamiento' }).click()
  await expect(page.getByText('2 de 3 días', { exact: true })).toBeVisible()
})

test('Escape descarta la edición y cancelar la eliminación conserva ambas actividades', async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.fulfill({ json: [original, other] }),
  )
  const requests: string[] = []
  await page.route(endpoint + '/*', (route) => {
    requests.push(route.request().method())
    return route.fulfill({ status: 500 })
  })
  await openHistory(page)
  const originalRow = item(page, original.notes)
  await originalRow.getByRole('button', { name: /editar/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('Borrador')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await originalRow.getByRole('button', { name: /eliminar/i }).click()
  await confirmation(page)
    .getByRole('button', { name: /cancelar/i })
    .click()
  await expect(confirmation(page)).not.toBeVisible()
  await expect(originalRow).toBeVisible()
  await expect(item(page, other.notes)).toBeVisible()
  expect(requests).toEqual([])
})

test('elimina únicamente la actividad confirmada', async ({ page }) => {
  let records = [original, other]
  await page.route(endpoint, (route) => route.fulfill({ json: records }))
  const methods: string[] = []
  await page.route(endpoint + '/' + original.id, (route) => {
    methods.push(route.request().method())
    records = [other]
    return route.fulfill({ status: 204 })
  })
  await openHistory(page)
  const originalRow = item(page, original.notes)
  await originalRow.getByRole('button', { name: /eliminar/i }).click()
  const dialog = confirmation(page)
  await expect(dialog).toBeVisible()
  expect(methods).toEqual([])
  await dialog.getByRole('button', { name: /eliminar|confirmar/i }).click()
  await expect(dialog).not.toBeVisible()
  await expect(originalRow).toHaveCount(0)
  await expect(item(page, other.notes)).toBeVisible()
  expect(methods).toEqual(['DELETE'])
})

test('un fallo de conexión conserva el borrador para reintentar la edición', async ({
  page,
}) => {
  let target: Activity = original
  let attempts = 0
  await page.route(endpoint, (route) => route.fulfill({ json: [target] }))
  await page.route(endpoint + '/' + original.id, (route) => {
    expect(route.request().method()).toBe('PATCH')
    attempts++
    if (attempts === 1) return route.abort('connectionrefused')
    target = { ...original, notes: 'Paseo corregido' }
    return route.fulfill({ json: target })
  })
  await openHistory(page)
  await item(page, original.notes)
    .getByRole('button', { name: /editar/i })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('Paseo corregido')
  await dialog.getByRole('button', { name: /guardar/i }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox')).toHaveValue('Paseo corregido')
  expect(target).toEqual(original)
  await dialog.getByRole('button', { name: /guardar/i }).click()
  await expect(dialog).not.toBeVisible()
  await expect(item(page, 'Paseo corregido')).toBeVisible()
  expect(attempts).toBe(2)
})

test('la edición inválida no se envía y guardar dos veces no duplica la petición', async ({
  page,
}) => {
  let target: Activity = { ...original }
  let writes = 0
  await page.route(endpoint, (route) => route.fulfill({ json: [target] }))
  await page.route(endpoint + '/' + original.id, async (route) => {
    writes++
    await new Promise((resolve) => setTimeout(resolve, 300))
    target = { ...original, notes: 'Cambio único' }
    await route.fulfill({ json: target })
  })
  await openHistory(page)
  await item(page, original.notes)
    .getByRole('button', { name: /editar/i })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/fecha/i).fill('')
  await dialog.getByRole('button', { name: /guardar/i }).click()
  await expect(
    dialog.getByText('Indica la fecha de la actividad.'),
  ).toBeVisible()
  expect(writes).toBe(0)
  await dialog.getByLabel(/fecha/i).fill(original.activityDate)
  await dialog.getByRole('textbox').fill('Cambio único')
  await dialog.getByRole('button', { name: /guardar/i }).click()
  await expect(
    dialog.getByRole('button', { name: 'Procesando…' }),
  ).toBeDisabled()
  await expect(dialog).not.toBeVisible()
  await expect(item(page, 'Cambio único')).toBeVisible()
  expect(writes).toBe(1)
})
