import { describe, it, expect } from 'vitest'
import { bestStreak, currentStreak, nextStreakMilestone, streakSummary } from './streak.js'

// Даты собираем в местном времени: строка '2026-08-11T23:30' в UTC уехала бы
// на следующий день, и именно на таких случаях серия ломается незаметно.
const day = (isoDay, time = '12:00') => `${isoDay}T${time}:00`
const NOW = new Date('2026-08-11T15:00:00')

describe('currentStreak', () => {
  it('без тренировок серии нет', () => {
    expect(currentStreak([], NOW)).toBe(0)
  })

  it('считает дни подряд, заканчивая сегодняшним', () => {
    const dates = [day('2026-08-11'), day('2026-08-10'), day('2026-08-09')]
    expect(currentStreak(dates, NOW)).toBe(3)
  })

  it('две тренировки в один день — это один день серии', () => {
    const dates = [day('2026-08-11', '08:00'), day('2026-08-11', '19:00'), day('2026-08-10')]
    expect(currentStreak(dates, NOW)).toBe(2)
  })

  it('вчерашняя тренировка серию не обрывает — день ещё не кончился', () => {
    const dates = [day('2026-08-10'), day('2026-08-09')]
    expect(currentStreak(dates, NOW)).toBe(2)
  })

  it('пропущенные сутки обрывают серию', () => {
    const dates = [day('2026-08-09'), day('2026-08-08')]
    expect(currentStreak(dates, NOW)).toBe(0)
  })

  it('поздняя вечерняя тренировка засчитывается в свой день, а не в следующий', () => {
    const dates = [day('2026-08-11', '23:30'), day('2026-08-10', '23:30')]
    expect(currentStreak(dates, NOW)).toBe(2)
  })

  it('серия переживает границу месяца', () => {
    const now = new Date('2026-08-02T10:00:00')
    const dates = [day('2026-08-02'), day('2026-08-01'), day('2026-07-31'), day('2026-07-30')]
    expect(currentStreak(dates, now)).toBe(4)
  })
})

describe('bestStreak', () => {
  it('находит самую длинную цепочку, а не последнюю', () => {
    const dates = [
      day('2026-08-11'),
      day('2026-08-01'), day('2026-08-02'), day('2026-08-03'), day('2026-08-04'),
      day('2026-07-20'), day('2026-07-21'),
    ]
    expect(bestStreak(dates)).toBe(4)
  })

  it('одна тренировка — серия из одного дня', () => {
    expect(bestStreak([day('2026-08-11')])).toBe(1)
  })

  it('пустая история даёт ноль', () => {
    expect(bestStreak([])).toBe(0)
  })
})

describe('nextStreakMilestone', () => {
  it('подсказывает ближайшую веху и остаток до неё', () => {
    expect(nextStreakMilestone(5)).toEqual({ target: 7, remaining: 2 })
  })

  it('на самой вехе показывает следующую', () => {
    expect(nextStreakMilestone(7)).toEqual({ target: 14, remaining: 7 })
  })

  it('после последней вехи не выдумывает новую', () => {
    expect(nextStreakMilestone(400)).toBeNull()
  })
})

describe('streakSummary', () => {
  it('лучшая серия не может оказаться меньше текущей', () => {
    const dates = [day('2026-08-11'), day('2026-08-10')]
    const summary = streakSummary(dates, NOW)
    expect(summary.current).toBe(2)
    expect(summary.best).toBeGreaterThanOrEqual(summary.current)
    expect(summary.trainedToday).toBe(true)
  })

  it('видит, что сегодня ещё не тренировались', () => {
    expect(streakSummary([day('2026-08-10')], NOW).trainedToday).toBe(false)
  })
})
