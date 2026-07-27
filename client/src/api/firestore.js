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
} from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { exerciseName } from '../utils/translate.js'
import { programItems } from '../utils/programItems.js'

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
  const snap = await getDoc(doc(db, name, id))
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

async function requireOwnWorkout(id) {
  const workout = await getOne('workouts', id)
  if (workout.ownerId !== requireUid()) throw new Error('Это не ваша тренировка')
  return workout
}

export const api = {
  // упражнения — читает кто угодно, пишет только админ (проверяется правилами Firestore)
  listExercises: () => listAll('exercises', 'name'),
  getExercise: ({ id }) => getOne('exercises', id),
  createExercise: (data) => {
    if (!data.name) throw new Error('Название обязательно')
    return create('exercises', data)
  },
  updateExercise: ({ id, ...fields }) => update('exercises', id, fields),
  deleteExercise: ({ id }) => remove('exercises', id),

  // программы
  listPrograms: () => listAll('programs', 'title'),
  getProgram: ({ id }) => getOne('programs', id),
  createProgram: (data) => {
    if (!data.title) throw new Error('Название обязательно')
    return create('programs', { ...data, items: data.items || [] })
  },
  updateProgram: ({ id, ...fields }) => update('programs', id, fields),
  deleteProgram: ({ id }) => remove('programs', id),

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
          targetReps: item.targetReps || 10,
        }
      }),
    )
    return create('workouts', { ownerId: requireUid(), title: program.title, items: resolvedItems })
  },

  // тренировки пользователя
  listMyWorkouts: async () => {
    const snap = await getDocs(
      query(col('workouts'), where('ownerId', '==', requireUid()), orderBy('createdAt', 'desc')),
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
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
  listWorkoutHistory: async ({ workoutId } = {}) => {
    const clauses = [where('ownerId', '==', requireUid())]
    if (workoutId) clauses.push(where('workoutId', '==', workoutId))
    const snap = await getDocs(query(col('workoutLogs'), ...clauses, orderBy('date', 'desc')))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
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
}
