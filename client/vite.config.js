import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    // jsdom нужен ради localStorage в тестах кэша; e2e-спеки гоняет Playwright,
    // и Vitest не должен их подбирать.
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
  build: {
    rollupOptions: {
      output: {
        // Firebase SDK — самая тяжёлая и самая редко меняющаяся часть сборки.
        // Отдельными чанками они переживают деплои приложения в кэше браузера,
        // вместо того чтобы перекачиваться из-за правки одной страницы.
        // Auth и Firestore разведены намеренно: первый нужен сразу везде,
        // второй — только на страницах с данными, и подгружается по требованию.
        manualChunks: {
          'firebase-auth': ['firebase/app', 'firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
