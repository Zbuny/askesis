import { describe, it, expect } from 'vitest'
import { formatTarget, minWeightStep, nextSessionTarget, targetRange, weightStep } from './progression.js'

const bench = { id: 'bench', muscleGroup: 'chest', equipment: 'barbell' }
const squat = { id: 'squat', muscleGroup: 'quadriceps', equipment: 'barbell' }
const curl = { id: 'curl', muscleGroup: 'biceps', equipment: 'dumbbell' }

const entry = (...sets) => ({ sets: sets.map(([weight, reps]) => ({ weight, reps })) })
const today = new Date('2026-08-11T10:00:00Z')
const daysAgo = (days) => new Date(today.getTime() - days * 86_400_000).toISOString()

describe('targetRange', () => {
  it('оставляет заданный диапазон как есть', () => {
    expect(targetRange({ targetReps: 6, targetRepsMax: 8 })).toEqual({ min: 6, max: 8 })
  })

  it('из одного числа делает диапазон, иначе прогрессировать некуда', () => {
    expect(targetRange({ targetReps: 8 })).toEqual({ min: 8, max: 10 })
  })

  it('для «до отказа» берёт рекомендованные 6-8', () => {
    expect(targetRange({ targetReps: 0 })).toMatchObject({ min: 6, max: 8 })
  })
})

describe('шаг веса', () => {
  it('зависит от снаряда и группы мышц', () => {
    expect(minWeightStep(bench)).toBe(2.5)
    expect(minWeightStep(squat)).toBe(5)
    expect(minWeightStep(curl)).toBe(2)
  })

  it('растёт от рабочего веса и уровня', () => {
    expect(weightStep(60, bench, 'Средний')).toBe(2.5)
    expect(weightStep(100, bench, 'Начинающий')).toBe(5)
    expect(weightStep(100, bench, 'Продвинутый')).toBe(2.5)
    expect(weightStep(200, bench, 'Средний')).toBe(5)
    expect(weightStep(100, squat, 'Средний')).toBe(5)
  })

  it('никогда не опускается ниже минимального шага снаряда', () => {
    expect(weightStep(20, curl, 'Продвинутый')).toBe(2)
    expect(weightStep(0, bench, 'Средний')).toBe(2.5)
  })
})

describe('nextSessionTarget', () => {
  const item = { exerciseId: 'bench', targetSets: 3, targetReps: 6, targetRepsMax: 8 }

  it('без истории предлагает подобрать вес', () => {
    const target = nextSessionTarget({ item, exercise: bench, now: today })

    expect(target.action).toBe('start')
    expect(target.weight).toBeNull()
    expect(target.reps).toBe(6)
  })

  it('прибавляет вес, когда верх диапазона взят во всех подходах', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: entry([60, 8], [60, 8], [60, 8]),
      lastDate: daysAgo(7),
      exercise: bench,
      level: 'Средний',
      now: today,
    })

    expect(target.action).toBe('add-weight')
    expect(target.weight).toBe(62.5)
    expect(target.reps).toBe(6)
  })

  it('не прибавляет вес, если просел хотя бы один подход', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: entry([60, 8], [60, 8], [60, 6]),
      lastDate: daysAgo(7),
      exercise: bench,
      now: today,
    })

    expect(target.action).toBe('add-reps')
    expect(target.weight).toBe(60)
    expect(target.reps).toBe(7)
  })

  it('не прибавляет вес, пока не сделано запланированное число подходов', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: entry([60, 8], [60, 8]),
      lastDate: daysAgo(7),
      exercise: bench,
      now: today,
    })

    expect(target.action).toBe('add-reps')
    expect(target.weight).toBe(60)
  })

  it('не считает разминочные подходы рабочими', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: entry([40, 10], [60, 8], [60, 8], [60, 8]),
      lastDate: daysAgo(7),
      exercise: bench,
      level: 'Средний',
      now: today,
    })

    expect(target.action).toBe('add-weight')
    expect(target.weight).toBe(62.5)
  })

  it('снимает вес, когда до нижней границы не хватило больше двух повторений', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: entry([60, 3], [60, 3], [60, 2]),
      lastDate: daysAgo(7),
      exercise: bench,
      now: today,
    })

    expect(target.action).toBe('deload')
    expect(target.weight).toBe(57.5)
    expect(target.reps).toBe(6)
  })

  it('после долгого перерыва просто повторяет прошлый вес', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: entry([60, 8], [60, 8], [60, 8]),
      lastDate: daysAgo(30),
      exercise: bench,
      now: today,
    })

    expect(target.action).toBe('repeat')
    expect(target.weight).toBe(60)
  })

  it('без внешнего веса растит только повторы', () => {
    const target = nextSessionTarget({
      item: { targetSets: 3, targetReps: 10, targetRepsMax: 15 },
      lastEntry: entry([0, 12], [0, 12], [0, 12]),
      lastDate: daysAgo(7),
      exercise: { muscleGroup: 'chest', equipment: 'body only' },
      now: today,
    })

    expect(target.action).toBe('add-reps')
    expect(target.reps).toBe(13)
  })

  it('при большом запасе до отказа поднимает вес, даже если повторы в середине диапазона', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: { ...entry([60, 7], [60, 7], [60, 7]), rir: 3 },
      lastDate: daysAgo(7),
      exercise: bench,
      level: 'Средний',
      now: today,
    })

    // Без RIR это был бы add-reps: до верха диапазона повтора не хватает.
    expect(target.action).toBe('add-weight')
    expect(target.weight).toBe(65)
    expect(target.reps).toBe(6)
  })

  it('берёт двойной шаг, если верх диапазона взят с запасом', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: { ...entry([60, 8], [60, 8], [60, 8]), rir: 2 },
      lastDate: daysAgo(7),
      exercise: bench,
      level: 'Средний',
      now: today,
    })

    expect(target.action).toBe('add-weight')
    expect(target.weight).toBe(65)
  })

  it('до отказа — шаг обычный', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: { ...entry([60, 8], [60, 8], [60, 8]), rir: 0 },
      lastDate: daysAgo(7),
      exercise: bench,
      level: 'Средний',
      now: today,
    })

    expect(target.weight).toBe(62.5)
  })

  it('просевшие повторы важнее заявленного запаса — это противоречивый ввод', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: { ...entry([60, 3], [60, 3], [60, 2]), rir: 3 },
      lastDate: daysAgo(7),
      exercise: bench,
      level: 'Средний',
      now: today,
    })

    expect(target.action).toBe('deload')
  })

  it('со своим весом не предлагает сделать меньше, чем в прошлый раз', () => {
    const target = nextSessionTarget({
      // План 6-8, а человек сделал 20: верхняя граница здесь не потолок —
      // добавлять вместо неё нечего.
      item: { targetSets: 3, targetReps: 6, targetRepsMax: 8 },
      lastEntry: entry([0, 20], [0, 20], [0, 20]),
      lastDate: daysAgo(7),
      exercise: { muscleGroup: 'chest', equipment: 'body only' },
      now: today,
    })

    expect(target.reps).toBe(21)
    expect(target.hint).toContain('перерос')
  })

  it('со своим весом большой запас отправляет сразу к верху диапазона', () => {
    const target = nextSessionTarget({
      item: { targetSets: 3, targetReps: 10, targetRepsMax: 15 },
      lastEntry: { ...entry([0, 11], [0, 11], [0, 11]), rir: 3 },
      lastDate: daysAgo(7),
      exercise: { muscleGroup: 'chest', equipment: 'body only' },
      now: today,
    })

    expect(target.reps).toBe(15)
  })

  it('мусор в поле запаса игнорируется, как будто его не отмечали', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: { ...entry([60, 7], [60, 7], [60, 7]), rir: 99 },
      lastDate: daysAgo(7),
      exercise: bench,
      level: 'Средний',
      now: today,
    })

    expect(target.action).toBe('add-reps')
    expect(target.rir).toBeNull()
  })

  it('читает старые записи с одной парой «вес × повторы»', () => {
    const target = nextSessionTarget({
      item,
      lastEntry: { weight: 60, reps: 8 },
      lastDate: daysAgo(7),
      exercise: bench,
      level: 'Средний',
      now: today,
    })

    // Подход всего один, а в плане три — вес пока не растёт.
    expect(target.action).toBe('add-reps')
    expect(target.weight).toBe(60)
  })
})

describe('formatTarget', () => {
  it('показывает вес и диапазон повторов', () => {
    expect(formatTarget({ weight: 62.5, reps: 6, range: { min: 6, max: 8 } })).toBe('62.5 кг × 6-8')
    expect(formatTarget({ weight: 60, reps: 8, range: { min: 6, max: 8 } })).toBe('60 кг × 8')
  })

  it('обходится без веса для упражнений со своим весом', () => {
    expect(formatTarget({ weight: 0, reps: 13, range: { min: 10, max: 15 } })).toBe('13-15 повт.')
  })

  it('переросшую диапазон цель показывает одним числом, а не «22-8»', () => {
    expect(formatTarget({ weight: 0, reps: 22, range: { min: 6, max: 8 } })).toBe('22 повт.')
  })
})
