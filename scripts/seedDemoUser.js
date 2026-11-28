// Демо-аккаунт для локального просмотра экранов, которым нужны данные:
// статистика, 3D-модель тела, рекорды, календарь, графики.
//
// Зачем отдельно от seedEmulator.js: тот наполняет эмулятор минимумом для
// Playwright, и разрастись ему нельзя — каждый лишний документ замедляет
// каждый прогон. Здесь наоборот: чем богаче история, тем лучше видно, как
// экраны выглядят у живого человека, а не у пустого аккаунта.
//
// Запуск (эмуляторы должны быть подняты):
//   npm run seed:demo  — из этой папки, см. package.json

const admin = require('firebase-admin')

// Пока заданы эти переменные, Admin SDK говорит с локальным эмулятором.
// Проверка ниже не даёт случайно засеять боевой проект демо-мусором.
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

const DEMO = {
  email: 'demo@askesis.test',
  password: 'password123',
  displayName: 'Демо Пользователь',
}

// Каталог перекрывает разные группы мышц: на статистике из него собирается
// разбивка объёма, и на одной группе она выглядела бы вырожденно.
const EXERCISES = [
  { id: 'bench-press', name: 'Bench Press', nameRu: 'Жим лёжа', muscleGroup: 'chest', equipment: 'barbell', level: 'intermediate' },
  { id: 'incline-press', name: 'Incline Dumbbell Press', nameRu: 'Жим гантелей на наклонной', muscleGroup: 'chest', equipment: 'dumbbell', level: 'intermediate' },
  { id: 'squat', name: 'Squat', nameRu: 'Приседания со штангой', muscleGroup: 'quadriceps', equipment: 'barbell', level: 'intermediate' },
  { id: 'deadlift', name: 'Deadlift', nameRu: 'Становая тяга', muscleGroup: 'lower back', equipment: 'barbell', level: 'advanced' },
  { id: 'pull-up', name: 'Pull Up', nameRu: 'Подтягивания', muscleGroup: 'lats', equipment: 'body only', level: 'intermediate' },
  { id: 'barbell-row', name: 'Barbell Row', nameRu: 'Тяга штанги в наклоне', muscleGroup: 'middle back', equipment: 'barbell', level: 'intermediate' },
  { id: 'overhead-press', name: 'Overhead Press', nameRu: 'Жим стоя', muscleGroup: 'shoulders', equipment: 'barbell', level: 'intermediate' },
  { id: 'curl', name: 'Biceps Curl', nameRu: 'Подъём на бицепс', muscleGroup: 'biceps', equipment: 'dumbbell', level: 'beginner' },
  { id: 'push-up', name: 'Push Up', nameRu: 'Отжимания', muscleGroup: 'chest', equipment: 'body only', level: 'beginner' },
]

const EXERCISE_NAMES = new Map(EXERCISES.map((ex) => [ex.id, ex.nameRu]))

// Три тренировочных дня по кругу — так история выглядит как реальный сплит,
// а не как случайный набор упражнений.
const WORKOUTS = [
  {
    key: 'chest',
    title: 'День груди',
    items: [
      { exerciseId: 'bench-press', baseWeight: 60, reps: 8, sets: 4, step: 2.5 },
      { exerciseId: 'incline-press', baseWeight: 22, reps: 10, sets: 3, step: 1 },
      { exerciseId: 'overhead-press', baseWeight: 35, reps: 8, sets: 3, step: 1.25 },
    ],
  },
  {
    key: 'back',
    title: 'День спины',
    items: [
      { exerciseId: 'deadlift', baseWeight: 90, reps: 5, sets: 3, step: 5 },
      { exerciseId: 'barbell-row', baseWeight: 50, reps: 10, sets: 4, step: 2.5 },
      { exerciseId: 'pull-up', baseWeight: 0, reps: 8, sets: 3, step: 0 },
      { exerciseId: 'curl', baseWeight: 14, reps: 12, sets: 3, step: 1 },
    ],
  },
  {
    key: 'legs',
    title: 'День ног',
    items: [
      { exerciseId: 'squat', baseWeight: 80, reps: 6, sets: 4, step: 5 },
      { exerciseId: 'deadlift', baseWeight: 85, reps: 6, sets: 2, step: 5 },
    ],
  },
]

// Три занятия в неделю за последние 12 недель.
const WEEKS = 12
const SESSIONS_PER_WEEK = 3
const DAY_MS = 24 * 60 * 60 * 1000

function isoDaysAgo(days, hour = 19) {
  const date = new Date(Date.now() - days * DAY_MS)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

// Вес растёт от недели к неделе — иначе графики силы и рекорды были бы
// плоскими, а именно их и нужно смотреть на демо-аккаунте.
function buildSets(item, weekIndex) {
  const weight = item.baseWeight + item.step * weekIndex
  return Array.from({ length: item.sets }, () => ({
    weight: Math.round(weight * 2) / 2,
    reps: item.reps,
  }))
}

async function upsertUser({ email, password, displayName }) {
  const existing = await auth.getUserByEmail(email).catch(() => null)
  if (existing) {
    await auth.updateUser(existing.uid, { password, displayName })
    return existing.uid
  }
  const created = await auth.createUser({ email, password, displayName, emailVerified: true })
  return created.uid
}

// Скрипт запускают повторно после правок в данных, и без уборки история
// удваивалась бы с каждым прогоном.
async function clearOwned(collection, uid) {
  const snap = await db.collection(collection).where('ownerId', '==', uid).get()
  if (snap.empty) return 0
  const batch = db.batch()
  snap.docs.forEach((doc) => batch.delete(doc.ref))
  await batch.commit()
  return snap.size
}

async function main() {
  const uid = await upsertUser(DEMO)
  console.log(`  ${DEMO.email} → ${uid}`)

  const removed = (await clearOwned('workouts', uid)) + (await clearOwned('workoutLogs', uid)) + (await clearOwned('weightLogs', uid))
  if (removed > 0) console.log(`  прошлые демо-данные удалены: ${removed}`)

  const catalog = db.batch()
  EXERCISES.forEach(({ id, ...data }) => catalog.set(db.collection('exercises').doc(id), data))
  await catalog.commit()

  await db.collection('users').doc(uid).set(
    {
      goal: 'Набрать мышечную массу',
      level: 'Средний',
      daysPerWeek: SESSIONS_PER_WEEK,
      equipment: ['barbell', 'dumbbell', 'body only'],
      sex: 'male',
      height: 180,
      age: 27,
      weight: 78,
      onboardedAt: isoDaysAgo(WEEKS * 7),
      dataConsentAt: isoDaysAgo(WEEKS * 7),
    },
    { merge: true },
  )

  // Тренировки заводим один раз, а лог ссылается на них по id: страница
  // тренировки открывается из истории, и с висячей ссылкой она бы падала.
  const workoutIds = new Map()
  for (const workout of WORKOUTS) {
    const ref = await db.collection('workouts').add({
      ownerId: uid,
      title: workout.title,
      items: workout.items.map((item) => ({
        exerciseId: item.exerciseId,
        exerciseName: EXERCISE_NAMES.get(item.exerciseId),
        targetSets: item.sets,
        targetReps: item.reps,
      })),
      createdAt: isoDaysAgo(WEEKS * 7),
    })
    workoutIds.set(workout.key, ref.id)
  }

  let sessions = 0
  const logs = db.batch()
  for (let week = 0; week < WEEKS; week += 1) {
    for (let slot = 0; slot < SESSIONS_PER_WEEK; slot += 1) {
      const workout = WORKOUTS[(week * SESSIONS_PER_WEEK + slot) % WORKOUTS.length]
      // Считаем от свежей недели к старой: индекс недели растёт вместе с
      // весами, поэтому последняя тренировка должна быть самой тяжёлой.
      const weekIndex = WEEKS - 1 - week
      const daysAgo = week * 7 + slot * 2 + 1
      const date = isoDaysAgo(daysAgo)

      logs.set(db.collection('workoutLogs').doc(), {
        ownerId: uid,
        workoutId: workoutIds.get(workout.key),
        workoutTitle: workout.title,
        date,
        startedAt: date,
        durationMinutes: 50 + ((week + slot) % 4) * 5,
        entries: workout.items.map((item) => ({
          exerciseId: item.exerciseId,
          exerciseName: EXERCISE_NAMES.get(item.exerciseId),
          sets: buildSets(item, weekIndex),
        })),
        createdAt: date,
      })
      sessions += 1
    }
  }
  await logs.commit()

  // Вес меняется медленно и с откатами — ровная прямая на графике выглядела
  // бы синтетикой сильнее, чем любые цифры.
  const weights = db.batch()
  for (let week = 0; week < WEEKS; week += 2) {
    weights.set(db.collection('weightLogs').doc(), {
      ownerId: uid,
      weight: Math.round((74 + (WEEKS - week) * 0.35) * 10) / 10,
      date: isoDaysAgo(week * 7 + 1),
      createdAt: isoDaysAgo(week * 7 + 1),
    })
  }
  await weights.commit()

  console.log(`\nГотово: тренировок ${WORKOUTS.length}, записей в журнале ${sessions}, упражнений ${EXERCISES.length}.`)
  console.log(`Вход: ${DEMO.email} / ${DEMO.password} — на http://localhost:5174 (npm --prefix ../client run dev:emulator)`)
  process.exit(0)
}

console.log(`Демо-аккаунт в эмуляторе (${process.env.FIREBASE_AUTH_EMULATOR_HOST}, ${process.env.FIRESTORE_EMULATOR_HOST}):`)

main().catch((err) => {
  console.error('\nНе удалось засеять демо-данные. Эмулятор запущен? (npm run emulators)')
  console.error(err.message)
  process.exit(1)
})
