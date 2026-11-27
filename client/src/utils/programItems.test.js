import { describe, it, expect } from 'vitest'
import { countFromInput, editItemField, formatReps, normalizePlanItems, programItems } from './programItems.js'

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

describe('countFromInput', () => {
  it('оставляет пустое поле пустым, а не нулём', () => {
    expect(countFromInput('')).toBe('')
    expect(countFromInput('  ')).toBe('')
    expect(countFromInput(undefined)).toBe('')
  })

  it('превращает введённое в число, включая ноль', () => {
    expect(countFromInput('12')).toBe(12)
    expect(countFromInput('0')).toBe(0)
    expect(countFromInput('05')).toBe(5)
  })
})

describe('editItemField', () => {
  it('позволяет стереть поле целиком', () => {
    expect(editItemField({ targetSets: 3 }, 'targetSets', '').targetSets).toBe('')
  })

  it('убирает устаревшую верхнюю границу при смене повторов', () => {
    const next = editItemField({ targetReps: 8, targetRepsMax: 10 }, 'targetReps', '12')
    expect(next).toEqual({ targetReps: 12 })
  })

  it('не трогает диапазон при смене подходов', () => {
    const next = editItemField({ targetSets: 3, targetReps: 8, targetRepsMax: 10 }, 'targetSets', '4')
    expect(next).toEqual({ targetSets: 4, targetReps: 8, targetRepsMax: 10 })
  })
})

describe('normalizePlanItems', () => {
  const item = (patch) => ({ exerciseId: 'a', exerciseName: 'Жим', targetSets: 3, targetReps: 10, ...patch })

  it('приводит строки к числам', () => {
    expect(normalizePlanItems([item({ targetSets: '4', targetReps: '8' })]).items[0]).toMatchObject({
      targetSets: 4,
      targetReps: 8,
    })
  })

  it('принимает 0 повторов как «до отказа»', () => {
    const { items, error } = normalizePlanItems([item({ targetReps: 0, targetRepsMax: 12 })])
    expect(error).toBeUndefined()
    expect(items[0].targetReps).toBe(0)
    expect(items[0]).not.toHaveProperty('targetRepsMax')
  })

  it('не пропускает пустые и нулевые подходы', () => {
    expect(normalizePlanItems([item({ targetSets: '' })]).error).toMatch(/Жим: подходов/)
    expect(normalizePlanItems([item({ targetSets: 0 })]).error).toMatch(/подходов/)
    expect(normalizePlanItems([item({ targetSets: 21 })]).error).toMatch(/подходов/)
  })

  it('не пропускает пустые, дробные и отрицательные повторы', () => {
    expect(normalizePlanItems([item({ targetReps: '' })]).error).toMatch(/повторов/)
    expect(normalizePlanItems([item({ targetReps: 2.5 })]).error).toMatch(/повторов/)
    expect(normalizePlanItems([item({ targetReps: -1 })]).error).toMatch(/повторов/)
  })

  it('сохраняет только осмысленный диапазон', () => {
    expect(normalizePlanItems([item({ targetReps: 8, targetRepsMax: 10 })]).items[0].targetRepsMax).toBe(10)
    expect(normalizePlanItems([item({ targetReps: 10, targetRepsMax: 8 })]).items[0]).not.toHaveProperty('targetRepsMax')
  })

  it('называет упражнение через переданную функцию', () => {
    const { error } = normalizePlanItems([{ exerciseId: 'x', targetSets: 0, targetReps: 5 }], () => 'Тяга')
    expect(error).toMatch(/^Тяга:/)
  })
})
