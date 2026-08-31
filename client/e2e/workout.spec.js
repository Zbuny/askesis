import { test, expect } from '@playwright/test'
import { uniqueEmail, register } from './helpers.js'

test('черновик конструктора переживает переход к упражнению', async ({ page }) => {
  const email = uniqueEmail('e2e-draft-builder')
  await register(page, { name: 'E2E Черновик', email, password: 'password123' })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('Черновик A')

  await page.getByPlaceholder('Поиск по названию или группе мышц...').fill('Отжимания')
  await page.locator('.picker__item').first().getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByText('Выбрано (1)')).toBeVisible()

  await page.getByPlaceholder('Поиск по названию или группе мышц...').fill('Жим лёжа')
  await page.locator('.picker__item').first().getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByText('Выбрано (2)')).toBeVisible()

  await page.locator('.picker__item').first().getByRole('link').click()
  await page.getByRole('heading', { name: 'Как выполнять' }).scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'К библиотеке' }).click()

  await expect(page.getByPlaceholder('Название тренировки')).toHaveValue('Черновик A')
  await expect(page.getByText('Выбрано (2)')).toBeVisible()
})

test('черновик лога переживает «Как выполнять»', async ({ page }) => {
  const email = uniqueEmail('e2e-draft-session')
  await register(page, { name: 'E2E Лог', email, password: 'password123' })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('Черновик лога')
  await page.getByPlaceholder('Поиск по названию или группе мышц...').fill('Отжимания')
  await page.locator('.picker__item').first().getByRole('button', { name: 'Добавить' }).click()
  await page.getByRole('button', { name: 'Сохранить тренировку' }).click()
  await page.waitForURL(/\/workouts\/[^/]+$/)

  const firstSet = page.locator('.log-set').first()
  await firstSet.locator('input').nth(0).fill('25')
  await firstSet.locator('input').nth(1).fill('8')

  await page.getByRole('link', { name: 'Как выполнять →' }).click()
  await page.getByRole('button', { name: 'К библиотеке' }).click()

  await expect(firstSet.locator('input').nth(0)).toHaveValue('25')
  await expect(firstSet.locator('input').nth(1)).toHaveValue('8')
})

test('сборка тренировки, лог выполнения и статистика в кабинете', async ({ page }) => {
  const email = uniqueEmail('e2e-workout')
  await register(page, { name: 'E2E Спортсмен', email, password: 'password123' })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('E2E Тестовая тренировка')

  await page.getByPlaceholder('Поиск по названию или группе мышц...').fill('Отжимания')
  await page.locator('.picker__item').first().getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByText('Выбрано (1)')).toBeVisible()

  await page.getByRole('button', { name: 'Сохранить тренировку' }).click()
  await page.waitForURL(/\/workouts\/[^/]+$/)

  const firstSet = page.locator('.log-set').first()
  await firstSet.locator('input').nth(0).fill('20')
  await firstSet.locator('input').nth(1).fill('12')
  await page.getByRole('button', { name: 'Записать сегодняшнюю тренировку' }).click()

  // Строго внутри истории: тот же «20×12» теперь показывает и разбор
  // тренировки, а на два совпадения getByText падает по strict mode.
  await expect(page.locator('.history-entry').first().getByText(/20×12/)).toBeVisible({ timeout: 10000 })

  // Разбор — главный ответ экрана на вопрос «что дальше»: он должен
  // появиться сам и назвать цель на следующую тренировку.
  const review = page.locator('.review')
  await expect(review).toBeVisible({ timeout: 10000 })
  await expect(review.getByRole('heading')).toHaveText('Личный рекорд: Отжимания')
  // Цель по умолчанию — 3×10, сделан один подход на 12: вес не растёт, пока
  // не сделаны все три подхода, поэтому в следующий раз тот же вес.
  await expect(review.locator('.review__next')).toHaveText('20 кг × 12')

  // Итоги живут на «Статистике», а не в профиле: профиль — это данные о
  // себе. 20 кг × 12 повторений = 240 кг объёма.
  await page.goto('/statistics')
  await expect(page.locator('.kpi-grid').getByText('240')).toBeVisible({ timeout: 10000 })
})

test('замена упражнения знает про ограничения из профиля', async ({ page }) => {
  const email = uniqueEmail('e2e-swap-limits')
  await register(page, { name: 'E2E Ограничения', email, password: 'password123' })

  // Ограничения задаются один раз в профиле — и работают везде, в том числе
  // в подборе замены, который считается на клиенте без всякого ИИ.
  const gear = page.locator('.profile-content')
  await gear.getByPlaceholder('Например: болит поясница, не делаю становую').fill('не делаю отжимания')
  await gear.getByRole('button', { name: 'Сохранить' }).click()
  await expect(gear.getByText('Сохранено')).toBeVisible({ timeout: 10000 })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('E2E Замена с ограничением')
  await page.getByPlaceholder('Поиск по названию или группе мышц...').fill('Жим лёжа')
  await page.locator('.picker__item').first().getByRole('button', { name: 'Добавить' }).click()
  await page.getByRole('button', { name: 'Сохранить тренировку' }).click()
  await page.waitForURL(/\/workouts\/[^/]+$/)

  await page.getByRole('button', { name: 'Заменить' }).click()

  const panel = page.locator('.swap__panel')
  // Свою формулировку человек видит целиком: подбор её до конца не понимает,
  // и последнее слово остаётся за ним.
  await expect(panel.locator('.swap__limits')).toHaveText('Ваши ограничения: не делаю отжимания')
  // Отжимания — единственная замена жиму в засеянном каталоге, поэтому она
  // остаётся в списке, но с пометкой, а не молча исчезает.
  await expect(panel.getByRole('button', { name: /Отжимания/ })).toContainText(
    'Похоже на ваши ограничения — осторожно',
  )
})
