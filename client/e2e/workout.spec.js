import { test, expect } from '@playwright/test'
import { uniqueEmail, register, addExercises } from './helpers.js'

test('черновик конструктора переживает переход к упражнению', async ({ page }) => {
  const email = uniqueEmail('e2e-draft-builder')
  await register(page, { name: 'E2E Черновик', email, password: 'password123' })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('Черновик A')

  await addExercises(page, ['Отжимания', 'Жим лёжа'])
  await expect(page.locator('.workout-items > li')).toHaveCount(2)

  // Отмеченное, но ещё не добавленное упражнение тоже не теряется: панель
  // ведёт на страницу упражнения, а по возвращении открыта с тем же выбором.
  await page.getByRole('button', { name: 'Добавить упражнения' }).click()
  const sheet = page.locator('.sheet')
  await sheet.getByPlaceholder('Поиск по названию или группе мышц...').fill('Присед')
  await sheet.locator('.picker__item').first().getByRole('button', { name: /^Выбрать/ }).click()
  await sheet.locator('.picker__item').first().getByRole('link').click()
  await page.getByRole('heading', { name: 'Как выполнять' }).scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'К библиотеке' }).click()

  await expect(page.getByPlaceholder('Название тренировки')).toHaveValue('Черновик A')
  await expect(page.locator('.workout-items > li')).toHaveCount(2)
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Добавить (1)' })).toBeVisible()
})

test('черновик лога переживает «Как выполнять»', async ({ page }) => {
  const email = uniqueEmail('e2e-draft-session')
  await register(page, { name: 'E2E Лог', email, password: 'password123' })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('Черновик лога')
  await addExercises(page, ['Отжимания'])
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

  await addExercises(page, ['Отжимания'])
  await expect(page.locator('.workout-items > li')).toHaveCount(1)

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
  await addExercises(page, ['Жим лёжа'])
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

test('конструктор: несколько упражнений разом, порядок за ручку и пустые поля', async ({ page }) => {
  const email = uniqueEmail('e2e-builder-ux')
  await register(page, { name: 'E2E Конструктор', email, password: 'password123' })

  await page.goto('/workouts/new')
  await page.getByPlaceholder('Название тренировки').fill('E2E Порядок')

  // Отмечаем три упражнения — номера на карточках идут в порядке нажатия,
  // в том же порядке они и встают в план.
  await page.getByRole('button', { name: 'Добавить упражнения' }).click()
  const sheet = page.locator('.sheet')
  await expect(sheet).toBeVisible()
  const search = sheet.getByPlaceholder('Поиск по названию или группе мышц...')
  const names = ['Жим лёжа', 'Отжимания', 'Присед']
  for (const [i, name] of names.entries()) {
    await search.fill(name)
    const card = sheet.locator('.picker__item').first()
    await card.getByRole('button', { name: /^Выбрать/ }).click()
    await expect(card.locator('.picker__order')).toHaveText(String(i + 1))
  }
  await sheet.getByRole('button', { name: 'Добавить (3)' }).click()
  await expect(sheet).toBeHidden()

  const rows = page.locator('.workout-items > li')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('Жим лёжа')
  await expect(rows.nth(1)).toContainText('Отжимания')

  // Esc и клик по фону закрывают панель.
  await page.getByRole('button', { name: 'Добавить упражнения' }).click()
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await page.getByRole('button', { name: 'Добавить упражнения' }).click()
  await expect(sheet).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(sheet).toBeHidden()

  // Перетаскивание за ручку: первый пункт — в самый низ.
  // Весь список — в середину экрана: иначе точка жеста уходит за край окна,
  // а у края включается автопрокрутка и сдвигает цель.
  await page.locator('.workout-items').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const handle = rows.nth(0).locator('.drag-handle')
  const box = await handle.boundingBox()
  const lastBox = await rows.nth(2).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // Пункт встаёт после соседа, как только палец проходит его середину.
  await page.mouse.move(box.x + box.width / 2, lastBox.y + lastBox.height / 2 + 12, { steps: 8 })
  await page.mouse.up()
  await expect(rows.nth(2)).toContainText('Жим лёжа')
  await expect(rows.nth(0)).toContainText('Отжимания')

  // С клавиатуры: фокус на ручке, стрелка вверх поднимает пункт.
  await rows.nth(2).locator('.drag-handle').focus()
  await page.keyboard.press('ArrowUp')
  await expect(rows.nth(1)).toContainText('Жим лёжа')
  await expect(rows.nth(1).locator('.drag-handle')).toBeFocused()

  // Ноль стирается целиком, а пустое поле не уходит в базу.
  const sets = page.getByLabel('Подходы: Отжимания')
  await sets.fill('')
  await expect(sets).toHaveValue('')
  await page.getByRole('button', { name: 'Сохранить тренировку' }).click()
  await expect(page.getByText(/Отжимания: подходов должно быть от 1/)).toBeVisible()
  await sets.fill('4')

  // 0 повторов — «до отказа», это допустимо.
  const reps = page.getByLabel('Повторы: Отжимания')
  await reps.fill('')
  await expect(reps).toHaveValue('')
  await reps.fill('0')

  await page.getByRole('button', { name: 'Сохранить тренировку' }).click()
  await page.waitForURL(/\/workouts\/[^/]+$/)
  await expect(page.getByText('Цель: 4 × до отказа')).toBeVisible()
})
