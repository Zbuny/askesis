import { describe, it, expect } from 'vitest'
import { HALF_LIFE_DAYS, SATURATION_SETS, exerciseRegions, growthFromSets, physique, stageTitle } from './physique.js'

const NOW = new Date('2026-06-01T12:00:00Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

const catalog = new Map([
  ['bench', { id: 'bench', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders'] }],
  ['curl', { id: 'curl', muscleGroup: 'biceps' }],
  ['pullup', { id: 'pullup', muscleGroup: 'lats', secondaryMuscles: ['biceps'] }],
])

const session = (date, exerciseId, sets) => ({
  date,
  entries: [{ exerciseId, sets: Array.from({ length: sets }, () => ({ weight: 60, reps: 8 })) }],
})

const region = (result, key) => result.regions.find((r) => r.key === key)

describe('growthFromSets', () => {
  it('ноль подходов — ноль роста, насыщение — около 63%', () => {
    expect(growthFromSets(0)).toBe(0)
    expect(growthFromSets(SATURATION_SETS)).toBeCloseTo(0.632, 2)
  })

  it('растёт всё медленнее и не доходит до 100%', () => {
    const first = growthFromSets(50) - growthFromSets(0)
    const later = growthFromSets(500) - growthFromSets(450)
    expect(later).toBeLessThan(first)
    expect(growthFromSets(10_000)).toBeLessThanOrEqual(1)
  })

  it('мусор не ломает расчёт', () => {
    expect(growthFromSets(-5)).toBe(0)
    expect(growthFromSets('много')).toBe(0)
  })
})

describe('exerciseRegions', () => {
  it('основная мышца целиком, синергисты частично', () => {
    const shares = exerciseRegions(catalog.get('bench'))
    expect(shares.chest).toBe(1)
    expect(shares.triceps).toBeGreaterThan(0)
    expect(shares.triceps).toBeLessThan(1)
  })

  it('без каталога ничего не засчитывает', () => {
    expect(exerciseRegions(undefined)).toEqual({})
  })
})

describe('physique', () => {
  it('пустая история — персонаж на старте', () => {
    const result = physique([], catalog, NOW)
    expect(result.overall).toBe(0)
    expect(result.stage).toBe('Старт')
    expect(result.lagging).toBeNull()
    expect(result.regions.every((r) => r.growth === 0 && r.pump === 0)).toBe(true)
  })

  it('растит именно ту мышцу, что работала', () => {
    const result = physique([session(daysAgo(10), 'curl', 5)], catalog, NOW)
    expect(region(result, 'biceps').growth).toBeGreaterThan(0)
    expect(region(result, 'chest').growth).toBe(0)
    expect(region(result, 'biceps').sets).toBe(5)
  })

  it('подходы без повторений не считаются', () => {
    const history = [{ date: daysAgo(3), entries: [{ exerciseId: 'curl', sets: [{ weight: 20, reps: 0 }] }] }]
    expect(region(physique(history, catalog, NOW), 'biceps').growth).toBe(0)
  })

  it('старые подходы весят меньше свежих', () => {
    const fresh = physique([session(daysAgo(5), 'curl', 10)], catalog, NOW)
    const old = physique([session(daysAgo(HALF_LIFE_DAYS + 5), 'curl', 10)], catalog, NOW)
    expect(region(old, 'biceps').growth).toBeLessThan(region(fresh, 'biceps').growth)
    expect(region(old, 'biceps').growth).toBeGreaterThan(0)
  })

  it('свежая тренировка даёт памп, позавчерашняя — уже нет', () => {
    expect(region(physique([session(daysAgo(0.2), 'bench', 12)], catalog, NOW), 'chest').pump).toBeGreaterThan(0.8)
    expect(region(physique([session(daysAgo(3), 'bench', 12)], catalog, NOW), 'chest').pump).toBe(0)
  })

  it('та же история — тот же персонаж', () => {
    const history = [session(daysAgo(2), 'bench', 4), session(daysAgo(9), 'pullup', 6)]
    expect(physique(history, catalog, NOW)).toEqual(physique(history, catalog, NOW))
  })

  it('называет отстающую группу', () => {
    const history = Array.from({ length: 20 }, (_, i) => session(daysAgo(i * 2 + 1), i % 2 ? 'bench' : 'pullup', 8))
    const result = physique(history, catalog, NOW)
    expect(result.lagging).not.toBeNull()
    expect(result.lagging.growth).toBe(Math.min(...result.regions.map((r) => r.growth)))
  })

  it('дата из будущего не даёт бонуса сверх свежей', () => {
    const future = physique([session(daysAgo(-30), 'curl', 10)], catalog, NOW)
    const today = physique([session(daysAgo(0), 'curl', 10)], catalog, NOW)
    expect(region(future, 'biceps').growth).toBeCloseTo(region(today, 'biceps').growth, 6)
  })
})

describe('stageTitle', () => {
  it('ступени идут по общему развитию', () => {
    expect(stageTitle(0)).toBe('Старт')
    expect(stageTitle(0.5)).toBe('Атлетичный')
    expect(stageTitle(0.95)).toBe('Монумент')
  })
})
