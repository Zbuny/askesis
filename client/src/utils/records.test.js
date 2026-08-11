import { describe, it, expect } from 'vitest'
import { personalRecords, recordGain, recordList, recordsBySession } from './records.js'

const set = (weight, reps) => ({ weight, reps })
const entry = (exerciseId, sets) => ({ exerciseId, exerciseName: exerciseId, sets })
const session = (id, date, entries) => ({ id, date: `${date}T12:00:00`, entries })

describe('personalRecords', () => {
  it('запоминает лучший подход по упражнению', () => {
    const history = [
      session('s2', '2026-08-11', [entry('bench', [set(80, 8)])]),
      session('s1', '2026-08-04', [entry('bench', [set(70, 8)])]),
    ]
    const record = personalRecords(history).get('bench')
    expect(record.weight).toBe(80)
    expect(record.reps).toBe(8)
    expect(record.previous.weight).toBe(70)
  })

  it('сравнивает по оценке разового максимума, а не по одному весу', () => {
    // 100×1 и 90×5: по весу выигрывает первый, по реальной силе — второй.
    const history = [
      session('s1', '2026-08-04', [entry('bench', [set(100, 1)])]),
      session('s2', '2026-08-11', [entry('bench', [set(90, 5)])]),
    ]
    const record = personalRecords(history).get('bench')
    expect(record.weight).toBe(90)
    expect(record.reps).toBe(5)
  })

  it('порядок истории не влияет на результат', () => {
    const older = session('s1', '2026-08-04', [entry('bench', [set(70, 8)])])
    const newer = session('s2', '2026-08-11', [entry('bench', [set(80, 8)])])
    const forward = personalRecords([older, newer]).get('bench')
    const backward = personalRecords([newer, older]).get('bench')
    expect(forward.weight).toBe(backward.weight)
    expect(forward.previous.weight).toBe(backward.previous.weight)
  })

  it('у первого рекорда предыдущего нет', () => {
    const history = [session('s1', '2026-08-11', [entry('bench', [set(60, 8)])])]
    expect(personalRecords(history).get('bench').previous).toBeNull()
  })

  it('подходы без веса или повторов не считаются рекордом', () => {
    const history = [session('s1', '2026-08-11', [entry('bench', [set(0, 0), set(0, 12)])])]
    expect(personalRecords(history).has('bench')).toBe(false)
  })

  it('читает и старый формат записи, где подходы не списком', () => {
    const history = [{ id: 's1', date: '2026-08-11T12:00:00', entries: [{ exerciseId: 'bench', weight: 75, reps: 6 }] }]
    expect(personalRecords(history).get('bench').weight).toBe(75)
  })

  it('пустая история не даёт рекордов', () => {
    expect(personalRecords([]).size).toBe(0)
  })
})

describe('recordsBySession', () => {
  it('считает, сколько рекордов принесла каждая тренировка', () => {
    const history = [
      session('s1', '2026-08-04', [entry('bench', [set(70, 8)]), entry('squat', [set(100, 5)])]),
      session('s2', '2026-08-11', [entry('bench', [set(80, 8)])]),
    ]
    const counts = recordsBySession(history)
    // Рекорд засчитывается там, где он был установлен в последний раз.
    expect(counts.get('s2')).toBe(1)
    expect(counts.get('s1')).toBe(1)
  })

  it('повторение прежнего веса рекордом не считается', () => {
    const history = [
      session('s1', '2026-08-04', [entry('bench', [set(80, 8)])]),
      session('s2', '2026-08-11', [entry('bench', [set(80, 8)])]),
    ]
    expect(recordsBySession(history).get('s2')).toBeUndefined()
  })
})

describe('recordGain и recordList', () => {
  it('показывает прибавку к прошлому рекорду', () => {
    const record = { weight: 80, previous: { weight: 75 } }
    expect(recordGain(record)).toBe(5)
  })

  it('без прошлого рекорда прибавки нет', () => {
    expect(recordGain({ weight: 80, previous: null })).toBeNull()
  })

  it('список отсортирован от свежих рекордов к старым', () => {
    const history = [
      session('s1', '2026-08-04', [entry('squat', [set(100, 5)])]),
      session('s2', '2026-08-11', [entry('bench', [set(80, 8)])]),
    ]
    expect(recordList(history).map((r) => r.exerciseId)).toEqual(['bench', 'squat'])
  })
})
