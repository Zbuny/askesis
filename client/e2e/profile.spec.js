import { test, expect } from '@playwright/test'
import { uniqueEmail, register } from './helpers.js'

test('сохранение личных данных (вес/рост/возраст) в профиле', async ({ page }) => {
  const email = uniqueEmail('e2e-profile')
  await register(page, { name: 'E2E Профиль', email, password: 'password123' })

  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()

  await page.getByPlaceholder('Вес, кг').fill('82')
  await page.getByPlaceholder('Рост, см').fill('180')
  await page.getByPlaceholder('Возраст').fill('28')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByText('Сохранено')).toBeVisible({ timeout: 10000 })

  await page.reload()
  await expect(page.getByPlaceholder('Вес, кг')).toHaveValue('82', { timeout: 10000 })
  await expect(page.getByPlaceholder('Рост, см')).toHaveValue('180')
  await expect(page.getByPlaceholder('Возраст')).toHaveValue('28')
})
