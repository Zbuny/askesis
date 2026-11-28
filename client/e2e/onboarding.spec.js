import { test, expect } from '@playwright/test'
import { uniqueEmail, register } from './helpers.js'

// Онбординг — единственный экран, который человек видит сразу после
// регистрации, и он обязан доводить до готовой программы без ИИ: воркер
// может быть не развёрнут, а в E2E его нет намеренно (см. .env.emulator).

test('анкета после регистрации доводит до первой программы', async ({ page }) => {
  await register(
    page,
    { name: 'E2E Новичок', email: uniqueEmail('e2e-onboarding'), password: 'password123' },
    { skipOnboarding: false },
  )

  await expect(page.getByRole('heading', { name: 'Четыре вопроса — и программа готова' })).toBeVisible()

  await page.getByRole('button', { name: 'Набрать мышечную массу' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()

  await page.getByRole('button', { name: 'Начинающий' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()

  await page.getByRole('button', { name: '3', exact: true }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()

  // Ради этой кнопки шаг и переделан: в зале человек иначе отмечает
  // одиннадцать галочек по одной. Набор должен проставить их разом.
  await page.getByRole('button', { name: 'Тренажёрный зал' }).click()
  // Сколько именно галочек — зависит от того, что есть в каталоге;
  // важно, что набор проставил их разом, а не по одной.
  await expect(page.locator('.equipment__preset.is-selected')).toHaveCount(1)
  expect(await page.locator('.choice.is-selected').count()).toBeGreaterThanOrEqual(3)

  await page.getByRole('button', { name: 'Собрать программу' }).click()

  await expect(page.getByRole('heading', { name: 'Ваша первая программа' })).toBeVisible({ timeout: 15000 })
  // Новичку положен щадящий диапазон — он же проверяет, что верхняя граница
  // не потерялась по дороге к экрану.
  await expect(page.locator('.plan-card').first()).toContainText('8-15')

  await page.getByRole('button', { name: 'Сохранить все дни' }).click()
  await expect(page.getByText('Все дни сохранены в «Мои тренировки»')).toBeVisible({ timeout: 15000 })
})

test('анкету можно пропустить', async ({ page }) => {
  await register(
    page,
    { name: 'E2E Пропуск', email: uniqueEmail('e2e-skip'), password: 'password123' },
    { skipOnboarding: false },
  )

  await page.getByRole('button', { name: 'Пропустить — разберусь сам' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
})
