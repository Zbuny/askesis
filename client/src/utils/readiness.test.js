import { describe, it, expect } from 'vitest'
import { averageReadiness, readinessScore, todayCheckin } from './readiness.js'

describe('readinessScore', () => {
  it('на лучшем самочувствии даёт максимум', () => {
    const score = readinessScore({ sleep: 5, energy: 5, soreness: 1 })

    expect(score.percent).toBe(100)
    expect(score.key).toBe('high')
    expect(score.loadFactor).toBe(1)
  })

  it('на худшем — минимум и совет отдохнуть', () => {
    const score = readinessScore({ sleep: 1, energy: 1, soreness: 5 })

    expect(score.percent).toBe(0)
    expect(score.key).toBe('poor')
    expect(score.loadFactor).toBe(0.7)
    expect(score.advice).toContain('отдых')
  })

  it('недосып весит больше забитости', () => {
    const badSleep = readinessScore({ sleep: 1, energy: 3, soreness: 1 })
    const badSoreness = readinessScore({ sleep: 3, energy: 3, soreness: 5 })

    expect(badSleep.percent).toBeLessThan(badSoreness.percent)
  })

  it('на среднем самочувствии не мешает работать по плану', () => {
    const score = readinessScore({ sleep: 3, energy: 3, soreness: 2 })

    expect(score.loadFactor).toBe(1)
    expect(['high', 'normal']).toContain(score.key)
  })

  it('просевший день урезает нагрузку, но не отменяет тренировку', () => {
    const score = readinessScore({ sleep: 2, energy: 2, soreness: 3 })

    expect(score.key).toBe('low')
    expect(score.loadFactor).toBe(0.85)
  })

  it('без единого ответа ничего не выдумывает', () => {
    expect(readinessScore({})).toBeNull()
    expect(readinessScore()).toBeNull()
    // Самый частый случай: отметки за сегодня нет, todayCheckin вернул null.
    expect(readinessScore(null)).toBeNull()
  })

  it('мусор и значения вне шкалы прижимает к её краям', () => {
    expect(readinessScore({ sleep: 99, energy: 99, soreness: -5 }).percent).toBe(100)
  })
})

describe('todayCheckin', () => {
  const now = new Date('2026-08-11T18:00:00')

  it('находит сегодняшнюю отметку', () => {
    const checkins = [
      { id: 'a', date: '2026-08-11T07:00:00', sleep: 4 },
      { id: 'b', date: '2026-08-10T07:00:00', sleep: 2 },
    ]

    expect(todayCheckin(checkins, now).id).toBe('a')
  })

  it('вчерашняя за сегодняшнюю не сходит', () => {
    expect(todayCheckin([{ id: 'b', date: '2026-08-10T07:00:00' }], now)).toBeNull()
    expect(todayCheckin([], now)).toBeNull()
  })
})

describe('averageReadiness', () => {
  const now = new Date('2026-08-11T18:00:00')

  it('усредняет последние дни', () => {
    const checkins = [
      { date: '2026-08-11T07:00:00', sleep: 5, energy: 5, soreness: 1 },
      { date: '2026-08-10T07:00:00', sleep: 1, energy: 1, soreness: 5 },
    ]

    expect(averageReadiness(checkins, 7, now)).toEqual({ count: 2, percent: 50 })
  })

  it('старые отметки в среднее не идут', () => {
    const checkins = [{ date: '2026-06-01T07:00:00', sleep: 5, energy: 5, soreness: 1 }]

    expect(averageReadiness(checkins, 7, now)).toBeNull()
  })

  it('без отметок среднего нет', () => {
    expect(averageReadiness([], 7, now)).toBeNull()
  })
})
