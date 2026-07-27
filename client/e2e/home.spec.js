import { test, expect } from '@playwright/test'

test('главная страница загружается', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Askesis/)
  await expect(page.locator('.hero h1')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Создать план' })).toBeVisible()
})

test('навигация по верхнему меню', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Упражнения' }).click()
  await expect(page).toHaveURL(/\/exercises/)
  await expect(page.getByRole('heading', { name: 'Библиотека упражнений' })).toBeVisible({ timeout: 10000 })
})
