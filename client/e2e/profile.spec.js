import { test, expect } from '@playwright/test'
import { uniqueEmail, register } from './helpers.js'

test('сохранение личных данных (рост/возраст) в профиле', async ({ page }) => {
  const email = uniqueEmail('e2e-profile')
  await register(page, { name: 'E2E Профиль', email, password: 'password123' })

  await expect(page.getByRole('heading', { name: 'Мои данные' })).toBeVisible()

  await page.getByLabel('Рост, см').fill('180')
  await page.getByLabel('Возраст, лет').fill('28')
  // Форм с кнопкой «Сохранить» на странице две (данные о себе и инвентарь с
  // ограничениями) — обе пишут один профиль, но нажимаем и проверяем свою.
  const myData = page.locator('.profile-sidebar')
  await myData.getByRole('button', { name: 'Сохранить' }).click()

  await expect(myData.getByText('Сохранено')).toBeVisible({ timeout: 10000 })

  await page.reload()
  await expect(page.getByLabel('Рост, см')).toHaveValue('180', { timeout: 10000 })
  await expect(page.getByLabel('Возраст, лет')).toHaveValue('28')
})

test('запись веса и история веса в профиле', async ({ page }) => {
  const email = uniqueEmail('e2e-profile-weight')
  await register(page, { name: 'E2E Вес', email, password: 'password123' })

  await expect(page.getByRole('heading', { name: 'Мои данные' })).toBeVisible()

  await page.getByLabel('Вес, кг').fill('82')
  await page.getByRole('button', { name: 'Записать' }).click()

  await expect(page.locator('.history-list').getByText('82 кг')).toBeVisible({ timeout: 10000 })

  // После жёсткой перезагрузки Firebase Auth/Firestore переинициализируются
  // с нуля — изредка это дольше 10с, поэтому здесь запас больше, чем для
  // проверки до reload (там всё уже "тёплое").
  await page.reload()
  await expect(page.locator('.history-list').getByText('82 кг')).toBeVisible({ timeout: 20000 })

  // Подтверждение удаления — свой диалог, а не window.confirm: нажимаем
  // кнопку внутри него.
  await page.getByRole('button', { name: 'Удалить' }).first().click()
  await expect(page.getByRole('heading', { name: 'Удалить запись веса?' })).toBeVisible()
  await page.locator('.confirm').getByRole('button', { name: 'Удалить' }).click()
  await expect(page.locator('.history-list')).toHaveCount(0, { timeout: 10000 })
})

test('инвентарь и ограничения правятся в профиле, а не только в анкете', async ({ page }) => {
  const email = uniqueEmail('e2e-profile-gear')
  await register(page, { name: 'E2E Инвентарь', email, password: 'password123' })

  const gear = page.locator('.profile-content')
  await expect(page.getByRole('heading', { name: 'Инвентарь и ограничения' })).toBeVisible()
  await expect(gear.getByText('Не указан — замены подбираются без оглядки на снаряды')).toBeVisible()

  // Библиотека читается только по этой кнопке: до неё списка снарядов на
  // странице нет вовсе (см. handleOpenEquipment в Profile.jsx).
  await gear.getByRole('button', { name: 'Изменить' }).click()
  await gear.getByRole('button', { name: 'Гантели', exact: true }).click({ timeout: 20000 })

  const limits = gear.getByPlaceholder('Например: болит поясница, не делаю становую')
  await limits.fill('болит поясница, не делаю становую')
  await gear.getByRole('button', { name: 'Сохранить' }).click()
  await expect(gear.getByText('Сохранено')).toBeVisible({ timeout: 10000 })

  await page.reload()
  await expect(gear.getByText('Гантели')).toBeVisible({ timeout: 20000 })
  await expect(limits).toHaveValue('болит поясница, не делаю становую')
})
