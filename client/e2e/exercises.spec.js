import { test, expect } from '@playwright/test'
import { login, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js'

// Каталог теперь читается только вошедшим пользователем: правила Firestore
// закрыты от анонима, чтобы скрипт не вычитывал библиотеку целиком и не жёг
// общую суточную квоту чтений.
test('библиотека упражнений показывает данные и поиск работает', async ({ page }) => {
  await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })

  await page.goto('/exercises')
  await expect(page.getByText('Библиотека пуста')).not.toBeVisible()

  const cardsBefore = page.locator('.exercise-card')
  await expect(cardsBefore.first()).toBeVisible({ timeout: 10000 })
  const countBefore = await cardsBefore.count()
  expect(countBefore).toBeGreaterThan(1)

  await page.getByPlaceholder('Поиск по названию или группе мышц...').fill('Squat')
  const cardsAfter = page.locator('.exercise-card')
  await expect(cardsAfter.first()).toBeVisible()
  const countAfter = await cardsAfter.count()
  expect(countAfter).toBeGreaterThan(0)
  expect(countAfter).toBeLessThan(countBefore)
})

test('гостя каталог отправляет на вход, а после входа возвращает обратно', async ({ page }) => {
  await page.goto('/exercises')
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Пароль').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()

  // Именно туда, куда человек шёл, а не в профиль по умолчанию.
  await expect(page).toHaveURL(/\/exercises/)
  await expect(page.getByRole('heading', { name: 'Библиотека упражнений' })).toBeVisible({ timeout: 10000 })
})
