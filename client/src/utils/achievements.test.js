import { describe, it, expect } from 'vitest'
import { ACHIEVEMENTS, achievementStats, evaluateAchievements } from './achievements.js'

const set = (weight, reps) => ({ weight, reps })
const entry = (exerciseId, sets) => ({ exerciseId, exerciseName: exerciseId, sets })
const session = (id, date, entries) => ({ id, date: `${date}T12:00:00`, entries })

const oneSession = [session('s1', '2026-08-11', [entry('bench', [set(60, 8)])])]

const unlockedKeys = (data) =>
  evaluateAchievements(data).items.filter((item) => item.unlocked).map((item) => item.key)

describe('achievementStats', () => {
  it('считает подходы, объём и рекорды', () => {
    const history = [session('s1', '2026-08-11', [entry('bench', [set(60, 8), set(60, 8)])])]
    const stats = achievementStats({ history })
    expect(stats.sessions).toBe(1)
    expect(stats.sets).toBe(2)
    expect(stats.volume).toBe(960)
    expect(stats.records).toBe(1)
  })

  it('незаполненные подходы в счёт не идут', () => {
    const history = [session('s1', '2026-08-11', [entry('bench', [set(60, 8), set(0, 0)])])]
    expect(achievementStats({ history }).sets).toBe(1)
  })
})

describe('evaluateAchievements', () => {
  it('без данных не выдаёт ни одного значка', () => {
    const result = evaluateAchievements({})
    expect(result.unlocked).toBe(0)
    expect(result.total).toBe(ACHIEVEMENTS.length)
  })

  it('первая тренировка открывает свой значок и первый рекорд', () => {
    expect(unlockedKeys({ history: oneSession })).toEqual(
      expect.arrayContaining(['first-workout', 'first-pr']),
    )
  })

  it('20 тренировок ещё не дают значок за 100', () => {
    const history = Array.from({ length: 20 }, (_, i) =>
      session(`s${i}`, `2026-07-${String((i % 28) + 1).padStart(2, '0')}`, [entry('bench', [set(60, 8)])]),
    )
    const keys = unlockedKeys({ history })
    expect(keys).toContain('workouts-20')
    expect(keys).not.toContain('workouts-100')
  })

  // Достижения — это условие поверх журнала, а не запись в базе, поэтому
  // повторный расчёт обязан давать ровно тот же список.
  it('повторная проверка не открывает значок второй раз', () => {
    const first = evaluateAchievements({ history: oneSession })
    const second = evaluateAchievements({ history: oneSession })
    expect(second.unlocked).toBe(first.unlocked)
    expect(second.items).toEqual(first.items)
  })

  it('у незакрытого значка есть прогресс, у полученного — нет', () => {
    const result = evaluateAchievements({ history: oneSession })
    const done = result.items.find((item) => item.key === 'first-workout')
    const pending = result.items.find((item) => item.key === 'workouts-20')
    expect(done.progress).toBeNull()
    expect(pending.progress).toEqual({ done: 1, goal: 20, percent: 5 })
  })

  it('питание считается по разным дням', () => {
    const foodLogs = Array.from({ length: 7 }, (_, i) => ({ date: `2026-08-0${i + 1}T09:00:00` }))
    expect(unlockedKeys({ foodLogs })).toContain('nutrition-7')
  })

  it('семь записей питания за один день значок не открывают', () => {
    const foodLogs = Array.from({ length: 7 }, () => ({ date: '2026-08-01T09:00:00' }))
    expect(unlockedKeys({ foodLogs })).not.toContain('nutrition-7')
  })
})
