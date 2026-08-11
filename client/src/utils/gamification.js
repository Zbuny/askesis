// XP, уровни и недельная цель.
//
// Главное решение: XP не хранится счётчиком, а пересчитывается из журнала
// тренировок и питания. Cloud Functions на Spark-плане недоступны, а
// счётчику, который увеличивает сам клиент, верить нельзя — его накрутит
// кто угодно из консоли браузера, и он же удвоится, если сохранение
// повторится после обрыва сети. Производная величина снимает оба вопроса
// сразу: одна и та же история всегда даёт одно и то же число, а перезагрузка
// страницы физически не может ничего начислить.
//
// Цена решения — XP нельзя выдать за то, чего нет в журнале. Поэтому каждое
// правило ниже опирается на конкретный след в данных.

import { localDayKey, uniqueDayKeys, weekKey } from './dates.js'
import { entrySets } from './workoutLog.js'
import { currentStreak } from './streak.js'
import { recordsBySession } from './records.js'

// Все величины — в одном месте, чтобы баланс правился здесь, а не по экранам.
export const XP_RULES = {
  workout: 100,
  allSetsCompleted: 25,
  personalRecord: 150,
  streakMilestone: 100,
  weeklyGoal: 250,
  nutritionDay: 20,
  followedTarget: 30,
}

// Каждые три дня подряд — отметка вехи. Считаем по завершённым тройкам,
// иначе награда то появлялась бы, то исчезала при обрыве серии.
export const STREAK_MILESTONE_STEP = 3

// Сколько тренировок в неделю считаем выполненной целью.
export const WEEKLY_WORKOUT_GOAL = 3

// XP за одну тренировку. prCount приходит снаружи: рекорд определяется
// сравнением со всей предыдущей историей, одной сессии для этого мало.
export function sessionXp(session, prCount = 0) {
  if (!session) return 0
  const entries = session.entries || []
  if (entries.length === 0) return 0

  let xp = XP_RULES.workout

  // «Все подходы выполнены» — в каждом упражнении журнала есть хотя бы один
  // засчитанный подход с повторениями. Пустые упражнения человек пропустил.
  const everyEntryDone = entries.every((entry) =>
    entrySets(entry).some((set) => (Number(set.reps) || 0) > 0),
  )
  if (everyEntryDone) xp += XP_RULES.allSetsCompleted

  xp += prCount * XP_RULES.personalRecord

  // Follow-through по рекомендации: отметку ставит страница тренировки,
  // когда человек берёт предложенный вес кнопкой «Взять».
  const followed = entries.filter((entry) => entry.followedTarget).length
  xp += followed * XP_RULES.followedTarget

  return xp
}

export function weeklyGoalWeeks(history = [], goal = WEEKLY_WORKOUT_GOAL) {
  const byWeek = new Map()
  history.forEach((session) => {
    const key = weekKey(session?.date)
    if (!key) return
    // В зачёт идут дни, а не записи: две тренировки за день — это один день.
    const days = byWeek.get(key) || new Set()
    days.add(localDayKey(session.date))
    byWeek.set(key, days)
  })
  return [...byWeek.entries()].filter(([, days]) => days.size >= goal).map(([key]) => key)
}

// Сколько раз серия проходила отметку в три дня за всю историю. Считаем по
// длине каждой непрерывной цепочки, а не по текущей серии: иначе вчерашние
// награды пропадали бы после первого же пропуска.
function streakMilestoneCount(dates = []) {
  const days = uniqueDayKeys(dates)
  if (days.length === 0) return 0

  let total = 0
  let run = 1
  for (let i = 1; i <= days.length; i += 1) {
    const previous = new Date(`${days[i - 1]}T12:00:00`)
    previous.setDate(previous.getDate() + 1)
    if (i < days.length && days[i] === localDayKey(previous)) {
      run += 1
    } else {
      total += Math.floor(run / STREAK_MILESTONE_STEP)
      run = 1
    }
  }
  return total
}

export function totalXp({ history = [], foodLogs = [], weeklyGoal = WEEKLY_WORKOUT_GOAL } = {}) {
  const prCounts = recordsBySession(history)

  const workouts = history.reduce(
    (sum, session) => sum + sessionXp(session, prCounts.get(session.id) || 0),
    0,
  )
  const nutrition = uniqueDayKeys(foodLogs.map((log) => log?.date)).length * XP_RULES.nutritionDay
  const streaks = streakMilestoneCount(history.map((session) => session?.date)) * XP_RULES.streakMilestone
  const weekly = weeklyGoalWeeks(history, weeklyGoal).length * XP_RULES.weeklyGoal

  return workouts + nutrition + streaks + weekly
}

// ---------- уровни ----------

// Шаг между уровнями растёт линейно: на переход с 12-го на 13-й нужно
// 250 × 12 = 3000 XP. Кривая нарочно пологая — уровень должен отмечать путь,
// а не превращаться в вторую работу.
export const XP_PER_LEVEL_STEP = 250

export function xpToAdvance(level) {
  return XP_PER_LEVEL_STEP * Math.max(1, level)
}

// Сумма арифметической прогрессии: сколько XP нужно, чтобы дойти до уровня.
export function xpForLevel(level) {
  const target = Math.max(1, level)
  return (XP_PER_LEVEL_STEP * (target - 1) * target) / 2
}

export const LEVEL_TITLES = [
  { from: 30, title: 'Мастер' },
  { from: 20, title: 'Восходящий' },
  { from: 10, title: 'Атлет' },
  { from: 5, title: 'Дисциплина' },
  { from: 1, title: 'Начало' },
]

export function levelTitle(level) {
  return LEVEL_TITLES.find((entry) => level >= entry.from)?.title || 'Начало'
}

export function levelFromXp(xp) {
  const total = Math.max(0, Number(xp) || 0)

  // Обратная к xpForLevel: L = (1 + sqrt(1 + 8·xp/step)) / 2. Корень даёт
  // погрешность на границах, поэтому результат поправляем сравнением.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * total) / XP_PER_LEVEL_STEP)) / 2))
  while (xpForLevel(level + 1) <= total) level += 1
  while (level > 1 && xpForLevel(level) > total) level -= 1

  const base = xpForLevel(level)
  const needed = xpToAdvance(level)
  return {
    level,
    title: levelTitle(level),
    xp: total,
    xpInLevel: total - base,
    xpForNext: needed,
    percent: Math.min(100, Math.round(((total - base) / needed) * 100)),
  }
}

// Полная сводка для дашборда: одно место, где история превращается в цифры.
export function gamificationSummary({ history = [], foodLogs = [], weeklyGoal = WEEKLY_WORKOUT_GOAL, now = new Date() } = {}) {
  const xp = totalXp({ history, foodLogs, weeklyGoal })
  const dates = history.map((session) => session?.date)
  const thisWeek = weekKey(now)
  const weekDays = uniqueDayKeys(
    history.filter((session) => weekKey(session?.date) === thisWeek).map((session) => session.date),
  ).length

  return {
    ...levelFromXp(xp),
    streak: currentStreak(dates, now),
    week: {
      done: weekDays,
      goal: weeklyGoal,
      percent: Math.min(100, Math.round((weekDays / weeklyGoal) * 100)),
      completed: weekDays >= weeklyGoal,
    },
  }
}
