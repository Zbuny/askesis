import { describe, it, expect } from 'vitest'
import { analyzeWorkout, itemReps } from './workoutAnalysis.js'

const exercises = new Map([
  ['bench', { id: 'bench', nameRu: 'Жим лёжа', muscleGroup: 'chest' }],
  ['fly', { id: 'fly', nameRu: 'Разведение гантелей', muscleGroup: 'chest' }],
  ['row', { id: 'row', nameRu: 'Тяга в наклоне', muscleGroup: 'middle back' }],
])

const item = (exerciseId, targetSets, targetReps, targetRepsMax) => ({
  exerciseId,
  targetSets,
  targetReps,
  ...(targetRepsMax ? { targetRepsMax } : {}),
})

describe('itemReps', () => {
  it('берёт середину диапазона повторов', () => {
    expect(itemReps({ targetReps: 8, targetRepsMax: 12 })).toBe(10)
  })

  it('обходится одним числом, когда верхней границы нет', () => {
    expect(itemReps({ targetReps: 8 })).toBe(8)
    expect(itemReps({ targetReps: 8, targetRepsMax: 8 })).toBe(8)
  })

  it('считает «до отказа» отсутствием числа', () => {
    expect(itemReps({ targetReps: 0 })).toBe(0)
    expect(itemReps({})).toBe(0)
  })
})

describe('analyzeWorkout', () => {
  it('складывает подходы по группам мышц и переводит их в эталонные', () => {
    const result = analyzeWorkout([item('bench', 4, 10), item('row', 3, 8)], exercises)

    expect(result.totalSets).toBe(7)
    expect(result.totalEffective).toBe(7)
    expect(result.muscles).toEqual([
      expect.objectContaining({ key: 'chest', label: 'Грудь', sets: 4 }),
      expect.objectContaining({ key: 'middle back', label: 'Средняя часть спины', sets: 3 }),
    ])
  })

  it('дисконтирует подходы на малых повторениях', () => {
    const result = analyzeWorkout([item('bench', 4, 3)], exercises)

    expect(result.totalSets).toBe(4)
    expect(result.totalEffective).toBe(2.4)
  })

  it('считает долю подходов по зонам', () => {
    const result = analyzeWorkout([item('bench', 3, 10), item('row', 1, 20)], exercises)

    expect(result.zones).toEqual([
      expect.objectContaining({ key: 'hypertrophy', sets: 3, percent: 75 }),
      expect.objectContaining({ key: 'endurance', sets: 1, percent: 25 }),
    ])
  })

  it('на малых повторениях просит добавить подходы', () => {
    const result = analyzeWorkout([item('bench', 3, 3)], exercises)

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].tone).toBe('warn')
    expect(result.notes[0].text).toContain('5 подходов')
  })

  it('молчит про малые повторения, если подходов уже достаточно', () => {
    const result = analyzeWorkout([item('bench', 5, 3)], exercises)

    expect(result.notes.map((n) => n.tone)).toEqual(['ok'])
  })

  it('помечает выход за окно роста', () => {
    const result = analyzeWorkout([item('bench', 3, 40)], exercises)

    expect(result.notes[0].tone).toBe('high')
    expect(result.notes[0].text).toContain('Жим лёжа')
  })

  it('ловит перебор подходов на одну группу за тренировку', () => {
    const result = analyzeWorkout([item('bench', 7, 10), item('fly', 7, 10)], exercises)

    const overload = result.notes.find((note) => note.text.startsWith('Грудь'))
    expect(overload.tone).toBe('warn')
    expect(result.muscles[0].overloaded).toBe(true)
  })

  it('подтверждает удачную тренировку одной подсказкой', () => {
    const result = analyzeWorkout([item('bench', 4, 8, 12), item('row', 3, 10)], exercises)

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].tone).toBe('ok')
  })

  it('не падает на пустом списке и на неизвестных упражнениях', () => {
    expect(analyzeWorkout([], exercises).totalSets).toBe(0)
    expect(analyzeWorkout([]).notes).toEqual([])

    const unknown = analyzeWorkout([{ exerciseId: 'ghost', exerciseName: 'Что-то', targetSets: 3, targetReps: 10 }])
    expect(unknown.muscles[0].label).toBe('Без группы')
  })

  it('пропускает упражнения без подходов или повторов', () => {
    const result = analyzeWorkout([item('bench', 0, 10), item('row', 3, 0)], exercises)

    expect(result.totalSets).toBe(0)
    expect(result.muscles).toEqual([])
  })
})
