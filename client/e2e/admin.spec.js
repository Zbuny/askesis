import { test, expect } from '@playwright/test'
import { login, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js'

// Тестовый аккаунт намеренно лишён прав администратора (см. коммит
// «revokeAdmin.js — отзыв прав по email; убран тестовый аккаунт из
// админов»), поэтому сценарий больше не на чем прогнать: для него нужен
// живой админ, а держать такого в общедоступном репозитории незачем.
// Проверка админских правил осталась в firestore-tests/rules.test.js.
test.skip('админ может создать и удалить упражнение через админку', async ({ page }) => {
  await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  await expect(page.getByRole('link', { name: 'Админка' })).toBeVisible()

  await page.goto('/admin/exercises')
  const uniqueName = `E2E Test Exercise ${Date.now()}`

  await page.getByPlaceholder('Название').fill(uniqueName)
  await page.getByPlaceholder('Группа мышц').fill('test')
  await page.getByRole('button', { name: 'Добавить' }).click()

  const row = page.locator('.admin-list li', { hasText: uniqueName })
  await expect(row).toBeVisible({ timeout: 10000 })

  // Подтверждение удаления — свой диалог, а не window.confirm: нажимаем
  // кнопку внутри него.
  await row.getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByRole('heading', { name: 'Удалить упражнение?' })).toBeVisible()
  await page.locator('.confirm').getByRole('button', { name: 'Удалить' }).click()
  await expect(row).not.toBeVisible({ timeout: 15000 })
})

test('не-админ не видит ссылку на админку', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Админка' })).not.toBeVisible()
})
