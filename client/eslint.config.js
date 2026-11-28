import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'test-results', 'playwright-report'] },

  // Приложение — браузерный код на JSX
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Правила из React Compiler указывают на возможность оптимизации, а не
      // на баг: помеченный ими код работает верно. Держим их предупреждениями,
      // чтобы CI падал только на настоящих ошибках, а не на списке пожеланий.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/use-memo': 'warn',
      // Пустой catch в проекте используется осознанно: ошибка уже показана
      // пользователю через состояние компонента, повторно её глотать нечем.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Переменные с подчёркиванием — намеренно выброшенные при деструктуризации
      // (например, `const { id: _ignoredId, ...payload } = data`).
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },

  // Тесты Playwright и конфиги — Node-окружение, JSX там нет. Браузерные
  // глобальные объекты тоже нужны: внутри page.evaluate() код выполняется
  // на странице и обращается к document.
  {
    files: ['e2e/**/*.js', '*.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: js.configs.recommended.rules,
  },
]
