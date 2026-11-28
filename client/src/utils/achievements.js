// Достижения.
//
// Каждое достижение — условие поверх журнала, а не запись в базе. Поэтому
// «разблокировать дважды» невозможно в принципе: список всегда пересчитан
// из тех же данных. Побочная выгода — достижения можно добавлять задним
// числом, и человек сразу увидит те, что уже заслужил.

import { uniqueDayKeys } from './dates.js'
import { entrySets, sessionVolume } from './workoutLog.js'
import { bestStreak } from './streak.js'
import { personalRecords } from './records.js'
import { WEEKLY_WORKOUT_GOAL, weeklyGoalWeeks } from './gamification.js'

// Порог и текст держим рядом: так видно, за что именно даётся значок.
export const ACHIEVEMENTS = [
  {
    key: 'first-workout',
    title: 'Первая тренировка',
    hint: 'Записать первое выполнение',
    test: (s) => s.sessions >= 1,
  },
  {
    key: 'workouts-20',
    title: '20 тренировок',
    hint: 'Записать 20 выполнений',
    test: (s) => s.sessions >= 20,
    progress: (s) => ({ done: s.sessions, goal: 20 }),
  },
  {
    key: 'workouts-100',
    title: '100 тренировок',
    hint: 'Записать 100 выполнений',
    test: (s) => s.sessions >= 100,
    progress: (s) => ({ done: s.sessions, goal: 100 }),
  },
  {
    key: 'streak-7',
    title: 'Неделя подряд',
    hint: '7 дней подряд с тренировкой',
    test: (s) => s.bestStreak >= 7,
    progress: (s) => ({ done: s.bestStreak, goal: 7 }),
  },
  {
    key: 'streak-30',
    title: 'Месяц подряд',
    hint: '30 дней подряд с тренировкой',
    test: (s) => s.bestStreak >= 30,
    progress: (s) => ({ done: s.bestStreak, goal: 30 }),
  },
  {
    key: 'first-pr',
    title: 'Первый рекорд',
    hint: 'Установить личный рекорд в упражнении',
    test: (s) => s.records >= 1,
  },
  {
    key: 'sets-100',
    title: '100 подходов',
    hint: 'Выполнить 100 подходов суммарно',
    test: (s) => s.sets >= 100,
    progress: (s) => ({ done: s.sets, goal: 100 }),
  },
  {
    key: 'volume-10000',
    title: '10 000 кг объёма',
    hint: 'Набрать 10 000 кг суммарного тоннажа',
    test: (s) => s.volume >= 10000,
    progress: (s) => ({ done: Math.round(s.volume), goal: 10000 }),
  },
  {
    key: 'weekly-goal',
    title: 'Недельная цель',
    hint: `Закрыть неделю с ${WEEKLY_WORKOUT_GOAL} тренировками`,
    test: (s) => s.goalWeeks >= 1,
  },
  {
    key: 'nutrition-7',
    title: 'Неделя питания',
    hint: 'Записать питание в 7 разных дней',
    test: (s) => s.nutritionDays >= 7,
    progress: (s) => ({ done: s.nutritionDays, goal: 7 }),
  },
]

export function achievementStats({ history = [], foodLogs = [] } = {}) {
  const sets = history.reduce(
    (sum, session) =>
      sum +
      (session.entries || []).reduce(
        (count, entry) => count + entrySets(entry).filter((set) => (Number(set.reps) || 0) > 0).length,
        0,
      ),
    0,
  )

  return {
    sessions: history.length,
    sets,
    volume: history.reduce((sum, session) => sum + sessionVolume(session), 0),
    bestStreak: bestStreak(history.map((session) => session?.date)),
    records: personalRecords(history).size,
    goalWeeks: weeklyGoalWeeks(history).length,
    nutritionDays: uniqueDayKeys(foodLogs.map((log) => log?.date)).length,
  }
}

export function evaluateAchievements({ history = [], foodLogs = [] } = {}) {
  const stats = achievementStats({ history, foodLogs })
  const items = ACHIEVEMENTS.map((achievement) => {
    const unlocked = Boolean(achievement.test(stats))
    const progress = achievement.progress?.(stats) || null
    return {
      key: achievement.key,
      title: achievement.title,
      hint: achievement.hint,
      unlocked,
      // Прогресс показываем только у незакрытых: у полученного значка
      // полоска «100 из 100» не несёт информации.
      progress: unlocked || !progress ? null : { ...progress, percent: Math.min(100, Math.round((progress.done / progress.goal) * 100)) },
    }
  })

  return {
    items,
    unlocked: items.filter((item) => item.unlocked).length,
    total: items.length,
  }
}
