import { describe, it, expect } from 'vitest'
import {
  WEEKLY_WORKOUT_GOAL,
  XP_RULES,
  gamificationSummary,
  levelFromXp,
  sessionXp,
  totalXp,
  weeklyGoalWeeks,
  xpForLevel,
  xpToAdvance,
} from './gamification.js'

const set = (weight, reps) => ({ weight, reps })
const entry = (exerciseId, sets, extra = {}) => ({ exerciseId, exerciseName: exerciseId, sets, ...extra })
const session = (id, date, entries) => ({ id, date: `${date}T12:00:00`, entries })

describe('sessionXp', () => {
  it('за тренировку с полностью закрытыми упражнениями даёт базу и бонус', () => {
    const s = session('s1', '2026-08-11', [entry('ex1', [set(60, 8)])])
    expect(sessionXp(s)).toBe(XP_RULES.workout + XP_RULES.allSetsCompleted)
  })

  it('пропущенное упражнение лишает бонуса за все подходы', () => {
    const s = session('s1', '2026-08-11', [entry('ex1', [set(60, 8)]), entry('ex2', [])])
    expect(sessionXp(s)).toBe(XP_RULES.workout)
  })

  it('рекорды начисляются по одному за каждый', () => {
    const s = session('s1', '2026-08-11', [entry('ex1', [set(60, 8)])])
    expect(sessionXp(s, 2)).toBe(XP_RULES.workout + XP_RULES.allSetsCompleted + 2 * XP_RULES.personalRecord)
  })

  it('взятая рекомендация добавляет свою награду', () => {
    const s = session('s1', '2026-08-11', [entry('ex1', [set(60, 8)], { followedTarget: true })])
    expect(sessionXp(s)).toBe(XP_RULES.workout + XP_RULES.allSetsCompleted + XP_RULES.followedTarget)
  })

  it('пустая тренировка не стоит ничего', () => {
    expect(sessionXp(session('s1', '2026-08-11', []))).toBe(0)
    expect(sessionXp(null)).toBe(0)
  })
})

describe('totalXp', () => {
  const history = [
    session('s1', '2026-08-11', [entry('ex1', [set(60, 8)])]),
    session('s2', '2026-08-10', [entry('ex1', [set(55, 8)])]),
  ]

  it('одна и та же история всегда даёт одно и то же число', () => {
    expect(totalXp({ history })).toBe(totalXp({ history }))
  })

  // Главное свойство схемы: XP — производная от журнала, поэтому повторный
  // расчёт (перезагрузка страницы) ничего не начисляет заново.
  it('повторный пересчёт не удваивает награду', () => {
    const once = totalXp({ history })
    const twice = totalXp({ history })
    expect(twice).toBe(once)
  })

  it('питание считается по дням, а не по числу записей', () => {
    const foodLogs = [
      { date: '2026-08-11T09:00:00' },
      { date: '2026-08-11T14:00:00' },
      { date: '2026-08-10T09:00:00' },
    ]
    const withFood = totalXp({ history: [], foodLogs })
    expect(withFood).toBe(2 * XP_RULES.nutritionDay)
  })

  it('пустые данные дают ноль', () => {
    expect(totalXp({})).toBe(0)
  })
})

describe('weeklyGoalWeeks', () => {
  it('засчитывает неделю, в которой набралось нужное число дней', () => {
    // Понедельник-среда одной недели.
    const history = [
      session('s1', '2026-08-10', [entry('ex1', [set(60, 8)])]),
      session('s2', '2026-08-11', [entry('ex1', [set(60, 8)])]),
      session('s3', '2026-08-12', [entry('ex1', [set(60, 8)])]),
    ]
    expect(weeklyGoalWeeks(history)).toHaveLength(1)
  })

  it('две тренировки в один день не закрывают цель', () => {
    const history = [
      session('s1', '2026-08-10', [entry('ex1', [set(60, 8)])]),
      session('s2', '2026-08-10', [entry('ex1', [set(60, 8)])]),
      session('s3', '2026-08-11', [entry('ex1', [set(60, 8)])]),
    ]
    expect(weeklyGoalWeeks(history)).toHaveLength(0)
  })
})

describe('уровни', () => {
  it('на нуле XP — первый уровень', () => {
    const result = levelFromXp(0)
    expect(result.level).toBe(1)
    expect(result.xpInLevel).toBe(0)
  })

  it('шаг до следующего уровня растёт линейно', () => {
    expect(xpToAdvance(1)).toBe(250)
    expect(xpToAdvance(12)).toBe(3000)
  })

  it('порог уровня — сумма всех предыдущих шагов', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(250)
    expect(xpForLevel(12)).toBe(16500)
  })

  it('ровно на пороге уровень уже новый, а прогресс обнулён', () => {
    const result = levelFromXp(xpForLevel(12))
    expect(result.level).toBe(12)
    expect(result.xpInLevel).toBe(0)
    expect(result.xpForNext).toBe(3000)
  })

  it('на XP за один до порога уровень ещё прежний', () => {
    expect(levelFromXp(xpForLevel(12) - 1).level).toBe(11)
  })

  it('расчёт устойчив на всём диапазоне уровней', () => {
    for (let level = 1; level <= 60; level += 1) {
      expect(levelFromXp(xpForLevel(level)).level).toBe(level)
      expect(levelFromXp(xpForLevel(level + 1) - 1).level).toBe(level)
    }
  })

  it('отрицательный и мусорный XP не ломают расчёт', () => {
    expect(levelFromXp(-100).level).toBe(1)
    expect(levelFromXp(undefined).level).toBe(1)
  })

  it('титул меняется на заявленных уровнях', () => {
    expect(levelFromXp(xpForLevel(1)).title).toBe('Начало')
    expect(levelFromXp(xpForLevel(5)).title).toBe('Дисциплина')
    expect(levelFromXp(xpForLevel(10)).title).toBe('Атлет')
    expect(levelFromXp(xpForLevel(30)).title).toBe('Мастер')
  })
})

describe('gamificationSummary', () => {
  const now = new Date('2026-08-12T10:00:00')

  it('собирает уровень, серию и недельный прогресс', () => {
    const history = [
      session('s1', '2026-08-10', [entry('ex1', [set(60, 8)])]),
      session('s2', '2026-08-11', [entry('ex1', [set(62, 8)])]),
      session('s3', '2026-08-12', [entry('ex1', [set(64, 8)])]),
    ]
    const summary = gamificationSummary({ history, now })
    expect(summary.streak).toBe(3)
    expect(summary.week.done).toBe(3)
    expect(summary.week.goal).toBe(WEEKLY_WORKOUT_GOAL)
    expect(summary.week.completed).toBe(true)
    expect(summary.level).toBeGreaterThanOrEqual(1)
  })

  it('без истории показывает первый уровень и пустую неделю', () => {
    const summary = gamificationSummary({ now })
    expect(summary.level).toBe(1)
    expect(summary.streak).toBe(0)
    expect(summary.week.done).toBe(0)
    expect(summary.week.completed).toBe(false)
  })
})
