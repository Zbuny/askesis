export function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`
}

export const ADMIN_EMAIL = 'test-askesis2@example.com'
export const ADMIN_PASSWORD = 'password123'

// Тесты идут против боевого Firebase, а не эмулятора: вход и регистрация
// упираются в сеть, и при прогоне всей пачки подряд ответ изредка приходит
// дольше стандартных 30 секунд. Держим отдельный запас здесь, чтобы
// случайная задержка сети не выглядела как падение сценария.
const AUTH_TIMEOUT = 60_000

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
