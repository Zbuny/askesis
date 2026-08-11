import { test, expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, login } from './helpers.js'

// Отдельно от блока ниже: каждый тест Playwright получает чистый контекст,
// поэтому здесь пользователь заведомо не вошёл. Разлогинить внутри общего
// блока не вышло бы — Firebase держит сессию в IndexedDB, и очистка
// localStorage с куками её не трогает.
test('гостя на обзор не пускает', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test.describe('Обзор', () => {
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  })

  test('показывает уровень, неделю и достижения', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /Доброе|Добрый|Доброй/ })).toBeVisible()
    await expect(page.getByText(/Уровень \d+/)).toBeVisible()
    await expect(page.getByText('Тренировка на сегодня')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Эта неделя' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Достижения' })).toBeVisible()
  })

  test('полоса прогресса уровня не выходит за границы', async ({ page }) => {
    await page.goto('/dashboard')
    const bar = page.getByRole('progressbar').first()
    const value = await bar.getAttribute('aria-valuenow')
    expect(Number(value)).toBeGreaterThanOrEqual(0)
    expect(Number(value)).toBeLessThanOrEqual(100)
  })

  test('карточка сегодняшней тренировки ведёт по делу', async ({ page }) => {
    await page.goto('/dashboard')
    // Ссылка ведёт либо в тренировку, либо в конструктор — смотря есть ли что предложить.
    const cta = page.locator('.today-card__cta')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /\/workouts/)
  })

  test('на узком экране нет горизонтальной прокрутки', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    await page.goto('/dashboard')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })
})
