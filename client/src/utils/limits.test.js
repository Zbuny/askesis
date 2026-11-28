import { describe, it, expect } from 'vitest'
import { parseLimits, conflictsWithLimits } from './limits.js'

const deadlift = { nameRu: 'Становая тяга', muscleGroup: 'lower back', equipment: 'barbell' }
const bench = { nameRu: 'Жим лёжа', muscleGroup: 'chest', equipment: 'barbell' }
const raise = { nameRu: 'Махи гантелями', muscleGroup: 'shoulders', equipment: 'dumbbell' }

describe('parseLimits', () => {
  it('без текста ограничений нет', () => {
    expect(parseLimits('')).toEqual([])
    expect(parseLimits(null)).toEqual([])
    expect(parseLimits(undefined)).toEqual([])
  })

  it('выбрасывает слова, которые есть в любой жалобе', () => {
    expect(parseLimits('очень болит, делать нельзя')).toEqual([])
  })

  it('не повторяет одну основу дважды', () => {
    expect(parseLimits('поясница, поясницу берегу')).toContain('пояс')
    expect(parseLimits('поясница, поясницу берегу').filter((w) => w === 'пояс')).toHaveLength(1)
  })
})

describe('conflictsWithLimits', () => {
  it('узнаёт упражнение, названное в другом падеже', () => {
    expect(conflictsWithLimits(deadlift, parseLimits('не делаю становую'))).toBe(true)
  })

  it('узнаёт группу мышц, а не только название', () => {
    expect(conflictsWithLimits(deadlift, parseLimits('болит поясница'))).toBe(true)
  })

  it('узнаёт снаряд', () => {
    expect(conflictsWithLimits(deadlift, parseLimits('дома нет штанги'))).toBe(true)
    expect(conflictsWithLimits(raise, parseLimits('дома нет штанги'))).toBe(false)
  })

  it('не задевает соседние упражнения', () => {
    expect(conflictsWithLimits(bench, parseLimits('болит поясница'))).toBe(false)
    expect(conflictsWithLimits(raise, parseLimits('болит поясница'))).toBe(false)
  })

  it('ё и регистр не мешают совпадению', () => {
    expect(conflictsWithLimits(bench, parseLimits('ЛЁЖА не жму'))).toBe(true)
  })

  it('без ограничений не конфликтует ничего', () => {
    expect(conflictsWithLimits(deadlift, [])).toBe(false)
    expect(conflictsWithLimits(null, parseLimits('болит поясница'))).toBe(false)
  })
})
