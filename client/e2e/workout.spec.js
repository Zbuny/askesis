import { test, expect } from '@playwright/test'
import { uniqueEmail, register } from './helpers.js'

test('сборка тренировки, лог выполнения и статистика в кабинете', async ({ page }) => {
  const email = uniqueEmail('e2e-workout')
  await register(page, { name: 'E2E Спортсмен', email, password: 'password123' })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('E2E Тестовая тренировка')

  await page.getByPlaceholder('Поиск по названию или группе мышц...').fill('Отжимания')
  await page.locator('.picker__item').first().getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByText('Выбрано (1)')).toBeVisible()

  await page.getByRole('button', { name: 'Сохранить тренировку' }).click()
  await page.waitForURL(/\/workouts\/[^/]+$/)

  const firstSet = page.locator('.log-set').first()
  await firstSet.locator('input').nth(0).fill('20')
  await firstSet.locator('input').nth(1).fill('12')
  await page.getByRole('button', { name: 'Записать сегодняшнюю тренировку' }).click()

  await expect(page.getByText(/20×12/)).toBeVisible({ timeout: 10000 })

  await page.goto('/profile')
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('240', { timeout: 10000 })
})
