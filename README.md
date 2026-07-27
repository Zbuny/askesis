# Askesis

Сайт для тренировок и занятий спортом — личный проект для себя и друзей.

## Стек

- **client/** — React + Vite, Firebase Auth (email/пароль + Google) + прямой доступ к Firestore через Firebase SDK
- **Firestore** — база данных (упражнения, программы, тренировки, лог выполнения); вся бизнес-логика прав — в `firestore.rules`
- **worker/** — Cloudflare Worker: прокси к Groq для ИИ-тренера. Держит API-ключ у себя и проверяет Firebase ID-токен, потому что во фронтенде ключ спрятать негде (см. [worker/README.md](worker/README.md))
- **scripts/** — разовый Node-скрипт импорта библиотеки упражнений (Admin SDK, не деплоится)

Работает целиком на бесплатном **Spark**-плане Firebase — Cloud Functions не используются (они требуют платный Blaze-план, даже в рамках бесплатной квоты — см. [PLAN.md](PLAN.md)).

Подробный план и обоснование решений — в [PLAN.md](PLAN.md). Инструкция по разворачиванию реального Firebase-проекта — в [SETUP.md](SETUP.md).

## Разделы

- Главная
- Каталог программ тренировок (курирует админ) — `/programs`; на странице программы есть кнопка «Начать программу», которая создаёт личную тренировку с теми же подходами и повторами
- Библиотека упражнений с фильтрами по группе мышц, инвентарю, уровню и категории — `/exercises`
- Сборка своей тренировки из библиотеки — `/workouts`, `/workouts/new`, редактирование — `/workouts/:id/edit`
- ИИ-тренер: пять вопросов → персональная программа — `/workouts/ai` (нужен развёрнутый воркер)
- Лог выполнения, таймер времени в зале и история по тренировке — `/workouts/:id`
- Личный кабинет: статистика посещений, время в зале, календарь тренировок и графики прогресса — `/profile`
- Admin-экран (только для админа) — `/admin`
- Регистрация / вход (email+пароль, Google) — `/register`, `/login`

## Локальная разработка

```bash
cd client && npm install
npm run dev
```

`client/.env` содержит конфиг реального Firebase-проекта — локальный dev-сервер обращается напрямую к нему (Auth + Firestore), эмуляторы не обязательны.

Для полностью локальной разработки без реального проекта нужны Firebase-эмуляторы, а для них — **Java 21+**:

```bash
firebase emulators:start --project demo-askesis
```

и `VITE_USE_FIREBASE_EMULATORS=true` в `client/.env`.

## E2E-тесты

```bash
cd client
npx playwright install chromium   # один раз
npm run test:e2e
```

Тесты гоняют golden path (регистрация, каталог упражнений, сборка тренировки + лог, admin CRUD, мобильное меню) против реального Firebase-проекта из `client/.env` — создают тестовых пользователей и тестовые записи, это ожидаемо для личного проекта.

## Импорт библиотеки упражнений

Разовый скрипт заливает [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (800+ упражнений, public domain) в Firestore:

```bash
cd scripts
npm install
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json GCLOUD_PROJECT=<project-id> npm run import:exercises
```

См. [SETUP.md](SETUP.md) — где взять `serviceAccountKey.json`.

## Деплой

```bash
cd client && npm run build && cd ..
firebase deploy --only hosting,firestore
```

ИИ-тренер деплоится отдельно, в Cloudflare:

```bash
cd worker && npm install && npx wrangler secret put GROQ_API_KEY && npm run deploy
```

Адрес воркера из вывода команды пропишите в `client/.env` как `VITE_AI_WORKER_URL`. Пока переменная не задана, страница `/workouts/ai` честно сообщает, что помощник не настроен, — остальное приложение работает как обычно.

Пошагово — создание Firebase-проекта, включение провайдеров Auth, назначение первого админа — в [SETUP.md](SETUP.md).
