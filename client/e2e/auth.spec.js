import { test, expect } from '@playwright/test'
import { uniqueEmail, register, login } from './helpers.js'

test('регистрация нового пользователя и выход/вход', async ({ page }) => {
  const email = uniqueEmail('e2e-auth')
  const password = 'password123'

  await register(page, { name: 'E2E Тест', email, password })
  await expect(page.getByText('Привет, E2E Тест')).toBeVisible()

  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible()

  await login(page, { email, password })
  await expect(page.getByText('Привет, E2E Тест')).toBeVisible()
})

// Аккаунт здесь намеренно не создаётся: проверяем ровно то, что без галочки
// регистрация не проходит.
test('без согласия на обработку данных аккаунт не создаётся', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Имя').fill('E2E Без согласия')
  await page.getByLabel('Email').fill(uniqueEmail('e2e-consent'))
  await page.getByLabel('Пароль').fill('password123')

  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await expect(page).toHaveURL(/\/register/)
  await expect(page.getByRole('checkbox', { name: /обработку персональных данных/ })).not.toBeChecked()
})

test('неавторизованный доступ к /profile редиректит на /login', async ({ page }) => {
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login/)
})
