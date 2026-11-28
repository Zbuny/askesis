// Первая программа по ответам онбординга — без ИИ.
//
// Мастер на /workouts/ai собирает программу моделью, и она делает это лучше.
// Но онбординг — единственный экран, который человек видит сразу после
// регистрации, и он не имеет права зависеть ни от развёрнутого воркера, ни
// от квоты Groq: новичок, которому на первом же шаге сказали «помощник не
// настроен», в приложение не вернётся. Поэтому здесь лежит простой, но
// честный сплит из библиотеки, а ИИ остаётся улучшением, а не условием.
//
// Все числа — из repRanges.js: тот же диапазон повторений и тот же потолок
// подходов на группу, что и во всём остальном приложении.

import { MAX_SETS_PER_MUSCLE_PER_SESSION, recommendedReps } from './repRanges.js'
import { exerciseName } from './translate.js'

// Раскладки по дням. Больше шести дней не предлагаем: восстановление
// становится узким местом раньше, чем объём.
const SPLITS = {
  2: [
    { title: 'День 1 — Верх тела', muscles: ['chest', 'lats', 'shoulders', 'triceps', 'biceps'] },
    { title: 'День 2 — Низ тела', muscles: ['quadriceps', 'hamstrings', 'glutes', 'abdominals'] },
  ],
  3: [
    { title: 'День 1 — Жимовые', muscles: ['chest', 'shoulders', 'triceps'] },
    { title: 'День 2 — Тяговые', muscles: ['lats', 'middle back', 'biceps'] },
    { title: 'День 3 — Ноги и корпус', muscles: ['quadriceps', 'hamstrings', 'glutes', 'abdominals'] },
  ],
  4: [
    { title: 'День 1 — Грудь и трицепс', muscles: ['chest', 'triceps'] },
    { title: 'День 2 — Спина и бицепс', muscles: ['lats', 'middle back', 'biceps'] },
    { title: 'День 3 — Ноги', muscles: ['quadriceps', 'hamstrings', 'glutes'] },
    { title: 'День 4 — Плечи и корпус', muscles: ['shoulders', 'abdominals'] },
  ],
  5: [
    { title: 'День 1 — Грудь', muscles: ['chest', 'triceps'] },
    { title: 'День 2 — Спина', muscles: ['lats', 'middle back'] },
    { title: 'День 3 — Ноги', muscles: ['quadriceps', 'hamstrings', 'glutes'] },
    { title: 'День 4 — Плечи и руки', muscles: ['shoulders', 'biceps', 'triceps'] },
    { title: 'День 5 — Корпус и слабые места', muscles: ['abdominals', 'glutes', 'lats'] },
  ],
  6: [
    { title: 'День 1 — Жимовые', muscles: ['chest', 'shoulders', 'triceps'] },
    { title: 'День 2 — Тяговые', muscles: ['lats', 'middle back', 'biceps'] },
    { title: 'День 3 — Ноги', muscles: ['quadriceps', 'hamstrings', 'glutes'] },
    { title: 'День 4 — Жимовые (лёгкий)', muscles: ['chest', 'shoulders'] },
    { title: 'День 5 — Тяговые (лёгкий)', muscles: ['lats', 'biceps'] },
    { title: 'День 6 — Ноги и корпус', muscles: ['quadriceps', 'glutes', 'abdominals'] },
  ],
}

// Сколько упражнений в день. Меньше четырёх — день не набирает объёма,
// больше шести — тренировка перестаёт помещаться в полтора часа.
const EXERCISES_PER_DAY = { min: 4, max: 6 }

// Подходов на упражнение. Три — рабочий минимум, с которого видно прогресс
// и который новичок реально доводит до конца.
const SETS_PER_EXERCISE = 3

// Порядок предпочтения по типу упражнения: базовые тянут больше мышц за
// подход, поэтому в начале дня стоят они.
const CATEGORY_RANK = { strength: 0, powerlifting: 1, 'olympic weightlifting': 2, strongman: 3 }

const LEVEL_RANK = { beginner: 0, intermediate: 1, expert: 2 }

function levelDistance(exerciseLevel, wanted) {
  const a = LEVEL_RANK[String(exerciseLevel || '').toLowerCase()]
  const b = LEVEL_RANK[wanted]
  if (a == null || b == null) return 1
  return Math.abs(a - b)
}

// Уровень из профиля («Начинающий») — в термины библиотеки («beginner»).
function catalogLevel(level) {
  const value = String(level || '').trim().toLowerCase()
  if (value === 'начинающий') return 'beginner'
  if (value === 'продвинутый') return 'expert'
  return 'intermediate'
}

export function pickForMuscle(exercises, muscle, { level, used = new Set() } = {}) {
  const wanted = catalogLevel(level)
  return exercises
    .filter((ex) => ex.muscleGroup === muscle && !used.has(ex.id))
    .sort((a, b) => {
      // Сначала по близости к уровню, потом по «базовости», потом по имени —
      // последнее нужно, чтобы одна и та же анкета давала одну и ту же
      // программу, а не новую при каждом нажатии.
      const byLevel = levelDistance(a.level, wanted) - levelDistance(b.level, wanted)
      if (byLevel !== 0) return byLevel
      const rank = (ex) => CATEGORY_RANK[String(ex.category || '').toLowerCase()] ?? 9
      const byCategory = rank(a) - rank(b)
      if (byCategory !== 0) return byCategory
      return exerciseName(a).localeCompare(exerciseName(b), 'ru')
    })[0]
}

export function buildStarterPlan({ exercises = [], daysPerWeek = 3, equipment = [], level = '' } = {}) {
  const days = SPLITS[Math.min(Math.max(Number(daysPerWeek) || 3, 2), 6)] || SPLITS[3]

  // Инвентарь сужает библиотеку, но не досуха: если под выбранное железо
  // не находится ничего, программа из двух упражнений хуже, чем программа
  // с парой лишних. Поэтому при пустой выборке возвращаемся ко всей базе.
  const matching = equipment.length
    ? exercises.filter((ex) => equipment.includes(ex.equipment))
    : exercises
  const pool = matching.length >= EXERCISES_PER_DAY.min ? matching : exercises

  const reps = recommendedReps(level)
  const used = new Set()

  // Повтор между днями допустим, внутри дня — нет. Жёсткий запрет на повтор
  // во всей программе выглядит логично, но на шестидневном сплите (где
  // «жимовые» идут дважды) он вычерпывает библиотеку, и последние дни
  // молча остаются пустыми. Разнообразие — пожелание, шесть заявленных
  // дней — обещание.
  function take(muscle, inDay) {
    const fresh = pickForMuscle(pool, muscle, { level, used: new Set([...used, ...inDay]) })
    return fresh || pickForMuscle(pool, muscle, { level, used: inDay })
  }

  const workouts = days
    .map((day) => {
      const items = []
      const inDay = new Set()

      const add = (ex) => {
        used.add(ex.id)
        inDay.add(ex.id)
        items.push(ex)
      }

      // Первый проход — по одному упражнению на каждую группу дня: так день
      // получается сбалансированным, а не тремя вариациями жима.
      day.muscles.forEach((muscle) => {
        if (items.length >= EXERCISES_PER_DAY.max) return
        const ex = take(muscle, inDay)
        if (ex) add(ex)
      })

      // Второй проход добирает до минимума, если групп в дне меньше четырёх.
      let guard = 0
      while (items.length < EXERCISES_PER_DAY.min && guard < day.muscles.length * 3) {
        const ex = take(day.muscles[guard % day.muscles.length], inDay)
        guard += 1
        if (ex) add(ex)
      }

      return {
        title: day.title,
        items: items.slice(0, EXERCISES_PER_DAY.max).map((ex) => ({
          exerciseId: ex.id,
          exerciseName: exerciseName(ex),
          targetSets: SETS_PER_EXERCISE,
          targetReps: reps.min,
          targetRepsMax: reps.max,
        })),
      }
    })
    .filter((workout) => workout.items.length > 0)

  return {
    summary: buildSummary({ days: workouts.length, reps, level }),
    workouts,
  }
}

function buildSummary({ days, reps, level }) {
  return (
    `Сплит на ${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} в неделю, по ${SETS_PER_EXERCISE} подхода ` +
    `на упражнение в диапазоне ${reps.min}-${reps.max} повторений. ${reps.why} ` +
    `Каждая группа мышц получает не больше ${MAX_SETS_PER_MUSCLE_PER_SESSION} подходов за тренировку — ` +
    `больше за раз качественно не сделать. ` +
    (level ? '' : 'Уровень не указан, поэтому диапазон взят средний — его можно поменять в профиле. ') +
    'Дальше приложение будет само поднимать веса по вашим цифрам.'
  )
}
