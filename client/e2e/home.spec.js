import { test, expect } from '@playwright/test'
import { login, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js'

test('главная страница загружается', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Askesis/)
  await expect(page.locator('.hero h1')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Начать' })).toBeVisible()
})

test('навигация по верхнему меню', async ({ page }) => {
  // Каталог закрыт за вход (см. exercises.spec.js), поэтому проверяем именно
  // навигацию, а не гейтинг — иначе клик уводил бы на /login.
  await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })

  await page.goto('/')
  await page.locator('.navbar__links').getByRole('link', { name: 'Упражнения' }).click()
  await expect(page).toHaveURL(/\/exercises/)
  // Каталог — 873 документа, и на холодном кэше страница поднимается около
  // пяти секунд. При прогоне всей пачки подряд бывает и дольше, поэтому
  // запас здесь больше, чем кажется нужным на глаз.
  await expect(page.getByRole('heading', { name: 'Библиотека упражнений' })).toBeVisible({ timeout: 30000 })
})
