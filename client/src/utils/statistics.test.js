import { describe, it, expect } from 'vitest'
import {
  daySummary,
  filterByPeriod,
  kpis,
  muscleVolume,
  strengthSeries,
  trainedExercises,
} from './statistics.js'

const set = (weight, reps) => ({ weight, reps })
const entry = (exerciseId, sets, name) => ({ exerciseId, exerciseName: name || exerciseId, sets })
const session = (id, date, entries, durationMinutes) => ({
  id,
  date: `${date}T12:00:00`,
  workoutTitle: 'День груди',
  entries,
  ...(durationMinutes ? { durationMinutes } : {}),
})

const history = [
  session('s2', '2026-08-11', [entry('bench', [set(80, 8), set(80, 6)])], 60),
  session('s1', '2026-08-04', [entry('bench', [set(70, 8)]), entry('squat', [set(100, 5)])], 50),
]

describe('kpis', () => {
  it('считает тренировки, подходы, объём и часы', () => {
    const result = kpis(history)
    expect(result.sessions).toBe(2)
    expect(result.sets).toBe(4)
    expect(result.volume).toBe(80 * 8 + 80 * 6 + 70 * 8 + 100 * 5)
    expect(result.minutes).toBe(110)
    expect(result.avgMinutes).toBe(55)
  })

  it('тренировки без таймера не занижают среднюю длительность', () => {
    const mixed = [...history, session('s3', '2026-08-01', [entry('bench', [set(60, 8)])])]
    expect(kpis(mixed).avgMinutes).toBe(55)
  })

  it('пустая история даёт нули, а не деление на ноль', () => {
    const result = kpis([])
    expect(result.sessions).toBe(0)
    expect(result.avgMinutes).toBe(0)
    expect(result.volume).toBe(0)
  })
})

describe('filterByPeriod', () => {
  const now = new Date('2026-08-11T12:00:00')

  it('за месяц берёт только последние 30 дней', () => {
    const long = [...history, session('s0', '2026-01-01', [entry('bench', [set(60, 8)])])]
    expect(filterByPeriod(long, 'month', now)).toHaveLength(2)
  })

  it('за всё время не отсекает ничего', () => {
    const long = [...history, session('s0', '2020-01-01', [entry('bench', [set(60, 8)])])]
    expect(filterByPeriod(long, 'all', now)).toHaveLength(3)
  })

  it('неизвестный период ведёт себя как месяц, а не падает', () => {
    expect(filterByPeriod(history, 'nonsense', now)).toHaveLength(2)
  })
})

describe('muscleVolume', () => {
  const exerciseById = new Map([
    ['bench', { muscleGroup: 'chest' }],
    ['squat', { muscleGroup: 'quadriceps' }],
  ])

  it('складывает объём по группам и сортирует по убыванию', () => {
    const rows = muscleVolume(history, exerciseById)
    expect(rows[0].key).toBe('chest')
    expect(rows[0].volume).toBe(80 * 8 + 80 * 6 + 70 * 8)
    expect(rows[0].percent).toBe(100)
  })

  it('упражнения без группы в каталоге собираются отдельно, а не приписываются чужой', () => {
    const rows = muscleVolume(history, new Map())
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe('Без группы')
  })

  it('пустая история не даёт строк', () => {
    expect(muscleVolume([], exerciseById)).toEqual([])
  })
})

describe('strengthSeries', () => {
  it('берёт лучший подход тренировки и идёт по возрастанию даты', () => {
    const points = strengthSeries(history, 'bench')
    expect(points.map((p) => p.weight)).toEqual([70, 80])
    expect(points[1].oneRepMax).toBeGreaterThan(points[0].oneRepMax)
  })

  it('без упражнения ряд пустой', () => {
    expect(strengthSeries(history, null)).toEqual([])
    expect(strengthSeries(history, 'unknown')).toEqual([])
  })
})

describe('trainedExercises', () => {
  it('сортирует по числу тренировок', () => {
    expect(trainedExercises(history).map((e) => e.exerciseId)).toEqual(['bench', 'squat'])
  })
})

describe('daySummary', () => {
  it('собирает итог по конкретному дню', () => {
    const summary = daySummary(history, '2026-08-11')
    expect(summary.sets).toBe(2)
    expect(summary.volume).toBe(80 * 8 + 80 * 6)
    expect(summary.minutes).toBe(60)
    expect(summary.titles).toEqual(['День груди'])
  })

  it('в день без тренировок возвращает пусто', () => {
    expect(daySummary(history, '2026-08-10')).toBeNull()
  })

  it('две тренировки за день складываются в один итог', () => {
    const twice = [...history, session('s3', '2026-08-11', [entry('row', [set(50, 10)])], 30)]
    const summary = daySummary(twice, '2026-08-11')
    expect(summary.sessions).toHaveLength(2)
    expect(summary.minutes).toBe(90)
  })
})
