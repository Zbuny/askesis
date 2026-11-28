import { describe, it, expect } from 'vitest'
import { buildSessionContext, quickQuestions } from './sessionCoach.js'

const workout = {
  title: 'Ноги',
  items: [
    { exerciseId: 'squat', exerciseName: 'Squat', targetSets: 3, targetReps: 8, targetRepsMax: 10 },
    { exerciseId: 'lunge', exerciseName: 'Lunge', targetSets: 2, targetReps: 12 },
  ],
}

describe('buildSessionContext', () => {
  it('без тренировки ничего не отправляет', () => {
    expect(buildSessionContext({ workout: null })).toBeNull()
  })

  it('собирает план, цель на сегодня, подходы из формы и запас', () => {
    const ctx = buildSessionContext({
      workout,
      results: {
        squat: [
          { weight: '80', reps: '8' },
          { weight: '80', reps: '' },
          { weight: '', reps: '' },
        ],
      },
      rir: { squat: 1 },
      targets: new Map([['squat', { weight: 82.5, reps: 8, range: { min: 8, max: 10 } }]]),
      exerciseNames: { squat: 'Присед' },
      readiness: { percent: 64 },
      elapsedSeconds: 25 * 60 + 40,
    })

    expect(ctx.title).toBe('Ноги')
    expect(ctx.minutes).toBe(25)
    expect(ctx.readiness).toBe('64%')
    expect(ctx.focus).toBeNull()
    expect(ctx.exercises[0]).toEqual({
      name: 'Присед',
      plan: '3×8-10',
      today: '82.5 кг × 8-10',
      sets: '80×8, 80×?',
      rir: 'Ещё 1',
    })
    // Без перевода и без записей — имя из тренировки и пустые поля.
    expect(ctx.exercises[1]).toEqual({ name: 'Lunge', plan: '2×12', today: '', sets: '', rir: '' })
  })

  it('подходы без веса пишет повторами', () => {
    const ctx = buildSessionContext({ workout, results: { lunge: [{ weight: '', reps: '12' }] } })
    expect(ctx.exercises[1].sets).toBe('12 повт.')
  })

  it('отмечает упражнение, о котором спрашивают', () => {
    const ctx = buildSessionContext({ workout, focusExerciseId: 'lunge', exerciseNames: { lunge: 'Выпады' } })
    expect(ctx.focus).toBe('Выпады')
  })

  it('не выдумывает время и готовность, если их нет', () => {
    const ctx = buildSessionContext({ workout })
    expect(ctx.minutes).toBeNull()
    expect(ctx.readiness).toBeNull()
  })
})

describe('quickQuestions', () => {
  it('про упражнение подставляет его название', () => {
    expect(quickQuestions('Присед')[0]).toContain('«Присед»')
  })

  it('без упражнения даёт общие вопросы про тренировку', () => {
    expect(quickQuestions(null).join(' ')).not.toContain('«')
  })
})
