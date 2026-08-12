import { describe, it, expect } from 'vitest'
import { reviewFacts, reviewSession } from './sessionReview.js'

const exercises = new Map([
  ['bench', { id: 'bench', muscleGroup: 'chest', equipment: 'barbell' }],
  ['row', { id: 'row', muscleGroup: 'middle back', equipment: 'barbell' }],
])

const workout = {
  id: 'w1',
  title: 'День 1',
  items: [
    { exerciseId: 'bench', exerciseName: 'Жим лёжа', targetSets: 3, targetReps: 6, targetRepsMax: 8 },
    { exerciseId: 'row', exerciseName: 'Тяга в наклоне', targetSets: 3, targetReps: 6, targetRepsMax: 8 },
  ],
}

const entry = (exerciseId, name, sets) => ({
  exerciseId,
  exerciseName: name,
  sets: sets.map(([weight, reps]) => ({ weight, reps })),
})

const before = {
  id: 'old',
  workoutId: 'w1',
  date: '2026-08-04T10:00:00.000Z',
  durationMinutes: 50,
  entries: [
    entry('bench', 'Жим лёжа', [[57.5, 8], [57.5, 8], [57.5, 8]]),
    entry('row', 'Тяга в наклоне', [[70, 8], [70, 8], [70, 8]]),
  ],
}

const now = {
  id: 'new',
  workoutId: 'w1',
  date: '2026-08-11T10:00:00.000Z',
  durationMinutes: 47,
  entries: [
    entry('bench', 'Жим лёжа', [[60, 8], [60, 8], [60, 8]]),
    entry('row', 'Тяга в наклоне', [[70, 8], [70, 8], [70, 8]]),
  ],
}

const review = (session, history, options = {}) =>
  reviewSession({ session, history, workout, exerciseById: exercises, level: 'Средний', ...options })

describe('reviewSession', () => {
  it('считает итоги тренировки и XP за неё', () => {
    const result = review(now, [now, before])

    expect(result.sets).toBe(6)
    expect(result.volume).toBe(3 * 60 * 8 + 3 * 70 * 8)
    expect(result.minutes).toBe(47)
    // 100 за тренировку + 25 за все выполненные подходы + 150 за рекорд.
    expect(result.xp).toBe(275)
  })

  it('находит рекорд этой тренировки и выносит его в заголовок', () => {
    const result = review(now, [now, before])

    expect(result.records).toHaveLength(1)
    expect(result.records[0].name).toBe('Жим лёжа')
    expect(result.records[0].gain).toBe(2.5)
    expect(result.headline).toBe('Личный рекорд: Жим лёжа')
  })

  it('сравнивает объём с прошлым разом по той же тренировке', () => {
    const result = review(now, [now, before])

    expect(result.compare.volume).toBe(3 * 57.5 * 8 + 3 * 70 * 8)
    expect(result.compare.delta).toBe(60)
    // 60 кг сверху к 3060 — ровно два процента: прибавка в одном упражнении
    // на фоне всей тренировки выглядит скромнее, чем сама по себе.
    expect(result.compare.percent).toBe(2)
  })

  it('не сравнивает с тренировкой по другой программе', () => {
    const other = { ...before, id: 'other', workoutId: 'w2' }

    expect(review(now, [now, other]).compare).toBeNull()
  })

  it('на каждое упражнение говорит, что ставить в следующий раз', () => {
    const bench = review(now, [now, before]).exercises.find((row) => row.exerciseId === 'bench')

    expect(bench.done).toBe('3×8 по 60 кг')
    expect(bench.change).toEqual({ unit: 'кг', value: 2.5 })
    expect(bench.nextAction).toBe('add-weight')
    expect(bench.next).toBe('62.5 кг × 6-8')
  })

  it('отличает «результат не изменился» от «раньше не делали»', () => {
    const result = review(now, [now, before])

    expect(result.exercises.find((row) => row.exerciseId === 'row').change).toEqual({ unit: 'кг', value: 0 })
    expect(review(now, [now]).exercises.find((row) => row.exerciseId === 'row').change).toBeNull()
  })

  it('упражнения со своим весом сравнивает по повторениям, а не по весу', () => {
    const pullUps = (reps) => ({
      id: `p${reps}`,
      workoutId: 'w1',
      date: reps === 10 ? '2026-08-11T10:00:00.000Z' : '2026-08-04T10:00:00.000Z',
      durationMinutes: 40,
      entries: [entry('pull', 'Подтягивания', [[0, reps], [0, reps], [0, reps]])],
    })

    const result = reviewSession({
      session: pullUps(10),
      history: [pullUps(10), pullUps(8)],
      workout: { id: 'w1', items: [{ exerciseId: 'pull', exerciseName: 'Подтягивания', targetSets: 3, targetReps: 6, targetRepsMax: 12 }] },
      exerciseById: new Map([['pull', { id: 'pull', muscleGroup: 'lats', equipment: 'body only' }]]),
      level: 'Средний',
    })

    // Вес и там, и там ноль — по нему разницы не будет никогда.
    expect(result.exercises[0].change).toEqual({ unit: 'повт.', value: 2 })
  })

  it('называет упражнения, которых нет в записи', () => {
    const partial = { ...now, entries: [now.entries[0]] }
    const note = review(partial, [partial]).notes.find((item) => item.text.startsWith('Не записано'))

    expect(note.text).toContain('Тяга в наклоне')
  })

  it('замечает недобор подходов и объясняет, чем он стоит', () => {
    const short = { ...now, entries: [entry('bench', 'Жим лёжа', [[60, 8], [60, 8]]), now.entries[1]] }
    const note = review(short, [short]).notes.find((item) => item.text.startsWith('Меньше плана'))

    expect(note.text).toContain('Жим лёжа (2 из 3)')
  })

  it('напоминает про таймер, только когда время не засечено', () => {
    const untimed = { ...now, durationMinutes: null }
    const hasHint = (session) =>
      review(session, [session]).notes.some((item) => item.text.startsWith('Время не засечено'))

    expect(hasHint(untimed)).toBe(true)
    expect(hasHint(now)).toBe(false)
  })

  it('предупреждает о просадке отдельной строкой', () => {
    const dropped = { ...now, entries: [entry('bench', 'Жим лёжа', [[60, 3], [60, 3], [60, 2]]), now.entries[1]] }
    const note = review(dropped, [dropped, before]).notes.find((item) => item.text.startsWith('Просадка'))

    expect(note.text).toContain('Жим лёжа')
    expect(note.tone).toBe('warn')
  })

  it('показывает запас до отказа и предупреждает о недоведённых подходах', () => {
    const easy = {
      ...now,
      entries: [{ ...now.entries[0], rir: 3 }, { ...now.entries[1], rir: 0 }],
    }
    const result = review(easy, [easy, before])

    expect(result.exercises[0].rirLabel).toBe('3 и больше')
    expect(result.exercises[1].rirLabel).toBe('До отказа')

    const note = result.notes.find((item) => item.text.startsWith('Далеко от отказа'))
    expect(note.text).toContain('Жим лёжа')
    expect(note.text).not.toContain('Тяга в наклоне')
  })

  it('без отметки запаса ничего о нём не говорит', () => {
    const result = review(now, [now, before])

    expect(result.exercises[0].rirLabel).toBeNull()
    expect(result.notes.some((item) => item.text.startsWith('Далеко от отказа'))).toBe(false)
  })

  it('замечает новый уровень, взятый этой тренировкой', () => {
    // Первая тренировка: 100 за факт + 25 за все выполненные подходы + 150 за
    // первый рекорд = 275 XP. Порог второго уровня — 250, значит он взят.
    const first = {
      id: 'first',
      workoutId: 'w1',
      date: '2026-08-04T10:00:00.000Z',
      durationMinutes: 40,
      entries: [entry('bench', 'Жим лёжа', [[60, 8]])],
    }

    expect(review(first, [first]).levelUp).toMatchObject({ level: 2 })
  })

  it('обычная тренировка внутри уровня событием не считается', () => {
    const first = {
      id: 'first',
      workoutId: 'w1',
      date: '2026-08-04T10:00:00.000Z',
      durationMinutes: 40,
      entries: [entry('bench', 'Жим лёжа', [[60, 8]])],
    }
    // Вес ниже прошлого — рекорда нет, тренировка стоит 125 XP. Итого 400
    // при пороге третьего уровня в 750: уровень тот же.
    const second = {
      ...first,
      id: 'second',
      date: '2026-08-11T10:00:00.000Z',
      entries: [entry('bench', 'Жим лёжа', [[50, 8]])],
    }

    expect(review(second, [second, first]).levelUp).toBeNull()
  })

  it('без тренировки в истории уровень не считает — сравнивать не с чем', () => {
    expect(review(now, []).levelUp).toBeNull()
  })

  it('без тренировки на входе ничего не возвращает', () => {
    expect(reviewSession({})).toBeNull()
  })
})

describe('reviewFacts', () => {
  it('пересказывает разбор строками, готовыми к отправке модели', () => {
    const facts = reviewFacts(review(now, [now, before]))

    expect(facts[0]).toBe('Записана тренировка: 6 подходов, объём 3120 кг, 47 мин в зале.')
    expect(facts.some((fact) => fact.includes('Личный рекорд: Жим лёжа — 60 кг × 8, на 2.5 кг больше прошлого'))).toBe(true)
    expect(facts.some((fact) => fact.includes('В следующий раз запланировано 62.5 кг × 6-8'))).toBe(true)
  })

  it('не ставит вторую точку после «повт.»', () => {
    const bodyweight = {
      id: 'p1',
      workoutId: 'w1',
      date: '2026-08-11T10:00:00.000Z',
      durationMinutes: 40,
      entries: [entry('pull', 'Подтягивания', [[0, 9], [0, 9], [0, 9]])],
    }
    const facts = reviewFacts(
      reviewSession({
        session: bodyweight,
        history: [bodyweight],
        workout: { id: 'w1', items: [{ exerciseId: 'pull', exerciseName: 'Подтягивания', targetSets: 3, targetReps: 6, targetRepsMax: 12 }] },
        level: 'Средний',
      }),
    )

    expect(facts.some((fact) => fact.includes('повт..'))).toBe(false)
    expect(facts.some((fact) => fact.endsWith('запланировано 10-12 повт.'))).toBe(true)
  })

  it('без разбора отдаёт пустой список', () => {
    expect(reviewFacts(null)).toEqual([])
  })
})
