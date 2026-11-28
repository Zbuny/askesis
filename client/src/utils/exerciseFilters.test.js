import { describe, it, expect } from 'vitest'
import { emptyFilters, filterExercises, uniqueValues } from './exerciseFilters.js'

const library = [
  { id: '1', name: 'Bench Press', nameRu: 'Жим лёжа', muscleGroup: 'chest', equipment: 'barbell', level: 'intermediate', category: 'strength' },
  { id: '2', name: 'Push Up', nameRu: 'Отжимания', muscleGroup: 'chest', equipment: 'body only', level: 'beginner', category: 'strength' },
  { id: '3', name: 'Squat', nameRu: 'Приседания', muscleGroup: 'quadriceps', equipment: 'barbell', level: 'beginner', category: 'strength' },
]

describe('filterExercises', () => {
  it('без фильтров отдаёт всю библиотеку', () => {
    expect(filterExercises(library, emptyFilters)).toHaveLength(3)
    expect(filterExercises(library)).toHaveLength(3)
  })

  it('фильтрует по группе мышц и инвентарю одновременно', () => {
    const result = filterExercises(library, { ...emptyFilters, muscleGroup: 'chest', equipment: 'barbell' })
    expect(result.map((ex) => ex.id)).toEqual(['1'])
  })

  it('ищет по русскому названию', () => {
    expect(filterExercises(library, { ...emptyFilters, search: 'присед' }).map((ex) => ex.id)).toEqual(['3'])
  })

  it('ищет и по английскому — датасет пришёл на нём', () => {
    expect(filterExercises(library, { ...emptyFilters, search: 'bench' }).map((ex) => ex.id)).toEqual(['1'])
  })

  it('не зависит от регистра и лишних пробелов в запросе', () => {
    expect(filterExercises(library, { ...emptyFilters, search: '  ЖИМ ЛЁЖА ' }).map((ex) => ex.id)).toEqual(['1'])
  })

  it('ищет подстрокой, а не по началу слова — «жим» находит и «Отжимания»', () => {
    expect(filterExercises(library, { ...emptyFilters, search: 'жим' }).map((ex) => ex.id)).toEqual(['1', '2'])
  })

  it('возвращает пустой список, когда ничего не подошло', () => {
    expect(filterExercises(library, { ...emptyFilters, search: 'гребля' })).toEqual([])
  })

  it('не меняет исходный массив', () => {
    const copy = [...library]
    filterExercises(library, { ...emptyFilters, muscleGroup: 'chest' })
    expect(library).toEqual(copy)
  })
})

describe('uniqueValues', () => {
  it('собирает уникальные значения поля по алфавиту', () => {
    expect(uniqueValues(library, 'equipment')).toEqual(['barbell', 'body only'])
  })

  it('выбрасывает пустые значения — они бы дали пустой пункт в выпадашке', () => {
    expect(uniqueValues([{ level: 'beginner' }, { level: '' }, {}], 'level')).toEqual(['beginner'])
  })
})
