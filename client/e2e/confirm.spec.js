import { test, expect } from '@playwright/test'
import { register, uniqueEmail } from './helpers.js'

// Диалог подтверждения проверяем на записи веса: её можно создать и удалить
// в одном сценарии, ничего чужого не задев.
test.describe('Подтверждение удаления', () => {
  test.beforeEach(async ({ page }) => {
    await register(page, {
      name: 'Проверка диалога',
      email: uniqueEmail('confirm'),
      password: 'password123',
    })
  })

  // Ищем строго в списке истории: то же «84 кг» встречается ещё и в скрытом
  // <title> графика, и туда локатор попадал бы вместо видимой записи.
  const weightRow = (page, value) => page.locator('.history-list').getByText(`${value} кг`)

  async function addWeight(page, value) {
    await page.getByPlaceholder('Вес, кг').fill(value)
    await page.getByRole('button', { name: 'Записать' }).click()
    await expect(weightRow(page, value)).toBeVisible()
  }

  test('отмена оставляет запись на месте', async ({ page }) => {
    await addWeight(page, '81')

    await page.getByRole('button', { name: 'Удалить' }).first().click()
    await expect(page.getByRole('heading', { name: 'Удалить запись веса?' })).toBeVisible()

    await page.getByRole('button', { name: 'Отмена' }).click()
    await expect(page.getByRole('heading', { name: 'Удалить запись веса?' })).not.toBeVisible()
    await expect(weightRow(page, '81')).toBeVisible()
  })

  test('подтверждение удаляет запись', async ({ page }) => {
    await addWeight(page, '82')

    await page.getByRole('button', { name: 'Удалить' }).first().click()
    await page.getByRole('button', { name: 'Удалить', exact: true }).last().click()

    await expect(weightRow(page, '82')).toHaveCount(0)
  })

  test('Esc закрывает диалог и ничего не удаляет', async ({ page }) => {
    await addWeight(page, '83')

    await page.getByRole('button', { name: 'Удалить' }).first().click()
    await expect(page.getByRole('heading', { name: 'Удалить запись веса?' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Удалить запись веса?' })).not.toBeVisible()
    await expect(weightRow(page, '83')).toBeVisible()
  })

  // Фокус стоит на отмене намеренно: диалог показывают перед необратимым
  // действием, и случайный Enter не должен ничего удалять.
  test('Enter сразу после открытия не удаляет запись', async ({ page }) => {
    await addWeight(page, '84')

    await page.getByRole('button', { name: 'Удалить' }).first().click()
    await page.keyboard.press('Enter')

    await expect(weightRow(page, '84')).toBeVisible()
  })
})
