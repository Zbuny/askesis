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

  // Строго внутри истории: тот же «20×12» теперь показывает и разбор
  // тренировки, а на два совпадения getByText падает по strict mode.
  await expect(page.locator('.history-entry').first().getByText(/20×12/)).toBeVisible({ timeout: 10000 })

  // Разбор — главный ответ экрана на вопрос «что дальше»: он должен
  // появиться сам и назвать цель на следующую тренировку.
  const review = page.locator('.review')
  await expect(review).toBeVisible({ timeout: 10000 })
  await expect(review.getByRole('heading')).toHaveText('Личный рекорд: Отжимания')
  // Цель по умолчанию — 3×10, сделан один подход на 12: вес не растёт, пока
  // не сделаны все три подхода, поэтому в следующий раз тот же вес.
  await expect(review.locator('.review__next')).toHaveText('20 кг × 12')

  await page.goto('/profile')
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('240', { timeout: 10000 })
})
