export function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`
}

// Аккаунты живут в эмуляторе и создаются заново при каждом прогоне
// (scripts/seedEmulator.js). Пароль в открытом виде здесь ничего не
// открывает: за пределами этой машины таких пользователей не существует.
export const ADMIN_EMAIL = 'admin@askesis.test'
export const ADMIN_PASSWORD = 'password123'

export const USER_EMAIL = 'user@askesis.test'
export const USER_PASSWORD = 'password123'

// Вход идёт в эмулятор Auth и обычно занимает доли секунды, но на холодном
// старте в CI первый запрос ждёт, пока эмулятор прогреется. Запас взят с
// расчётом на это, а не на сеть.
const AUTH_TIMEOUT = 30_000

// Новый аккаунт после регистрации попадает не в профиль, а в онбординг —
// анкету из четырёх вопросов (см. pages/Onboarding.jsx). Для сценариев,
// которые проверяют не её, это лишний шаг: пропускаем его так же, как это
// сделал бы человек, — кнопкой «Пропустить».
export async function register(page, { name, email, password }, { skipOnboarding = true } = {}) {
  await page.goto('/register')
  await page.getByLabel('Имя').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('checkbox', { name: /обработку персональных данных/ }).check()
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.waitForURL('**/onboarding', { timeout: AUTH_TIMEOUT })

  if (!skipOnboarding) return
  await page.getByRole('button', { name: 'Пропустить — разберусь сам' }).click()
  await page.waitForURL('**/dashboard', { timeout: AUTH_TIMEOUT })

  // Контракт хелпера прежний: после него вы вошли и стоите в профиле. Иначе
  // онбординг пришлось бы учитывать в каждом сценарии, который к нему не
  // имеет отношения.
  await page.goto('/profile')
}

export async function login(page, { email, password }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  // После входа приложение ведёт на обзор (или туда, откуда человек пришёл),
  // а не в профиль, как раньше.
  await page.waitForURL(/\/(dashboard|profile)/, { timeout: AUTH_TIMEOUT })
}

// Упражнения в конструктор добавляются через нижнюю панель библиотеки:
// отмечаем каждое по названию (первое совпадение в поиске) и жмём
// «Добавить (N)» один раз.
export async function addExercises(page, names) {
  await page.getByRole('button', { name: 'Добавить упражнения' }).click()
  const sheet = page.locator('.sheet')
  const search = sheet.getByPlaceholder('Поиск по названию или группе мышц...')
  for (const name of names) {
    await search.fill(name)
    await sheet.locator('.picker__item').first().getByRole('button', { name: /^Выбрать/ }).click()
  }
  await sheet.getByRole('button', { name: `Добавить (${names.length})` }).click()
  await sheet.waitFor({ state: 'hidden' })
}
