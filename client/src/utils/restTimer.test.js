import { describe, expect, it } from 'vitest'
import {
  clampRest,
  countSets,
  defaultRestSeconds,
  formatRest,
  remainingSeconds,
  restProgress,
  restSecondsFor,
  setsToLog,
} from './restTimer.js'

describe('defaultRestSeconds', () => {
  it('даёт дольше отдыхать на тяжёлых коротких подходах', () => {
    expect(defaultRestSeconds({ category: 'powerlifting' }, { targetReps: 8 })).toBe(180)
    expect(defaultRestSeconds({ category: 'strength' }, { targetReps: 3 })).toBe(180)
  })

  it('штанга и средние повторы — две минуты', () => {
    expect(defaultRestSeconds({ equipment: 'barbell' }, { targetReps: 10 })).toBe(120)
    expect(defaultRestSeconds({ equipment: 'dumbbell' }, { targetReps: 8 })).toBe(120)
  })

  it('многоповторка и растяжка — коротко', () => {
    expect(defaultRestSeconds({ equipment: 'cable' }, { targetReps: 15 })).toBe(75)
    expect(defaultRestSeconds({ category: 'stretching' }, { targetReps: 10 })).toBe(45)
  })

  it('без данных — полторы минуты', () => {
    expect(defaultRestSeconds(undefined, undefined)).toBe(90)
  })
})

describe('restSecondsFor', () => {
  it('поправка человека важнее расчёта', () => {
    const item = { exerciseId: 'a', targetReps: 3 }
    expect(restSecondsFor({ item, preferences: { a: 75 } })).toBe(75)
    expect(restSecondsFor({ item, preferences: {} })).toBe(180)
  })

  it('держит сохранённое значение в границах', () => {
    expect(restSecondsFor({ item: { exerciseId: 'a' }, preferences: { a: 5000 } })).toBe(600)
  })
})

describe('clampRest', () => {
  it('не даёт уйти за пределы', () => {
    expect(clampRest(0)).toBe(15)
    expect(clampRest(-30)).toBe(15)
    expect(clampRest(700)).toBe(600)
    expect(clampRest(89.6)).toBe(90)
  })
})

describe('remainingSeconds / restProgress', () => {
  it('считает от момента окончания', () => {
    expect(remainingSeconds(10_000, 0)).toBe(10)
    expect(remainingSeconds(10_000, 9_500)).toBe(1)
    expect(remainingSeconds(10_000, 12_000)).toBe(0)
    expect(remainingSeconds(null, 0)).toBe(0)
  })

  it('прогресс от 0 до 1', () => {
    expect(restProgress({ endsAt: 60_000, duration: 60 }, 0)).toBe(0)
    expect(restProgress({ endsAt: 60_000, duration: 60 }, 30_000)).toBe(0.5)
    expect(restProgress({ endsAt: 60_000, duration: 60 }, 90_000)).toBe(1)
  })
})

describe('formatRest', () => {
  it('минуты и секунды', () => {
    expect(formatRest(0)).toBe('0:00')
    expect(formatRest(75)).toBe('1:15')
    expect(formatRest(180)).toBe('3:00')
  })
})

describe('setsToLog', () => {
  const sets = [
    { weight: '80', reps: '8', done: true },
    { weight: '80', reps: '8' },
    { weight: '', reps: '' , done: true },
  ]

  it('без отметок пишет все заполненные подходы', () => {
    expect(setsToLog(sets, false)).toEqual([
      { weight: 80, reps: 8 },
      { weight: 80, reps: 8 },
    ])
  })

  it('с отметками — только отмеченные', () => {
    expect(setsToLog(sets, true)).toEqual([{ weight: 80, reps: 8 }])
  })

  it('не тащит служебный флаг в журнал', () => {
    expect(Object.keys(setsToLog(sets, true)[0])).toEqual(['weight', 'reps'])
  })
})

describe('countSets', () => {
  it('считает все и отмеченные', () => {
    expect(countSets({ a: [{ done: true }, {}], b: [{ done: true }] })).toEqual({ total: 3, done: 2 })
    expect(countSets(undefined)).toEqual({ total: 0, done: 0 })
  })
})
