// Наполнение эмулятора данными для E2E: тестовые аккаунты, права админа и
// небольшой каталог упражнений.
//
// Зачем это вообще: раньше сценарии Playwright ходили в боевой Firebase.
// Каждый прогон регистрировал новые аккаунты и вычитывал каталог из 873
// документов — на бесплатном плане суточная квота чтений так выжигается за
// несколько прогонов, и приложение перестаёт работать для всех, включая
// владельца. Плюс админскому сценарию нужен аккаунт с правами, а его логин
// и пароль пришлось бы держать в общедоступном репозитории.
//
// В эмуляторе обе проблемы исчезают: данные живут только на этой машине,
// пароли ничего не открывают, а квоты нет вовсе.
//
// Запуск (эмуляторы должны быть подняты):
//   npm run seed  — из этой папки, см. package.json

const admin = require('firebase-admin')

// Ключ сервисного аккаунта здесь не нужен и не должен использоваться: пока
// заданы эти переменные, Admin SDK говорит с локальным эмулятором, а не с
// боевым проектом. Проверка ниже не даёт случайно засеять прод.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099'

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'GOOGLE_APPLICATION_CREDENTIALS задан — с ним запись может уйти в боевой проект.\n' +
      'Сидирование рассчитано только на эмулятор: снимите переменную и повторите.',
  )
  process.exit(1)
}

const PROJECT_ID = 'askesis-web'

admin.initializeApp({ projectId: PROJECT_ID })

const auth = admin.auth()
const db = admin.firestore()

// Те же значения, что читает client/e2e/helpers.js.
const USERS = [
  { email: 'admin@askesis.test', password: 'password123', displayName: 'Тест Админ', admin: true },
  { email: 'user@askesis.test', password: 'password123', displayName: 'Тест Пользователь', admin: false },
]

// Каталог намеренно крошечный: сценариям хватает нескольких упражнений,
// а полные 873 документа замедляли бы каждый прогон без всякой пользы.
const EXERCISES = [
  { id: 'bench-press', name: 'Bench Press', nameRu: 'Жим лёжа', muscleGroup: 'chest', equipment: 'barbell', level: 'intermediate' },
  { id: 'squat', name: 'Squat', nameRu: 'Приседания со штангой', muscleGroup: 'quadriceps', equipment: 'barbell', level: 'intermediate' },
  { id: 'deadlift', name: 'Deadlift', nameRu: 'Становая тяга', muscleGroup: 'lower back', equipment: 'barbell', level: 'advanced' },
  { id: 'pull-up', name: 'Pull Up', nameRu: 'Подтягивания', muscleGroup: 'lats', equipment: 'body only', level: 'intermediate' },
  { id: 'curl', name: 'Biceps Curl', nameRu: 'Подъём на бицепс', muscleGroup: 'biceps', equipment: 'dumbbell', level: 'beginner' },
  // Отжимания ищет по названию workout.spec.js — упражнение без инвентаря
  // удобно тем, что сценарий не зависит от наличия штанги в зале.
  { id: 'push-up', name: 'Push Up', nameRu: 'Отжимания', muscleGroup: 'chest', equipment: 'body only', level: 'beginner' },
]

async function upsertUser({ email, password, displayName }) {
  const existing = await auth.getUserByEmail(email).catch(() => null)
  if (existing) {
    await auth.updateUser(existing.uid, { password, displayName })
    return existing.uid
  }
  const created = await auth.createUser({ email, password, displayName, emailVerified: true })
  return created.uid
}

async function main() {
  const adminUids = []

  for (const user of USERS) {
    const uid = await upsertUser(user)
    if (user.admin) adminUids.push(uid)
    console.log(`  ${user.email} → ${uid}${user.admin ? ' (админ)' : ''}`)
  }

  await db.collection('settings').doc('admins').set({ uids: adminUids })

  const batch = db.batch()
  EXERCISES.forEach((exercise) => {
    const { id, ...data } = exercise
    batch.set(db.collection('exercises').doc(id), data)
  })
  await batch.commit()

  console.log(`\nГотово: пользователей ${USERS.length}, упражнений ${EXERCISES.length}.`)
  process.exit(0)
}

console.log(`Сидирование эмулятора (${process.env.FIREBASE_AUTH_EMULATOR_HOST}, ${process.env.FIRESTORE_EMULATOR_HOST}):`)

main().catch((err) => {
  console.error('\nНе удалось засеять эмулятор. Он запущен? (npm run emulators)')
  console.error(err.message)
  process.exit(1)
})
