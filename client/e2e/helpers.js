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

export async function register(page, { name, email, password }) {
  await page.goto('/register')
  await page.getByLabel('Имя').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('checkbox', { name: /обработку персональных данных/ }).check()
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.waitForURL('**/profile', { timeout: AUTH_TIMEOUT })
}

export async function login(page, { email, password }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await page.waitForURL('**/profile', { timeout: AUTH_TIMEOUT })
}
