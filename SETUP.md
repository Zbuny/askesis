# SETUP — разворачивание Askesis на реальном Firebase

Проект работает на бесплатном **Spark**-плане: без Cloud Functions (они требуют платный Blaze), только Hosting + Firestore + Authentication.

## 1. Создать проект Firebase

1. Открыть [console.firebase.google.com](https://console.firebase.google.com) → «Добавить проект»
2. Google Analytics — не обязателен, можно отключить

## 2. Включить Authentication

Build → Authentication → Sign-in method:
- включить **Email/Password**
- включить **Google**

## 3. Включить Firestore

Build → Firestore Database → Создать базу → **Production mode**. Правила безопасности (`firestore.rules`) деплоятся отдельно на шаге 6.

## 4. Получить конфиг веб-приложения

Project settings (шестерёнка) → «Общие» → «Ваши приложения» → добавить приложение (`</>`) → зарегистрировать

Скопировать значения `firebaseConfig` в `client/.env` (создать из `client/.env.example`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_USE_FIREBASE_EMULATORS=false
```

## 5. Привязать CLI к проекту

```bash
npm install -g firebase-tools   # или npx firebase-tools
firebase login
firebase use --add              # выбрать проект, alias "default"
```

Обновит `.firebaserc`.

## 6. Деплой

```bash
cd client && npm run build && cd ..
firebase deploy --only hosting,firestore
```

Задеплоит Hosting (собранный клиент) и правила/индексы Firestore. **Не** `firebase deploy` без флагов — попытка задеплоить всё целиком упадёт, если в проекте когда-либо появится папка `functions/` без Blaze-плана.

## 7. Импортировать библиотеку упражнений

Нужен сервисный ключ: Project settings → Service accounts → Generate new private key → сохранить как `scripts/serviceAccountKey.json` (уже в `.gitignore`).

```bash
cd scripts
npm install
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json GCLOUD_PROJECT=<ваш-project-id> npm run import:exercises
```

Импортирует ~870 упражнений из [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) напрямую в Firestore через Admin SDK — это обычный локальный скрипт, не Cloud Function, Blaze для него не нужен.

## 8. Назначить администратора

Права выдаются только вручную — из клиента запись в список админов закрыта правилами (`allow write: if false`), иначе на публичном сайте их мог бы забрать любой зарегистрировавшийся.

1. Зайти на сайт, зарегистрироваться
2. Открыть «Профиль» → блок «Мой ID» → скопировать UID
3. В консоли Firebase → Firestore Database создать документ `settings/admins` с полем `uids` типа **array**, добавить туда скопированный UID (тип элемента — string)
4. Перезагрузить страницу — появится раздел «Админка»

Консоль Firebase и Admin SDK правила не проверяют, поэтому запись оттуда проходит. Чтобы выдать права ещё кому-то, добавьте его UID в тот же массив.

## Java (для локальных эмуляторов, опционально)

Firebase Local Emulator Suite (Firestore/Auth) требует **Java 21+**. Не обязателен — `client/.env` по умолчанию настроен на прямую работу с реальным проектом, эмуляторы нужны только для полностью офлайн-разработки.
