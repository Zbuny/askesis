import { test, expect } from '@playwright/test'
import { login, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js'

test('админ может создать и удалить упражнение через админку', async ({ page }) => {
  await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  await expect(page.getByRole('link', { name: 'Админка' })).toBeVisible()

  await page.goto('/admin/exercises')
  const uniqueName = `E2E Test Exercise ${Date.now()}`

  await page.getByPlaceholder('Название').fill(uniqueName)
  await page.getByPlaceholder('Группа мышц').fill('test')
  await page.getByRole('button', { name: 'Добавить' }).click()

  const row = page.locator('.admin-list li', { hasText: uniqueName })
  await expect(row).toBeVisible({ timeout: 10000 })

  await row.getByRole('button', { name: 'Удалить' }).click()
  await expect(row).not.toBeVisible({ timeout: 15000 })
})

test('не-админ не видит ссылку на админку', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Админка' })).not.toBeVisible()
})
