import { test, expect } from '@playwright/test'
import { login, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js'

test('админ может создать и удалить упражнение через админку', async ({ page }) => {
  await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  await expect(page.getByRole('link', { name: 'Админка' })).toBeVisible()

  await page.goto('/admin/exercises')
  const uniqueName = `E2E Test Exercise ${Date.now()}`

  await page.getByPlaceholder('Название').fill(uniqueName)
  await page.getByPlaceholder('Группа мышц').fill('test')
  await page.getByRole('button', { name: 'Добавить' }).click()

  const row = page.locator('.admin-list li', { hasText: uniqueName })
  await expect(row).toBeVisible({ timeout: 10000 })

  // Подтверждение удаления — свой диалог, а не window.confirm: нажимаем
  // кнопку внутри него.
  await row.getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByRole('heading', { name: 'Удалить упражнение?' })).toBeVisible()
  await page.locator('.confirm').getByRole('button', { name: 'Удалить' }).click()
  await expect(row).not.toBeVisible({ timeout: 15000 })
})

test('не-админ не видит ссылку на админку', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Админка' })).not.toBeVisible()
})

test('админ: подходы и повторы в программе можно стереть и задать «до отказа»', async ({ page }) => {
  await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  await page.goto('/admin/programs')

  const title = `E2E Программа ${Date.now()}`
  const form = page.locator('form.admin-form')
  await form.getByPlaceholder('Название').fill(title)
  await page.getByPlaceholder('Поиск по названию или группе мышц...').fill('Отжимания')
  await page.locator('.picker__item').first().getByRole('button', { name: 'Добавить' }).click()

  // Раньше Number('') возвращал ноль обратно в поле, и стереть его было нельзя.
  const sets = form.getByLabel('Подходы: Отжимания')
  await sets.fill('')
  await expect(sets).toHaveValue('')
  await form.getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByText(/Отжимания: подходов должно быть от 1/)).toBeVisible()

  await sets.fill('5')
  const reps = form.getByLabel('Повторы: Отжимания')
  await reps.fill('')
  await expect(reps).toHaveValue('')
  await reps.fill('0')
  await form.getByRole('button', { name: 'Добавить' }).click()

  const row = page.locator('.admin-list li', { hasText: title })
  await expect(row).toBeVisible({ timeout: 10000 })

  // Сохранилось числами: в форме редактирования те же 5 × 0.
  await row.getByRole('button', { name: 'Изменить' }).click()
  await expect(form.getByLabel('Подходы: Отжимания')).toHaveValue('5')
  await expect(form.getByLabel('Повторы: Отжимания')).toHaveValue('0')
  await form.getByRole('button', { name: 'Отмена' }).click()

  await row.getByRole('button', { name: 'Удалить' }).click()
  await page.locator('.confirm').getByRole('button', { name: 'Удалить' }).click()
  await expect(row).not.toBeVisible({ timeout: 15000 })
})
