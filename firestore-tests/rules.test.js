import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'

// Тесты идут против эмулятора Firestore (см. npm script) — боевая база не
// затрагивается. Запускать: npm test в этой папке. Нужна Java 21+.

let testEnv

const ALICE = 'alice-uid'
const BOB = 'bob-uid'

// Валидные образцы записей — ровно той формы, что шлёт client/src/api/firestore.js.
// Каждый тест портит в копии ровно одно поле, чтобы было видно, что именно
// отвергается правилом, а не «что-то в документе не так».
const workout = (ownerId = ALICE) => ({
  ownerId,
  title: 'День груди',
  items: [{ exerciseId: 'ex1', exerciseName: 'Жим лёжа', targetSets: 4, targetReps: 8 }],
  createdAt: '2026-08-10T10:00:00.000Z',
})

const workoutLog = (ownerId = ALICE) => ({
  ownerId,
  workoutId: 'w1',
  workoutTitle: 'День груди',
  date: '2026-08-10T12:00:00.000Z',
  startedAt: '2026-08-10T11:00:00.000Z',
  durationMinutes: 60,
  entries: [{ exerciseId: 'ex1', exerciseName: 'Жим лёжа', sets: [{ weight: 60, reps: 8 }] }],
  createdAt: '2026-08-10T12:00:00.000Z',
})

const goal = (ownerId = ALICE) => ({
  ownerId,
  exerciseId: 'ex1',
  exerciseName: 'Жим лёжа',
  targetWeight: 100,
  targetReps: 1,
  startScore: 80,
  createdAt: '2026-08-10T12:00:00.000Z',
})

const weightLog = (ownerId = ALICE) => ({
  ownerId,
  weight: 80,
  date: '2026-08-10T08:00:00.000Z',
  createdAt: '2026-08-10T08:00:00.000Z',
})

const foodLog = (ownerId = ALICE) => ({
  ownerId,
  name: 'Овсянка',
  calories: 350,
  protein: 12,
  fat: 7,
  carbs: 60,
  date: '2026-08-10T07:00:00.000Z',
  createdAt: '2026-08-10T07:00:00.000Z',
})

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-askesis',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  })
})

afterAll(() => testEnv?.cleanup())

beforeEach(async () => {
  await testEnv.clearFirestore()
  // Затравка в обход правил: чужие документы и каталог, который иначе
  // некому создать — писать в exercises может только админ.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'exercises', 'ex1'), { name: 'Bench Press', muscleGroup: 'chest' })
    await setDoc(doc(db, 'programs', 'p1'), { title: '5×5 Сила', items: [] })
    await setDoc(doc(db, 'settings', 'admins'), { uids: [] })
    await setDoc(doc(db, 'workouts', 'bob-workout'), workout(BOB))
    await setDoc(doc(db, 'workoutLogs', 'bob-log'), workoutLog(BOB))
    await setDoc(doc(db, 'goals', 'bob-goal'), goal(BOB))
    await setDoc(doc(db, 'weightLogs', 'bob-weight'), weightLog(BOB))
    await setDoc(doc(db, 'foodLogs', 'bob-food'), foodLog(BOB))
    await setDoc(doc(db, 'users', BOB), { height: 180, age: 30 })
  })
})

const alice = () => testEnv.authenticatedContext(ALICE).firestore()
const guest = () => testEnv.unauthenticatedContext().firestore()

describe('каталоги закрыты от анонимного чтения', () => {
  it('гость не может вычитать библиотеку упражнений', async () => {
    await assertFails(getDocs(collection(guest(), 'exercises')))
  })

  it('гость не может вычитать программы', async () => {
    await assertFails(getDocs(collection(guest(), 'programs')))
  })

  it('вошедший пользователь каталоги читает', async () => {
    await assertSucceeds(getDocs(collection(alice(), 'exercises')))
    await assertSucceeds(getDocs(collection(alice(), 'programs')))
  })

  it('обычный пользователь не может править каталог — это право админа', async () => {
    await assertFails(setDoc(doc(alice(), 'exercises', 'ex2'), { name: 'Squat' }))
    await assertFails(setDoc(doc(alice(), 'programs', 'p2'), { title: 'Своя программа' }))
  })

  it('список админов из клиента не переписать', async () => {
    await assertFails(setDoc(doc(alice(), 'settings', 'admins'), { uids: [ALICE] }))
  })
})

describe('список UID админов скрыт от не-админов', () => {
  it('обычный пользователь не может прочитать документ settings/admins', async () => {
    await assertFails(getDoc(doc(alice(), 'settings', 'admins')))
  })

  it('пользователь из списка может прочитать документ целиком', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'settings', 'admins'), { uids: [ALICE] })
    })
    await assertSucceeds(getDoc(doc(alice(), 'settings', 'admins')))
  })
})

describe('чужие записи недоступны', () => {
  it('нельзя прочитать чужую тренировку', async () => {
    await assertFails(getDoc(doc(alice(), 'workouts', 'bob-workout')))
  })

  it('нельзя удалить чужую тренировку', async () => {
    await assertFails(deleteDoc(doc(alice(), 'workouts', 'bob-workout')))
  })

  it('нельзя создать запись, помеченную чужим uid', async () => {
    await assertFails(setDoc(doc(alice(), 'workouts', 'new'), workout(BOB)))
  })

  it('нельзя читать чужой профиль', async () => {
    await assertFails(getDoc(doc(alice(), 'users', BOB)))
  })

  it('гость не видит ничего личного', async () => {
    await assertFails(getDoc(doc(guest(), 'workouts', 'bob-workout')))
    await assertFails(getDoc(doc(guest(), 'users', BOB)))
  })
})

describe('ownerId неизменяем', () => {
  // Главная дыра, ради которой всё затевалось: owns() смотрит на документ
  // до записи, поэтому без отдельной проверки владелец мог переписать поле
  // на чужой uid и подкинуть человеку запись в его список.
  it('свою тренировку нельзя переписать на чужого владельца', async () => {
    const db = alice()
    await assertSucceeds(setDoc(doc(db, 'workouts', 'mine'), workout()))
    await assertFails(updateDoc(doc(db, 'workouts', 'mine'), { ownerId: BOB }))
  })

  it('то же для лога тренировок, веса и питания', async () => {
    const db = alice()
    await assertSucceeds(setDoc(doc(db, 'workoutLogs', 'mine'), workoutLog()))
    await assertFails(updateDoc(doc(db, 'workoutLogs', 'mine'), { ownerId: BOB }))

    await assertSucceeds(setDoc(doc(db, 'weightLogs', 'mine'), weightLog()))
    await assertFails(updateDoc(doc(db, 'weightLogs', 'mine'), { ownerId: BOB }))

    await assertSucceeds(setDoc(doc(db, 'foodLogs', 'mine'), foodLog()))
    await assertFails(updateDoc(doc(db, 'foodLogs', 'mine'), { ownerId: BOB }))
  })
})

describe('форма и размер тренировки', () => {
  it('нормальная тренировка сохраняется', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'workouts', 'ok'), workout()))
  })

  it('название обязательно и не может быть пустым', async () => {
    await assertFails(setDoc(doc(alice(), 'workouts', 'bad'), { ...workout(), title: '' }))
  })

  it('название длиной в роман отвергается', async () => {
    await assertFails(setDoc(doc(alice(), 'workouts', 'bad'), { ...workout(), title: 'я'.repeat(500) }))
  })

  it('список упражнений ограничен по длине', async () => {
    const items = Array.from({ length: 200 }, () => ({ exerciseId: 'ex1', targetSets: 3, targetReps: 10 }))
    await assertFails(setDoc(doc(alice(), 'workouts', 'bad'), { ...workout(), items }))
  })

  it('нельзя навесить произвольные лишние поля', async () => {
    const junk = { ...workout() }
    for (let i = 0; i < 20; i += 1) junk[`junk${i}`] = 'x'.repeat(100)
    await assertFails(setDoc(doc(alice(), 'workouts', 'bad'), junk))
  })

  it('items должен быть списком, а не строкой на мегабайт', async () => {
    await assertFails(setDoc(doc(alice(), 'workouts', 'bad'), { ...workout(), items: 'x'.repeat(100000) }))
  })

  it('упражнение без exerciseId отвергается', async () => {
    const items = [{ targetSets: 3, targetReps: 8 }]
    await assertFails(setDoc(doc(alice(), 'workouts', 'bad'), { ...workout(), items }))
  })

  it('гигантская строка внутри поля упражнения отвергается, даже если сам список короткий', async () => {
    const items = [{ exerciseId: 'ex1', exerciseName: 'x'.repeat(100000), targetSets: 3, targetReps: 8 }]
    await assertFails(setDoc(doc(alice(), 'workouts', 'bad'), { ...workout(), items }))
  })

  it('targetSets не может быть строкой', async () => {
    const items = [{ exerciseId: 'ex1', targetSets: '3', targetReps: 8 }]
    await assertFails(setDoc(doc(alice(), 'workouts', 'bad'), { ...workout(), items }))
  })

  it('упражнение без необязательных полей (только exerciseId) допустимо — не ломает старые записи', async () => {
    const items = [{ exerciseId: 'ex1' }]
    await assertSucceeds(setDoc(doc(alice(), 'workouts', 'ok'), { ...workout(), items }))
  })
})

describe('форма лога выполнения', () => {
  it('нормальная запись сохраняется', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'workoutLogs', 'ok'), workoutLog()))
  })

  it('пустой список подходов не пишется', async () => {
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), entries: [] }))
  })

  it('длительность тренировки ограничена сутками', async () => {
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), durationMinutes: 99999 }))
  })

  it('durationMinutes может быть null — таймер могли не включать', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'workoutLogs', 'ok'), { ...workoutLog(), durationMinutes: null, startedAt: null }),
    )
  })

  it('запись без exerciseId отвергается', async () => {
    const entries = [{ sets: [{ weight: 60, reps: 8 }] }]
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), entries }))
  })

  it('запас до отказа сохраняется в пределах шкалы', async () => {
    const withRir = (rir) => [{ exerciseId: 'ex1', exerciseName: 'Жим лёжа', sets: [{ weight: 60, reps: 8 }], rir }]

    await assertSucceeds(setDoc(doc(alice(), 'workoutLogs', 'ok'), { ...workoutLog(), entries: withRir(0) }))
    await assertSucceeds(setDoc(doc(alice(), 'workoutLogs', 'ok3'), { ...workoutLog(), entries: withRir(3) }))
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), entries: withRir(9) }))
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), entries: withRir('много') }))
  })

  it('в запись упражнения нельзя налить произвольных полей', async () => {
    const entries = [
      {
        exerciseId: 'ex1',
        sets: [{ weight: 60, reps: 8 }],
        a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7,
      },
    ]
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), entries }))
  })

  it('запись без sets (старый формат) новым логом больше не пишется', async () => {
    const entries = [{ exerciseId: 'ex1', weight: 60, reps: 8 }]
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), entries }))
  })

  it('вес подхода не может быть строкой', async () => {
    const entries = [{ exerciseId: 'ex1', sets: [{ weight: '60', reps: 8 }] }]
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), entries }))
  })

  it('гигантская строка в поле подхода отвергается', async () => {
    const entries = [{ exerciseId: 'ex1', exerciseName: 'x'.repeat(100000), sets: [{ weight: 60, reps: 8 }] }]
    await assertFails(setDoc(doc(alice(), 'workoutLogs', 'bad'), { ...workoutLog(), entries }))
  })

  it('отметка о взятой рекомендации сохраняется', async () => {
    const entries = [{ exerciseId: 'ex1', exerciseName: 'Жим лёжа', sets: [{ weight: 60, reps: 8 }], followedTarget: true }]
    await assertSucceeds(setDoc(doc(alice(), 'workoutLogs', 'ok'), { ...workoutLog(), entries }))
  })
})

describe('вес и профиль', () => {
  it('нормальный вес пишется', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'weightLogs', 'ok'), weightLog()))
  })

  it('вес вне разумных границ отвергается', async () => {
    await assertFails(setDoc(doc(alice(), 'weightLogs', 'bad'), { ...weightLog(), weight: 100000 }))
    await assertFails(setDoc(doc(alice(), 'weightLogs', 'bad'), { ...weightLog(), weight: 0 }))
  })

  it('вес строкой не принимается', async () => {
    await assertFails(setDoc(doc(alice(), 'weightLogs', 'bad'), { ...weightLog(), weight: '80' }))
  })

  it('свой профиль пишется, рост и возраст проверяются', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users', ALICE), { height: 175, age: 30 }))
    await assertFails(setDoc(doc(alice(), 'users', ALICE), { height: 1.75 }))
    await assertFails(setDoc(doc(alice(), 'users', ALICE), { age: 999 }))
  })

  it('ограничения пишутся, но не длиннее 400 символов', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users', ALICE), { limits: 'болит поясница' }))
    await assertFails(setDoc(doc(alice(), 'users', ALICE), { limits: 'я'.repeat(401) }))
  })

  it('в чужой профиль не записать', async () => {
    await assertFails(setDoc(doc(alice(), 'users', BOB), { height: 175 }))
  })

  it('пустые рост и возраст допустимы — поля можно очистить', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users', ALICE), { height: null, age: null }))
  })
})

describe('лог питания', () => {
  it('нормальная запись сохраняется', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'foodLogs', 'ok'), foodLog()))
  })

  it('отрицательные калории не принимаются', async () => {
    await assertFails(setDoc(doc(alice(), 'foodLogs', 'bad'), { ...foodLog(), calories: -100 }))
  })

  it('название блюда ограничено по длине', async () => {
    await assertFails(setDoc(doc(alice(), 'foodLogs', 'bad'), { ...foodLog(), name: 'е'.repeat(5000) }))
  })
})

describe('чек-ин восстановления', () => {
  const checkin = (ownerId = ALICE) => ({
    ownerId,
    sleep: 4,
    energy: 3,
    soreness: 2,
    date: '2026-08-11T07:00:00.000Z',
  })

  it('нормальная отметка сохраняется', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'checkins', 'ok'), checkin()))
  })

  it('значения вне шкалы 1-5 не принимаются', async () => {
    await assertFails(setDoc(doc(alice(), 'checkins', 'bad'), { ...checkin(), sleep: 0 }))
    await assertFails(setDoc(doc(alice(), 'checkins', 'bad'), { ...checkin(), energy: 9 }))
    await assertFails(setDoc(doc(alice(), 'checkins', 'bad'), { ...checkin(), soreness: 'сильно' }))
  })

  it('отметка без даты не имеет смысла — она про конкретный день', async () => {
    const { date: _drop, ...withoutDate } = checkin()
    await assertFails(setDoc(doc(alice(), 'checkins', 'bad'), withoutDate))
  })
})

describe('личные цели', () => {
  it('нормальная цель сохраняется', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'goals', 'ok'), goal()))
  })

  it('цель на повторения без веса допустима — так ставят подтягивания', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'goals', 'reps'), { ...goal(), targetWeight: 0, targetReps: 15 }),
    )
  })

  it('нереальные значения не принимаются', async () => {
    await assertFails(setDoc(doc(alice(), 'goals', 'bad'), { ...goal(), targetWeight: 9000 }))
    await assertFails(setDoc(doc(alice(), 'goals', 'bad'), { ...goal(), targetReps: 0 }))
    await assertFails(setDoc(doc(alice(), 'goals', 'bad'), { ...goal(), targetReps: 'много' }))
  })

  it('цель без упражнения не имеет смысла', async () => {
    const { exerciseId: _drop, ...withoutExercise } = goal()
    await assertFails(setDoc(doc(alice(), 'goals', 'bad'), withoutExercise))
  })

  it('чужую цель не прочитать и не удалить', async () => {
    await assertFails(getDoc(doc(alice(), 'goals', 'bob-goal')))
    await assertFails(deleteDoc(doc(alice(), 'goals', 'bob-goal')))
  })
})
