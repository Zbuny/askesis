import { describe, it, expect } from 'vitest'
import { coachFacts, coachInsights, effortSummary, plateaus, weeklyMuscleSets } from './coach.js'

// Тренер целиком детерминирован, поэтому «сегодня» фиксируем: иначе тесты
// начали бы падать в зависимости от дня недели и давности данных.
const today = new Date('2026-08-11T10:00:00')
const daysAgo = (days) => new Date(today.getTime() - days * 86_400_000).toISOString()

const exercises = new Map([
  ['bench', { id: 'bench', muscleGroup: 'chest', equipment: 'barbell' }],
  ['fly', { id: 'fly', muscleGroup: 'chest', equipment: 'dumbbell' }],
  ['curl', { id: 'curl', muscleGroup: 'biceps', equipment: 'dumbbell' }],
])

// count одинаковых подходов — так удобнее набирать объём для правил,
// которые считают подходы на группу мышц.
const entry = (exerciseId, name, count, weight, reps) => ({
  exerciseId,
  exerciseName: name,
  sets: Array.from({ length: count }, () => ({ weight, reps })),
})

const session = ({ id = 's1', workoutId = 'w1', date, entries = [], durationMinutes = 45 }) => ({
  id,
  workoutId,
  workoutTitle: 'День 1',
  date,
  durationMinutes,
  entries,
})

const benchWorkout = {
  id: 'w1',
  title: 'День 1',
  items: [{ exerciseId: 'bench', exerciseName: 'Жим лёжа', targetSets: 3, targetReps: 6, targetRepsMax: 8 }],
}

const keysOf = (insights) => insights.map((item) => item.key)

describe('weeklyMuscleSets', () => {
  it('сводит подходы к неделе по четырёхнедельному окну', () => {
    const history = [
      session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим', 10, 60, 8)] }),
      session({ id: 's2', date: daysAgo(9), entries: [entry('bench', 'Жим', 10, 60, 8)] }),
    ]

    const [chest] = weeklyMuscleSets(history, exercises, today)

    expect(chest.key).toBe('chest')
    expect(chest.sets).toBe(20)
    expect(chest.perWeek).toBe(5)
  })

  it('не считает то, что старше окна', () => {
    const history = [session({ id: 's1', date: daysAgo(40), entries: [entry('bench', 'Жим', 10, 60, 8)] })]

    expect(weeklyMuscleSets(history, exercises, today)).toEqual([])
  })

  it('без каталога упражнений молчит, а не приписывает подходы «прочему»', () => {
    const history = [session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим', 10, 60, 8)] })]

    expect(weeklyMuscleSets(history, new Map(), today)).toEqual([])
  })

  it('не считает подходы, в которых нет повторений', () => {
    const history = [session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим', 4, 60, 0)] })]

    expect(weeklyMuscleSets(history, exercises, today)).toEqual([])
  })
})

describe('effortSummary', () => {
  const marked = (rir) => ({ exerciseId: 'bench', exerciseName: 'Жим', sets: [{ weight: 60, reps: 8 }], rir })

  it('считает долю только среди отмеченных подходов', () => {
    const history = [
      session({ id: 's1', date: daysAgo(2), entries: [marked(3), marked(0)] }),
      // Без отметки — не в счёт ни в одну сторону.
      session({ id: 's2', date: daysAgo(9), entries: [entry('bench', 'Жим', 3, 60, 8)] }),
    ]

    expect(effortSummary(history, today)).toEqual({ marked: 2, tooEasy: 1, share: 0.5 })
  })

  it('без единой отметки не делает выводов', () => {
    const history = [session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим', 3, 60, 8)] })]

    expect(effortSummary(history, today)).toEqual({ marked: 0, tooEasy: 0, share: 0 })
  })
})

describe('plateaus', () => {
  it('видит застой, когда лучший результат остался позади', () => {
    const history = [
      session({ id: 's4', date: daysAgo(1), entries: [entry('bench', 'Жим лёжа', 3, 62.5, 6)] }),
      session({ id: 's3', date: daysAgo(7), entries: [entry('bench', 'Жим лёжа', 3, 62.5, 6)] }),
      session({ id: 's2', date: daysAgo(14), entries: [entry('bench', 'Жим лёжа', 3, 62.5, 8)] }),
      session({ id: 's1', date: daysAgo(21), entries: [entry('bench', 'Жим лёжа', 3, 60, 8)] }),
    ]

    const [stalled] = plateaus(history, today)

    expect(stalled.exerciseId).toBe('bench')
    expect(stalled.sessions).toBe(4)
    expect(stalled.stalled).toBe(2)
    expect(stalled.best.weight).toBe(62.5)
  })

  it('молчит, пока прогресс продолжается', () => {
    const history = [
      session({ id: 's3', date: daysAgo(1), entries: [entry('bench', 'Жим', 3, 65, 8)] }),
      session({ id: 's2', date: daysAgo(7), entries: [entry('bench', 'Жим', 3, 62.5, 8)] }),
      session({ id: 's1', date: daysAgo(14), entries: [entry('bench', 'Жим', 3, 60, 8)] }),
    ]

    expect(plateaus(history, today)).toEqual([])
  })

  it('одной неудачной тренировки для застоя мало', () => {
    const history = [
      session({ id: 's3', date: daysAgo(1), entries: [entry('bench', 'Жим', 3, 60, 8)] }),
      session({ id: 's2', date: daysAgo(7), entries: [entry('bench', 'Жим', 3, 62.5, 8)] }),
      session({ id: 's1', date: daysAgo(14), entries: [entry('bench', 'Жим', 3, 60, 8)] }),
    ]

    expect(plateaus(history, today)).toEqual([])
  })
})

describe('coachInsights', () => {
  it('на пустом журнале не выдумывает советов, а зовёт записать первую тренировку', () => {
    const insights = coachInsights({ history: [], workouts: [benchWorkout], now: today })

    expect(keysOf(insights)).toEqual(['first-session'])
    expect(insights[0].action.to).toBe('/workouts/w1')
  })

  it('после долгого перерыва ставит возвращение первым советом', () => {
    const history = [session({ id: 's1', date: daysAgo(30), entries: [entry('bench', 'Жим', 3, 60, 8)] })]

    const insights = coachInsights({
      history,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      now: today,
    })

    expect(insights[0].key).toBe('comeback')
    expect(insights[0].title).toContain('30')
  })

  it('предупреждает про серию, только пока она есть и сегодня не закрыта', () => {
    const history = [
      session({ id: 's2', date: daysAgo(1), entries: [entry('bench', 'Жим', 3, 60, 7)] }),
      session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим', 3, 60, 7)] }),
    ]

    const withStreak = coachInsights({ history, workouts: [benchWorkout], level: 'Средний', now: today })
    expect(keysOf(withStreak)).toContain('streak-risk')

    const trainedToday = coachInsights({
      history: [session({ id: 's3', date: daysAgo(0), entries: [entry('bench', 'Жим', 3, 60, 7)] }), ...history],
      workouts: [benchWorkout],
      level: 'Средний',
      now: today,
    })
    expect(keysOf(trainedToday)).not.toContain('streak-risk')
  })

  it('называет упражнения, дошедшие до прибавки веса', () => {
    const history = [session({ id: 's1', date: daysAgo(3), entries: [entry('bench', 'Жим лёжа', 3, 60, 8)] })]

    const insights = coachInsights({
      history,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      now: today,
    })
    const ready = insights.find((item) => item.key === 'ready-to-add')

    expect(ready).toBeTruthy()
    expect(ready.text).toContain('Жим лёжа')
  })

  it('не зовёт прибавлять, если верх диапазона взят не во всех подходах', () => {
    const history = [
      session({
        id: 's1',
        date: daysAgo(3),
        entries: [{ exerciseId: 'bench', exerciseName: 'Жим лёжа', sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }, { weight: 60, reps: 6 }] }],
      }),
    ]

    const insights = coachInsights({
      history,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      now: today,
    })

    expect(keysOf(insights)).not.toContain('ready-to-add')
  })

  it('замечает перебор по группе мышц', () => {
    const history = Array.from({ length: 4 }, (_, i) =>
      session({ id: `s${i}`, date: daysAgo(i * 7 + 1), entries: [entry('bench', 'Жим', 21, 60, 7)] }),
    )

    const insights = coachInsights({
      history,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      now: today,
    })
    const overloaded = insights.find((item) => item.key === 'overloaded-muscle')

    expect(overloaded).toBeTruthy()
    expect(overloaded.title).toContain('Грудь')
  })

  it('замечает отстающую группу — но только на фоне группы, которая норму набирает', () => {
    const trained = Array.from({ length: 4 }, (_, i) =>
      session({
        id: `s${i}`,
        date: daysAgo(i * 7 + 1),
        entries: [entry('bench', 'Жим', 12, 60, 7), entry('curl', 'Подъём на бицепс', 1, 12, 10)],
      }),
    )

    const insights = coachInsights({
      history: trained,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      now: today,
    })
    const lagging = insights.find((item) => item.key === 'lagging-muscle')

    expect(lagging).toBeTruthy()
    expect(lagging.title).toContain('Бицепс')

    // Если норму не набирает никто — это не перекос, а просто мало тренировок.
    const rare = [session({ id: 's1', date: daysAgo(3), entries: [entry('curl', 'Подъём', 2, 12, 10)] })]
    const rareInsights = coachInsights({
      history: rare,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      now: today,
    })

    expect(keysOf(rareInsights)).not.toContain('lagging-muscle')
  })

  it('говорит о недоборе до отказа, когда отметок достаточно для вывода', () => {
    const easy = (i) => ({ exerciseId: `ex${i}`, exerciseName: `Упражнение ${i}`, sets: [{ weight: 60, reps: 8 }], rir: 3 })
    const history = [
      session({ id: 's1', date: daysAgo(2), entries: [easy(1), easy(2), easy(3)] }),
      session({ id: 's2', date: daysAgo(6), entries: [easy(4), easy(5), easy(6)] }),
    ]

    const insights = coachInsights({ history, workouts: [benchWorkout], level: 'Средний', now: today })
    const tooEasy = insights.find((item) => item.key === 'too-easy')

    expect(tooEasy).toBeTruthy()
    expect(tooEasy.text).toContain('100%')
  })

  it('на паре отметок вывода о недоборе не делает', () => {
    const easy = { exerciseId: 'bench', exerciseName: 'Жим', sets: [{ weight: 60, reps: 8 }], rir: 3 }
    const history = [session({ id: 's1', date: daysAgo(2), entries: [easy] })]

    const insights = coachInsights({ history, workouts: [benchWorkout], level: 'Средний', now: today })

    expect(keysOf(insights)).not.toContain('too-easy')
  })

  it('хвалит за свежий рекорд и молчит про старый', () => {
    const fresh = [session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим лёжа', 3, 60, 8)] })]
    const stale = [session({ id: 's1', date: daysAgo(12), entries: [entry('bench', 'Жим лёжа', 3, 60, 8)] })]

    const opts = { workouts: [benchWorkout], exerciseById: exercises, level: 'Средний', now: today }

    expect(keysOf(coachInsights({ ...opts, history: fresh }))).toContain('fresh-record')
    expect(keysOf(coachInsights({ ...opts, history: stale }))).not.toContain('fresh-record')
  })

  it('просевшую готовность ставит выше остальных советов — она про сегодня', () => {
    const history = [session({ id: 's1', date: daysAgo(3), entries: [entry('bench', 'Жим', 3, 60, 7)] })]
    const checkins = [{ id: 'c1', date: daysAgo(0), sleep: 1, energy: 1, soreness: 5 }]

    const insights = coachInsights({
      history,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      checkins,
      now: today,
    })

    expect(insights[0].key).toBe('readiness-low')
  })

  it('на хорошей готовности молчит', () => {
    const history = [session({ id: 's1', date: daysAgo(3), entries: [entry('bench', 'Жим', 3, 60, 7)] })]
    const checkins = [{ id: 'c1', date: daysAgo(0), sleep: 5, energy: 5, soreness: 1 }]

    const insights = coachInsights({
      history,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      checkins,
      now: today,
    })

    expect(keysOf(insights)).not.toContain('readiness-low')
  })

  it('замечает просевшее восстановление на дистанции, когда сегодня не отмечались', () => {
    const history = [session({ id: 's1', date: daysAgo(3), entries: [entry('bench', 'Жим', 3, 60, 7)] })]
    const checkins = [1, 2, 3].map((i) => ({
      id: `c${i}`,
      date: daysAgo(i),
      sleep: 1,
      energy: 2,
      soreness: 4,
    }))

    const insights = coachInsights({
      history,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      checkins,
      now: today,
    })

    expect(keysOf(insights)).toContain('recovery-debt')
  })

  it('поздравляет со взятой целью и молчит про далёкую', () => {
    const history = [session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим лёжа', 3, 100, 1)] })]
    const opts = { history, workouts: [benchWorkout], exerciseById: exercises, level: 'Средний', now: today }

    const taken = coachInsights({
      ...opts,
      goals: [{ id: 'g1', exerciseId: 'bench', exerciseName: 'Жим лёжа', targetWeight: 100, targetReps: 1, startScore: 80 }],
    })
    expect(keysOf(taken)).toContain('goal-reached')

    // До 200 кг ещё далеко — мозолить этим глаза каждый день незачем.
    const far = coachInsights({
      ...opts,
      goals: [{ id: 'g2', exerciseId: 'bench', exerciseName: 'Жим лёжа', targetWeight: 200, targetReps: 1, startScore: 80 }],
    })
    expect(keysOf(far)).not.toContain('goal-reached')
    expect(keysOf(far)).not.toContain('goal-close')
  })

  it('подсказывает, когда до цели осталось немного', () => {
    const history = [session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим лёжа', 3, 95, 1)] })]

    const insights = coachInsights({
      history,
      workouts: [benchWorkout],
      exerciseById: exercises,
      level: 'Средний',
      now: today,
      goals: [{ id: 'g1', exerciseId: 'bench', exerciseName: 'Жим лёжа', targetWeight: 100, targetReps: 1, startScore: 80 }],
    })
    const close = insights.find((item) => item.key === 'goal-close')

    expect(close).toBeTruthy()
    expect(close.title).toContain('Жим лёжа')
  })

  it('напоминает про уровень, пока он не указан', () => {
    const history = [session({ id: 's1', date: daysAgo(3), entries: [entry('bench', 'Жим', 3, 60, 7)] })]
    const opts = { history, workouts: [benchWorkout], exerciseById: exercises, now: today }

    expect(keysOf(coachInsights(opts))).toContain('no-level')
    expect(keysOf(coachInsights({ ...opts, level: 'Продвинутый' }))).not.toContain('no-level')
  })

  it('советует записывать еду только тем, кто ходит регулярно', () => {
    const opts = { workouts: [benchWorkout], exerciseById: exercises, level: 'Средний', now: today }

    const regular = [
      session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим', 3, 60, 7)] }),
      session({ id: 's2', date: daysAgo(5), entries: [entry('bench', 'Жим', 3, 60, 7)] }),
    ]
    expect(keysOf(coachInsights({ ...opts, history: regular }))).toContain('nutrition-gap')

    // Еда уже записана — совет не нужен.
    expect(
      keysOf(coachInsights({ ...opts, history: regular, foodLogs: [{ date: daysAgo(1) }] })),
    ).not.toContain('nutrition-gap')

    const rare = [session({ id: 's1', date: daysAgo(2), entries: [entry('bench', 'Жим', 3, 60, 7)] })]
    expect(keysOf(coachInsights({ ...opts, history: rare }))).not.toContain('nutrition-gap')
  })
})

describe('coachFacts', () => {
  it('складывает наблюдения в плоский список строк для модели', () => {
    const facts = coachFacts({
      insights: [{ key: 'x', tone: 'ok', title: 'Заголовок', text: 'Пояснение.' }],
      summary: { level: 4, title: 'Начало', xp: 1200 },
      streak: { current: 3, best: 9 },
      week: { done: 2, goal: 3 },
    })

    expect(facts).toEqual([
      'Уровень 4 («Начало»), 1200 XP всего.',
      'Серия: 3 дня подряд, лучшая за всё время — 9.',
      'На этой неделе 2 тренировки из 3 по цели.',
      'Заголовок. Пояснение.',
    ])
  })

  it('без данных отдаёт пустой список, а не строки с «undefined»', () => {
    expect(coachFacts()).toEqual([])
  })
})
