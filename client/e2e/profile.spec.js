import { test, expect } from '@playwright/test'
import { uniqueEmail, register } from './helpers.js'

test('сохранение личных данных (рост/возраст) в профиле', async ({ page }) => {
  const email = uniqueEmail('e2e-profile')
  await register(page, { name: 'E2E Профиль', email, password: 'password123' })

  await expect(page.getByRole('heading', { name: 'Мои данные' })).toBeVisible()

  await page.getByPlaceholder('Рост, см').fill('180')
  await page.getByPlaceholder('Возраст').fill('28')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByText('Сохранено')).toBeVisible({ timeout: 10000 })

  await page.reload()
  await expect(page.getByPlaceholder('Рост, см')).toHaveValue('180', { timeout: 10000 })
  await expect(page.getByPlaceholder('Возраст')).toHaveValue('28')
})

test('запись веса и история веса в профиле', async ({ page }) => {
  const email = uniqueEmail('e2e-profile-weight')
  await register(page, { name: 'E2E Вес', email, password: 'password123' })

  await expect(page.getByRole('heading', { name: 'Мои данные' })).toBeVisible()

  await page.getByPlaceholder('Вес, кг').fill('82')
  await page.getByRole('button', { name: 'Записать' }).click()

  await expect(page.locator('.history-list').getByText('82 кг')).toBeVisible({ timeout: 10000 })

  // После жёсткой перезагрузки Firebase Auth/Firestore переинициализируются
  // с нуля — изредка это дольше 10с, поэтому здесь запас больше, чем для
  // проверки до reload (там всё уже "тёплое").
  await page.reload()
  await expect(page.locator('.history-list').getByText('82 кг')).toBeVisible({ timeout: 20000 })

  // Подтверждение удаления — свой диалог, а не window.confirm: нажимаем
  // кнопку внутри него.
  await page.getByRole('button', { name: 'Удалить' }).first().click()
  await expect(page.getByRole('heading', { name: 'Удалить запись веса?' })).toBeVisible()
  await page.locator('.confirm').getByRole('button', { name: 'Удалить' }).click()
  await expect(page.locator('.history-list')).toHaveCount(0, { timeout: 10000 })
})
