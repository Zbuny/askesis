import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // Эмулятор отвечает предсказуемо, поэтому повтор нужен не для сети, а для
  // холодного старта в CI: там первый прогон поднимает JVM эмулятора и
  // браузер. Воспроизводимый дефект упадёт оба раза.
  retries: 1,
  // Запас против стандартных пяти секунд: после прямого перехода по ссылке
  // страница ещё восстанавливает сессию из IndexedDB, а на слабой машине CI
  // это заметно дольше, чем локально.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    // Отдельный порт от обычного npm run dev (5173) — намеренно. Иначе
    // reuseExistingServer подхватил бы уже запущенный дев-сервер, который
    // смотрит в боевой Firebase, и сценарии молча ушли бы в прод.
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Сценарии ходят только в эмуляторы: прогон против боевого проекта
    // регистрировал новые аккаунты и вычитывал каталог из 873 документов,
    // а суточная квота чтений на бесплатном плане общая — несколько
    // прогонов подряд оставляли без базы всех, включая владельца.
    command: 'npm run dev:emulator',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
