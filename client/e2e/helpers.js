export function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`
}

export const ADMIN_EMAIL = 'test-askesis2@example.com'
export const ADMIN_PASSWORD = 'password123'

export async function register(page, { name, email, password }) {
  await page.goto('/register')
  await page.getByPlaceholder('Имя').fill(name)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.waitForURL('**/profile')
}

export async function login(page, { email, password }) {
  await page.goto('/login')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await page.waitForURL('**/profile')
}
