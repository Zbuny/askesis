import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // Сценарии ходят в боевой Firebase, а не в эмулятор: сеть иногда отвечает
  // заметно дольше обычного, и тогда падает случайный тест, а не тот, где
  // есть настоящая ошибка. Один повтор отделяет такие задержки от реальных
  // поломок — воспроизводимый дефект упадёт оба раза.
  retries: 1,
  // Стандартных пяти секунд на ожидание элемента не хватает: страницы
  // поднимают каталог из 873 упражнений и восстанавливают сессию из
  // IndexedDB после прямого перехода.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
