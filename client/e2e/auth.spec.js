import { test, expect } from '@playwright/test'
import { uniqueEmail, register, login } from './helpers.js'

test('регистрация нового пользователя и выход/вход', async ({ page }) => {
  const email = uniqueEmail('e2e-auth')
  const password = 'password123'

  await register(page, { name: 'E2E Тест', email, password })
  await expect(page.getByText('Привет, E2E Тест!')).toBeVisible()

  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible()

  await login(page, { email, password })
  await expect(page.getByText('Привет, E2E Тест!')).toBeVisible()
})

test('неавторизованный доступ к /profile редиректит на /login', async ({ page }) => {
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login/)
})
