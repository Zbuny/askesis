import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('мобильное меню открывается и закрывается', async ({ page }) => {
  await page.goto('/')

  const links = page.locator('.navbar__links')
  await expect(links).not.toBeVisible()

  await page.getByRole('button', { name: 'Меню' }).click()
  await expect(links).toBeVisible()
  await expect(page.locator('.navbar__links').getByRole('link', { name: 'Программы', exact: true })).toBeVisible()

  const box = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(box).toBeLessThanOrEqual(390)
})
