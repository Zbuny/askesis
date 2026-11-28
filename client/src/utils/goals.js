// Личные цели: «жим 100 кг на 1 раз», «подтягивания 15 раз».
//
// Факт достижения нигде не хранится — он выводится из журнала, как рекорды
// (records.js), серия (streak.js) и XP (gamification.js). Причина та же:
// отметку «цель взята», которую ставит клиент, невозможно удержать в
// согласии с журналом — она переживёт удаление тренировки, продублируется
// при обрыве сети и накрутится из консоли браузера. Производная величина
// всегда сходится с тем, что человек реально поднял.
//
// Хранится только то, что из журнала не выводится: сама цель и точка
// отсчёта на момент её постановки.

import { estimateOneRepMax } from './repRanges.js'
import { personalRecords } from './records.js'
import { entrySets } from './workoutLog.js'

// Ниже нижней границы цель теряет смысл, выше верхней — это уже опечатка.
export const MAX_GOAL_WEIGHT = 500
export const MAX_GOAL_REPS = 100

// Доли пути, на которых имеет смысл отметить веху. Ровно те же четверти,
// что человек и так держит в голове: «половина пути», «уже три четверти».
export const GOAL_MILESTONES = [25, 50, 75, 100]

// Цель и текущий результат сравниваем так же, как рекорды между собой —
// через оценку разового максимума. Иначе «100 кг × 1» и «85 кг × 5»
// невозможно поставить на одну шкалу, а это одно и то же по силе.
export function goalScore(goal) {
  const weight = Number(goal?.targetWeight) || 0
  const reps = Number(goal?.targetReps) || 1
  if (weight <= 0) return reps > 0 ? reps : 0
  return estimateOneRepMax(weight, reps) ?? weight
}

// Упражнения со своим весом: поднимать нечего, растут повторения — и цель
// ставится в них же.
export function isRepsGoal(goal) {
  return !(Number(goal?.targetWeight) > 0)
}

export function formatGoal(goal) {
  if (isRepsGoal(goal)) return `${Number(goal?.targetReps) || 0} повт.`
  const reps = Number(goal?.targetReps) || 1
  return reps > 1 ? `${goal.targetWeight} кг × ${reps}` : `${goal.targetWeight} кг`
}

// Лучшее число повторений по каждому упражнению.
//
// Отдельно от records.js не по прихоти: рекорды там сравниваются через
// оценку разового максимума, а она требует веса — подход «0 кг × 15» даёт
// null, и подтягивания в рекорды не попадают вовсе. Для цели «подтянуться
// 15 раз» это и есть единственная измеримая величина.
export function bestRepsByExercise(history = []) {
  const best = new Map()

  history.forEach((session) => {
    ;(session.entries || []).forEach((entry) => {
      if (!entry?.exerciseId) return
      entrySets(entry).forEach((set) => {
        const reps = Number(set?.reps) || 0
        if (reps <= 0) return
        const current = best.get(entry.exerciseId)
        if (!current || reps > current.reps) {
          best.set(entry.exerciseId, {
            exerciseId: entry.exerciseId,
            name: entry.exerciseName || entry.exerciseId,
            reps,
            weight: Number(set?.weight) || 0,
            date: session.date,
          })
        }
      })
    })
  })

  return best
}

// Обе таблицы разом: цель может быть и весовой, и на повторения.
export function goalSources(history = []) {
  return { records: personalRecords(history), reps: bestRepsByExercise(history) }
}

// Текущий результат в том же измерении, что и цель.
function currentScore(goal, best) {
  if (!best) return 0
  if (isRepsGoal(goal)) return Number(best.reps) || 0
  return best.oneRepMax ?? best.weight ?? 0
}

export function goalProgress(goal, { records = new Map(), reps = new Map() } = {}) {
  const best = (isRepsGoal(goal) ? reps.get?.(goal?.exerciseId) : records.get?.(goal?.exerciseId)) || null
  const target = goalScore(goal)
  const current = currentScore(goal, best)

  // Точка отсчёта — результат на момент постановки цели. Без неё прогресс
  // пришлось бы считать от нуля, и человек, начавший жать 90 кг при цели
  // 100, видел бы «90% готово» в первый же день — то есть почти ничего.
  const start = Number(goal?.startScore) || 0
  const span = target - start

  const percent =
    target <= 0 ? 0 : span <= 0 ? 100 : Math.max(0, Math.min(100, Math.round(((current - start) / span) * 100)))

  return {
    goal,
    record: best,
    target: Math.round(target * 10) / 10,
    current: Math.round(current * 10) / 10,
    start: Math.round(start * 10) / 10,
    percent,
    achieved: current >= target && target > 0,
    // Сколько осталось — в тех же единицах, в которых поставлена цель.
    remaining: Math.max(0, Math.round((target - current) * 10) / 10),
    unit: isRepsGoal(goal) ? 'повт.' : 'кг',
    // Ближайшая непройденная веха: то, до чего дотянуться реально сегодня.
    nextMilestone: GOAL_MILESTONES.find((milestone) => milestone > percent) || null,
  }
}

export function goalList(goals = [], history = []) {
  const sources = goalSources(history)
  return goals
    .map((goal) => goalProgress(goal, sources))
    .sort((a, b) => {
      // Взятые цели уходят вниз: экран нужен для того, что ещё впереди.
      if (a.achieved !== b.achieved) return a.achieved ? 1 : -1
      return b.percent - a.percent
    })
}

// Точка отсчёта на момент постановки цели — считает форма создания.
export function startScoreFor(goal, history = []) {
  const { records, reps } = goalSources(history)
  const best = isRepsGoal(goal) ? reps.get(goal?.exerciseId) : records.get(goal?.exerciseId)
  return best ? currentScore(goal, best) : 0
}
