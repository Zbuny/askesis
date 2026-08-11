import { describe, it, expect } from 'vitest'
import { formatReps, programItems } from './programItems.js'

describe('formatReps', () => {
  it('показывает одно число, когда диапазона нет', () => {
    expect(formatReps({ targetReps: 10 })).toBe('10')
  })

  it('показывает диапазон', () => {
    expect(formatReps({ targetReps: 8, targetRepsMax: 10 })).toBe('8-10')
  })

  it('не рисует диапазон из одинаковых границ', () => {
    expect(formatReps({ targetReps: 8, targetRepsMax: 8 })).toBe('8')
  })

  it('трактует 0 повторов как «до отказа»', () => {
    expect(formatReps({ targetReps: 0 })).toBe('до отказа')
    expect(formatReps({})).toBe('до отказа')
  })
})

describe('programItems', () => {
  it('возвращает items, когда программа уже в новом формате', () => {
    const items = [{ exerciseId: 'a', targetSets: 4, targetReps: 8 }]
    expect(programItems({ items })).toBe(items)
  })

  it('достраивает старые программы из одних exerciseIds', () => {
    expect(programItems({ exerciseIds: ['a', 'b'] })).toEqual([
      { exerciseId: 'a', targetSets: 3, targetReps: 10 },
      { exerciseId: 'b', targetSets: 3, targetReps: 10 },
    ])
  })

  it('пустой items не заслоняет старый exerciseIds', () => {
    expect(programItems({ items: [], exerciseIds: ['a'] })).toEqual([
      { exerciseId: 'a', targetSets: 3, targetReps: 10 },
    ])
  })

  it('отдаёт пустой список для программы без упражнений', () => {
    expect(programItems({})).toEqual([])
  })
})
