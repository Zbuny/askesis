import { test, expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, login } from './helpers.js'

const SLOW = 25_000
const PHONES = [320, 375, 390, 414]
const ROUTES = ['/dashboard', '/workouts', '/statistics', '/profile', '/exercises', '/nutrition']

test.describe('Мобильный интерфейс', () => {
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  })

  test('нижняя панель видна и ведёт по разделам', async ({ page }) => {
    await page.goto('/dashboard')
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    await expect(nav).toBeVisible({ timeout: SLOW })

    await nav.getByRole('link', { name: 'Статистика' }).click()
    await expect(page).toHaveURL(/\/statistics/)
  })

  test('центральная кнопка открывает быстрые действия и закрывается по Esc', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Быстрые действия' }).click()

    const menu = page.getByRole('menu', { name: 'Быстрые действия' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Сканировать еду' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
  })

  test('быстрое действие ведёт на нужный экран', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Быстрые действия' }).click()
    await page.getByRole('menuitem', { name: 'Сканировать еду' }).click()
    await expect(page).toHaveURL(/\/nutrition/)
  })

  test('кнопки панели крупные — по ним можно попасть пальцем', async ({ page }) => {
    await page.goto('/dashboard')
    const items = page.locator('.bottom-nav__item')
    const count = await items.count()
    for (let i = 0; i < count; i += 1) {
      const box = await items.nth(i).boundingBox()
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('на десктопе нижней панели нет — там есть шапка', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard')
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeHidden()
  })

  for (const width of PHONES) {
    test(`нет горизонтальной прокрутки на ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      for (const route of ROUTES) {
        await page.goto(route)
        await page.waitForTimeout(1500)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        )
        expect(overflow, `${route} на ${width}px`).toBe(false)
      }
    })
  }
})
