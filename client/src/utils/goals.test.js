import { describe, it, expect } from 'vitest'
import { bestRepsByExercise, formatGoal, goalList, goalProgress, goalScore, goalSources, isRepsGoal, startScoreFor } from './goals.js'

const session = (date, exerciseId, name, weight, reps) => ({
  id: `${date}-${exerciseId}`,
  workoutId: 'w1',
  date,
  entries: [{ exerciseId, exerciseName: name, sets: [{ weight, reps }] }],
})

const benchGoal = {
  id: 'g1',
  exerciseId: 'bench',
  exerciseName: 'Жим лёжа',
  targetWeight: 100,
  targetReps: 1,
  startScore: 80,
}

const pullGoal = {
  id: 'g2',
  exerciseId: 'pull',
  exerciseName: 'Подтягивания',
  targetWeight: 0,
  targetReps: 15,
  startScore: 5,
}

describe('goalScore', () => {
  it('приводит цель к оценке разового максимума', () => {
    expect(goalScore({ targetWeight: 100, targetReps: 1 })).toBe(103.3)
    // 85×5 по Эпли — те же ~99 кг, что и «100 на раз»: одна шкала.
    expect(goalScore({ targetWeight: 85, targetReps: 5 })).toBe(99.2)
  })

  it('для своего веса целью служат сами повторения', () => {
    expect(goalScore({ targetWeight: 0, targetReps: 15 })).toBe(15)
    expect(isRepsGoal({ targetWeight: 0, targetReps: 15 })).toBe(true)
  })
})

describe('formatGoal', () => {
  it('пишет цель так, как её ставят вслух', () => {
    expect(formatGoal({ targetWeight: 100, targetReps: 1 })).toBe('100 кг')
    expect(formatGoal({ targetWeight: 85, targetReps: 5 })).toBe('85 кг × 5')
    expect(formatGoal({ targetWeight: 0, targetReps: 15 })).toBe('15 повт.')
  })
})

describe('goalProgress', () => {
  it('считает прогресс от точки постановки, а не от нуля', () => {
    const sources = goalSources([session('2026-08-01T10:00:00Z', 'bench', 'Жим лёжа', 90, 1)])
    const progress = goalProgress(benchGoal, sources)

    // 80 → 103.3 это весь путь; сделано 93 из них.
    expect(progress.start).toBe(80)
    expect(progress.target).toBe(103.3)
    expect(progress.current).toBe(93)
    expect(progress.percent).toBe(56)
    expect(progress.achieved).toBe(false)
  })

  it('засчитывает цель, когда результат её перекрыл', () => {
    const sources = goalSources([session('2026-08-01T10:00:00Z', 'bench', 'Жим лёжа', 105, 1)])
    const progress = goalProgress(benchGoal, sources)

    expect(progress.achieved).toBe(true)
    expect(progress.percent).toBe(100)
    expect(progress.remaining).toBe(0)
  })

  it('без единой записи показывает нулевой прогресс, а не ошибку', () => {
    const progress = goalProgress(benchGoal, goalSources([]))

    expect(progress.current).toBe(0)
    expect(progress.percent).toBe(0)
    expect(progress.record).toBeNull()
  })

  it('цель со своим весом меряет повторениями — в рекорды такое не попадает', () => {
    const sources = goalSources([session('2026-08-01T10:00:00Z', 'pull', 'Подтягивания', 0, 10)])

    // Рекордов у подтягиваний нет вовсе: без веса оценка максимума не считается.
    expect(sources.records.size).toBe(0)

    const progress = goalProgress(pullGoal, sources)
    expect(progress.current).toBe(10)
    expect(progress.percent).toBe(50)
    expect(progress.remaining).toBe(5)
    expect(progress.unit).toBe('повт.')
  })

  it('подсказывает ближайшую непройденную веху', () => {
    const sources = goalSources([session('2026-08-01T10:00:00Z', 'pull', 'Подтягивания', 0, 10)])

    expect(goalProgress(pullGoal, sources).nextMilestone).toBe(75)
    expect(goalProgress(pullGoal, goalSources([])).nextMilestone).toBe(25)
  })

  it('цель, поставленная задним числом ниже текущего результата, сразу взята', () => {
    const sources = goalSources([session('2026-08-01T10:00:00Z', 'bench', 'Жим лёжа', 120, 1)])
    const progress = goalProgress({ ...benchGoal, startScore: 130 }, sources)

    expect(progress.percent).toBe(100)
  })
})

describe('goalList', () => {
  it('взятые цели уводит вниз, остальные — по близости к финишу', () => {
    const history = [
      session('2026-08-01T10:00:00Z', 'bench', 'Жим лёжа', 105, 1),
      session('2026-08-02T10:00:00Z', 'pull', 'Подтягивания', 0, 7),
    ]
    const far = { id: 'g3', exerciseId: 'squat', exerciseName: 'Присед', targetWeight: 150, targetReps: 1, startScore: 100 }

    expect(goalList([benchGoal, pullGoal, far], history).map((row) => row.goal.id)).toEqual(['g2', 'g3', 'g1'])
  })
})

describe('bestRepsByExercise', () => {
  it('берёт лучший подход по повторениям, включая упражнения без веса', () => {
    const history = [
      session('2026-08-01T10:00:00Z', 'pull', 'Подтягивания', 0, 8),
      session('2026-08-05T10:00:00Z', 'pull', 'Подтягивания', 0, 12),
      session('2026-08-09T10:00:00Z', 'pull', 'Подтягивания', 0, 10),
    ]

    expect(bestRepsByExercise(history).get('pull')).toMatchObject({ reps: 12, date: '2026-08-05T10:00:00Z' })
  })

  it('подходы без повторений не считает', () => {
    expect(bestRepsByExercise([session('2026-08-01T10:00:00Z', 'pull', 'Подтягивания', 0, 0)]).size).toBe(0)
  })
})

describe('startScoreFor', () => {
  it('берёт текущий результат как точку отсчёта', () => {
    const history = [session('2026-08-01T10:00:00Z', 'bench', 'Жим лёжа', 90, 1)]

    expect(startScoreFor(benchGoal, history)).toBe(93)
    expect(startScoreFor({ exerciseId: 'unknown' }, history)).toBe(0)
  })

  it('для цели на повторения отсчитывает от лучших повторений', () => {
    const history = [session('2026-08-01T10:00:00Z', 'pull', 'Подтягивания', 0, 6)]

    expect(startScoreFor(pullGoal, history)).toBe(6)
  })
})
