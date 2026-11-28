import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore'
import { auth } from '../firebase.js'
import { db } from '../db.js'
import { exerciseName } from '../utils/translate.js'
import { programItems } from '../utils/programItems.js'
import { cachedList } from './cache.js'

function requireUid() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Требуется авторизация')
  return uid
}

function col(name) {
  return collection(db, name)
}

async function listAll(name, orderField) {
  const snap = await getDocs(query(col(name), orderBy(orderField)))
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }))
}

async function getOne(name, id) {
  let snap
  try {
    snap = await getDoc(doc(db, name, id))
  } catch (err) {
    // Правила личных коллекций проверяют resource.data.ownerId. На
    // несуществующем документе resource == null, и обращение к его полю
    // Firestore трактует как отказ в доступе — тем же permission-denied, что
    // и при чтении чужого документа. С клиента эти два случая неотличимы,
    // а без перехвата сюда долетает сырое "Missing or insufficient permissions."
    // вместо человеческого сообщения.
    if (err.code === 'permission-denied') throw new Error('Не найдено', { cause: err })
    throw err
  }
  if (!snap.exists()) throw new Error('Не найдено')
  return { ...snap.data(), id: snap.id }
}

async function create(name, data) {
  // id всегда приходит из Firestore (doc ref), а не из формы — иначе
  // случайное поле `id` в data перезаписало бы его при чтении обратно.
  const { id: _ignoredId, ...payload } = data
  const ref = await addDoc(col(name), { ...payload, createdAt: new Date().toISOString() })
  return { id: ref.id }
}

async function update(name, id, fields) {
  await updateDoc(doc(db, name, id), fields)
  return { id }
}

async function remove(name, id) {
  await deleteDoc(doc(db, name, id))
  return { id }
}

async function requireOwnDoc(name, id, notOwnerMessage) {
  const item = await getOne(name, id)
  if (item.ownerId !== requireUid()) throw new Error(notOwnerMessage)
  return item
}

function requireOwnWorkout(id) {
  return requireOwnDoc('workouts', id, 'Это не ваша тренировка')
}

// Списочные экраны рисуют карточку: название, группа мышц, инвентарь,
// картинка. Инструкции (обе версии) — это 1.1 МБ из 1.4 МБ веса всей
// библиотеки, и нужны они только на странице упражнения, которая читает свой
// документ отдельным запросом. В кэш кладём урезанную проекцию, иначе он один
// занял бы четверть квоты localStorage и парсился заметное время при загрузке.
const LIST_FIELDS = ['id', 'name', 'nameRu', 'muscleGroup', 'equipment', 'level', 'category', 'imageUrl', 'imageUrls', 'animationUrl']

function slimExercise(ex) {
  const slim = {}
  for (const field of LIST_FIELDS) {
    if (ex[field] !== undefined) slim[field] = ex[field]
  }
  return slim
}

// Общие каталоги кэшируем: их правит только админ, а читают все и часто.
// Сутки для упражнений — датасет импортируется разово и почти не меняется;
// час для программ — их админ правит вручную и хочет видеть результат сразу.
const exercisesCache = cachedList('exercises', 24 * 60 * 60 * 1000, () =>
  listAll('exercises', 'name').then((list) => list.map(slimExercise)),
)
const programsCache = cachedList('programs', 60 * 60 * 1000, () => listAll('programs', 'title'))

export const api = {
  // упражнения — читает кто угодно, пишет только админ (проверяется правилами Firestore)
  listExercises: () => exercisesCache.read(),
  // Админке нужны полные документы: форма редактирования правит инструкции,
  // а из урезанной проекции она сохранила бы их пустыми. Мимо кэша — админ
  // один, заходит редко, и ему важнее видеть актуальное состояние базы.
  listExercisesFull: () => listAll('exercises', 'name'),
  getExercise: ({ id }) => getOne('exercises', id),
  createExercise: async (data) => {
    if (!data.name) throw new Error('Название обязательно')
    const result = await create('exercises', data)
    exercisesCache.invalidate()
    return result
  },
  updateExercise: async ({ id, ...fields }) => {
    const result = await update('exercises', id, fields)
    exercisesCache.invalidate()
    return result
  },
  deleteExercise: async ({ id }) => {
    const result = await remove('exercises', id)
    exercisesCache.invalidate()
    return result
  },

  // программы
  listPrograms: () => programsCache.read(),
  getProgram: ({ id }) => getOne('programs', id),
  createProgram: async (data) => {
    if (!data.title) throw new Error('Название обязательно')
    const result = await create('programs', { ...data, items: data.items || [] })
    programsCache.invalidate()
    return result
  },
  updateProgram: async ({ id, ...fields }) => {
    const result = await update('programs', id, fields)
    programsCache.invalidate()
    return result
  },
  deleteProgram: async ({ id }) => {
    const result = await remove('programs', id)
    programsCache.invalidate()
    return result
  },

  // создать личную тренировку из программы, с теми же подходами/повторами
  startProgram: async ({ programId }) => {
    const program = await getOne('programs', programId)
    const items = programItems(program)
    if (!items.length) throw new Error('В этой программе нет упражнений')
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        const ex = await getOne('exercises', item.exerciseId).catch(() => null)
        return {
          exerciseId: item.exerciseId,
          exerciseName: ex ? exerciseName(ex) : item.exerciseId,
          targetSets: item.targetSets || 3,
          targetReps: item.targetReps ?? 10,
          ...(item.targetRepsMax ? { targetRepsMax: item.targetRepsMax } : {}),
        }
      }),
    )
    return create('workouts', { ownerId: requireUid(), programId, title: program.title, items: resolvedItems })
  },

  // тренировки пользователя
  listMyWorkouts: async () => {
    const snap = await getDocs(
      query(col('workouts'), where('ownerId', '==', requireUid()), orderBy('createdAt', 'desc')),
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  },
  // Есть ли уже личная тренировка, начатая из этой программы — чтобы не
  // плодить копии по клику мимо и предложить открыть существующую.
  findWorkoutFromProgram: async ({ programId }) => {
    const snap = await getDocs(
      query(col('workouts'), where('ownerId', '==', requireUid()), where('programId', '==', programId), limit(1)),
    )
    return snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null
  },
  getWorkout: ({ id }) => requireOwnWorkout(id),
  createWorkout: ({ title, items }) => {
    if (!title || !items?.length) throw new Error('Укажите название и хотя бы одно упражнение')
    return create('workouts', { ownerId: requireUid(), title, items })
  },
  updateWorkout: async ({ id, ...fields }) => {
    await requireOwnWorkout(id)
    return update('workouts', id, fields)
  },
  deleteWorkout: async ({ id }) => {
    await requireOwnWorkout(id)
    return remove('workouts', id)
  },
  duplicateWorkout: async ({ id }) => {
    const workout = await requireOwnWorkout(id)
    return create('workouts', {
      ownerId: requireUid(),
      title: `${workout.title} (копия)`,
      items: workout.items || [],
    })
  },

  // лог выполнения
  logWorkoutSession: async ({ workoutId, date, entries, startedAt, durationMinutes }) => {
    if (!workoutId || !entries?.length) throw new Error('Укажите тренировку и хотя бы один результат')
    const workout = await requireOwnWorkout(workoutId)
    const finishedAt = date || new Date().toISOString()
    return create('workoutLogs', {
      ownerId: requireUid(),
      workoutId,
      workoutTitle: workout.title,
      date: finishedAt,
      startedAt: startedAt || null,
      durationMinutes: durationMinutes ?? null,
      entries,
    })
  },
  // pageSize/after не заданы — читает всю историю разом. Так и должно
  // оставаться для Profile: там считаются пожизненные итоги (объём,
  // количество тренировок, серия недель), и усечённая выборка тихо
  // испортила бы эти цифры. Экраны с одной лишь лентой записей передают
  // pageSize явно и подгружают «ещё» через after (курсор — значение date
  // последней полученной записи).
  listWorkoutHistory: async ({ workoutId, pageSize, after } = {}) => {
    const clauses = [where('ownerId', '==', requireUid())]
    if (workoutId) clauses.push(where('workoutId', '==', workoutId))
    const parts = [...clauses, orderBy('date', 'desc')]
    if (after) parts.push(startAfter(after))
    if (pageSize) parts.push(limit(pageSize))
    const snap = await getDocs(query(col('workoutLogs'), ...parts))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  },
  deleteWorkoutLog: async ({ id }) => {
    await requireOwnDoc('workoutLogs', id, 'Это не ваша запись')
    return remove('workoutLogs', id)
  },

  // личные данные (вес, рост, возраст)
  getMyProfileData: async () => {
    const snap = await getDoc(doc(db, 'users', requireUid()))
    return snap.exists() ? snap.data() : {}
  },
  updateMyProfileData: async (data) => {
    await setDoc(doc(db, 'users', requireUid()), data, { merge: true })
    return data
  },

  // история веса
  logWeight: async ({ weight, date }) => {
    const value = Number(weight)
    if (!value) throw new Error('Укажите вес')
    const uid = requireUid()
    const loggedAt = date ? new Date(date).toISOString() : new Date().toISOString()
    const result = await create('weightLogs', { ownerId: uid, weight: value, date: loggedAt })
    // Кэшируем последнее по дате значение в users/{uid}.weight — им пользуется
    // ИИ-тренер и подсчёт ИМТ. Бэкфилл старой записи не должен его перезаписать,
    // поэтому сверяемся с фактически самой свежей записью в истории.
    const snap = await getDocs(query(col('weightLogs'), where('ownerId', '==', uid), orderBy('date', 'desc'), limit(1)))
    const latest = snap.docs[0]?.data()
    if (latest?.date === loggedAt && latest?.weight === value) {
      await setDoc(doc(db, 'users', uid), { weight: value }, { merge: true })
    }
    return result
  },
  listWeightHistory: async ({ pageSize, after } = {}) => {
    const parts = [where('ownerId', '==', requireUid()), orderBy('date', 'desc')]
    if (after) parts.push(startAfter(after))
    if (pageSize) parts.push(limit(pageSize))
    const snap = await getDocs(query(col('weightLogs'), ...parts))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  },
  deleteWeightLog: async ({ id }) => {
    await requireOwnDoc('weightLogs', id, 'Это не ваша запись')
    return remove('weightLogs', id)
  },

  // лог питания (КБЖУ по фото)
  logFood: async ({ name, calories, protein, fat, carbs, date }) => {
    if (!name) throw new Error('Укажите название блюда')
    const num = (v) => Math.max(0, Number(v) || 0)
    return create('foodLogs', {
      ownerId: requireUid(),
      name: String(name).slice(0, 120),
      calories: num(calories),
      protein: num(protein),
      fat: num(fat),
      carbs: num(carbs),
      date: date || new Date().toISOString(),
    })
  },
  listFoodHistory: async ({ pageSize, after } = {}) => {
    const parts = [where('ownerId', '==', requireUid()), orderBy('date', 'desc')]
    if (after) parts.push(startAfter(after))
    if (pageSize) parts.push(limit(pageSize))
    const snap = await getDocs(query(col('foodLogs'), ...parts))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  },
  deleteFoodLog: async ({ id }) => {
    await requireOwnDoc('foodLogs', id, 'Это не ваша запись')
    return remove('foodLogs', id)
  },

  // личные цели («жим 100 кг»)
  //
  // Хранится только сама цель и точка отсчёта: факт достижения выводится из
  // журнала (см. utils/goals.js) — отметка «взято», которую ставит клиент,
  // рано или поздно разошлась бы с тем, что человек реально поднял.
  listGoals: async () => {
    const snap = await getDocs(
      query(col('goals'), where('ownerId', '==', requireUid()), orderBy('createdAt', 'desc')),
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  },
  createGoal: async ({ exerciseId, exerciseName, targetWeight, targetReps, startScore }) => {
    if (!exerciseId) throw new Error('Выберите упражнение')
    const weight = Math.max(0, Number(targetWeight) || 0)
    const reps = Math.max(1, Math.round(Number(targetReps) || 1))
    if (weight <= 0 && reps <= 1) throw new Error('Укажите вес или число повторений')
    return create('goals', {
      ownerId: requireUid(),
      exerciseId: String(exerciseId).slice(0, 200),
      exerciseName: String(exerciseName || exerciseId).slice(0, 200),
      targetWeight: weight,
      targetReps: reps,
      startScore: Math.max(0, Number(startScore) || 0),
    })
  },
  deleteGoal: async ({ id }) => {
    await requireOwnDoc('goals', id, 'Это не ваша цель')
    return remove('goals', id)
  },

  // чек-ин восстановления (сон, энергия, забитость)
  listCheckins: async ({ pageSize = 30 } = {}) => {
    const snap = await getDocs(
      query(col('checkins'), where('ownerId', '==', requireUid()), orderBy('date', 'desc'), limit(pageSize)),
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  },
  saveCheckin: async ({ id, sleep, energy, soreness, date }) => {
    const scale = (value) => Math.min(5, Math.max(1, Math.round(Number(value) || 3)))
    const data = {
      ownerId: requireUid(),
      sleep: scale(sleep),
      energy: scale(energy),
      soreness: scale(soreness),
      date: date || new Date().toISOString(),
    }
    // Отметка за день одна: переоценить самочувствие в течение дня нормально,
    // а вот копить по десятку записей на дату — нет, среднее поедет.
    if (id) {
      await requireOwnDoc('checkins', id, 'Это не ваша отметка')
      await update('checkins', id, data)
      return { id }
    }
    return create('checkins', data)
  },
}
