import { test, expect } from '@playwright/test'

test('библиотека упражнений показывает данные и поиск работает', async ({ page }) => {
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
