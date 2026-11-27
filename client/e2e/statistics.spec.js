import { test, expect } from '@playwright/test'
import { register, uniqueEmail } from './helpers.js'

// После перехода по прямой ссылке браузер сначала восстанавливает сессию из
// IndexedDB и только потом идёт за данными — на холодном старте в CI это
// дольше стандартных пяти секунд.
const SLOW = 20_000

// Новому пользователю статистику показывать не из чего — проверяем, что он
// видит понятное объяснение, а не пустой экран с нулями.
test('без записей статистика объясняет, что делать', async ({ page }) => {
  await register(page, { name: 'Пустая статистика', email: uniqueEmail('stats-empty'), password: 'password123' })
  await page.goto('/statistics')
  await expect(page.getByText(/Отметьте первое выполнение/)).toBeVisible({ timeout: SLOW })
})

test.describe('Статистика с данными', () => {
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await register(page, { name: 'Статистика', email: uniqueEmail('stats'), password: 'password123' })

    // Собираем тренировку и записываем выполнение — иначе показывать нечего.
    await page.goto('/workouts/new')
    await page.getByPlaceholder('Название тренировки').fill('День груди')
    await page.getByRole('button', { name: 'Добавить упражнения' }).click({ timeout: SLOW })
    await page.locator('.sheet .picker__item').first().getByRole('button', { name: /^Выбрать/ }).click({ timeout: SLOW })
    await page.locator('.sheet').getByRole('button', { name: 'Добавить (1)' }).click()
    await page.getByRole('button', { name: 'Сохранить тренировку' }).click()
    await page.waitForURL(/\/workouts\/[^/]+$/)

    await page.locator('.log-set__input').first().fill('60', { timeout: SLOW })
    await page.locator('.log-set__input').nth(1).fill('8')
    await page.getByRole('button', { name: 'Записать сегодняшнюю тренировку' }).click()
    await expect(page.locator('.history-entry').first()).toBeVisible({ timeout: SLOW })
  })

  test('показывает серию, KPI и рекорды', async ({ page }) => {
    await page.goto('/statistics')

    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible({ timeout: SLOW })
    await expect(page.locator('.streak-card')).toContainText('подряд')
    await expect(page.locator('.kpi-grid')).toContainText('кг объёма')
    await expect(page.getByRole('heading', { name: 'Личные рекорды' })).toBeVisible()
    await expect(page.locator('.record-card').first()).toContainText('60 кг')
  })

  test('переключение периода не роняет экран', async ({ page }) => {
    await page.goto('/statistics')
    await page.getByRole('button', { name: 'Год' }).click()
    await expect(page.locator('.kpi-grid')).toBeVisible({ timeout: SLOW })
    await page.getByRole('button', { name: 'Всё время' }).click()
    await expect(page.locator('.kpi-grid')).toBeVisible({ timeout: SLOW })
  })

  test('нажатие на день календаря раскрывает разбор', async ({ page }) => {
    await page.goto('/statistics')
    await page.locator('button.calendar__cell.is-active').first().click()
    await expect(page.locator('.day-card')).toBeVisible()
    await expect(page.locator('.day-card__stats')).toContainText('подход')
  })

  test('на узком экране нет горизонтальной прокрутки', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    await page.goto('/statistics')
    await expect(page.locator('.kpi-grid')).toBeVisible({ timeout: SLOW })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })
})
