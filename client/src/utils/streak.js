// Серия тренировок в днях.
//
// Серия не хранится в базе, а каждый раз считается из дат тренировок. Так
// её нельзя ни потерять при перезагрузке, ни накрутить: цифра — производная
// от журнала, а не отдельный счётчик, который кто-то должен вовремя
// увеличить. Cloud Functions на Spark-плане нет, и доверять инкременту,
// приходящему с клиента, всё равно было бы нельзя.

import { addDays, localDayKey, uniqueDayKeys } from './dates.js'

// Тренировка вчера, но не сегодня, серию не обрывает: день ещё не кончился.
// Обрыв засчитываем, только когда пропущены целые сутки.
export function currentStreak(dates = [], now = new Date()) {
  const days = new Set(uniqueDayKeys(dates))
  if (days.size === 0) return 0

  let cursor = now
  if (!days.has(localDayKey(cursor))) {
    cursor = addDays(cursor, -1)
    if (!days.has(localDayKey(cursor))) return 0
  }

  let streak = 0
  while (days.has(localDayKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function bestStreak(dates = []) {
  const days = uniqueDayKeys(dates)
  if (days.length === 0) return 0

  let best = 1
  let run = 1
  for (let i = 1; i < days.length; i += 1) {
    const expected = localDayKey(addDays(days[i - 1], 1))
    if (days[i] === expected) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }
  return best
}

// Вехи, до которых имеет смысл дотягивать серию. Дальше 365 не идём:
// «до 400 дней осталось 35» никого не мотивирует.
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365]

export function nextStreakMilestone(streak) {
  const target = STREAK_MILESTONES.find((milestone) => milestone > streak)
  if (!target) return null
  return { target, remaining: target - streak }
}

export function streakSummary(dates = [], now = new Date()) {
  const current = currentStreak(dates, now)
  return {
    current,
    best: Math.max(bestStreak(dates), current),
    next: nextStreakMilestone(current),
    trainedToday: new Set(uniqueDayKeys(dates)).has(localDayKey(now)),
  }
}
