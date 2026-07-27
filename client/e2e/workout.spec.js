import { test, expect } from '@playwright/test'
import { uniqueEmail, register } from './helpers.js'

test('сборка тренировки, лог выполнения и статистика в кабинете', async ({ page }) => {
  const email = uniqueEmail('e2e-workout')
  await register(page, { name: 'E2E Спортсмен', email, password: 'password123' })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('E2E Тестовая тренировка')

  await page.getByPlaceholder('Поиск упражнения...').fill('Push-Up')
  await page.locator('.admin-list li', { hasText: 'Push-Up' }).first().getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByText('Выбрано (1)')).toBeVisible()

  await page.getByRole('button', { name: 'Сохранить тренировку' }).click()
  await page.waitForURL(/\/workouts\/[^/]+$/)

  const weightInput = page.locator('input[placeholder="кг"]').first()
  const repsInput = page.locator('input[placeholder="повт."]').first()
  await weightInput.fill('20')
  await repsInput.fill('12')
  await page.getByRole('button', { name: 'Записать сегодняшнюю тренировку' }).click()

  await expect(page.getByText(/20 кг × 12/)).toBeVisible({ timeout: 10000 })

  await page.goto('/profile')
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('1', { timeout: 10000 })
})
