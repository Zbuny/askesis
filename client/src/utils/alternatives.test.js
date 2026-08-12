import { describe, it, expect } from 'vitest'
import { findAlternatives } from './alternatives.js'

const bench = {
  id: 'bench',
  nameRu: 'Жим лёжа',
  muscleGroup: 'chest',
  equipment: 'barbell',
  level: 'intermediate',
  category: 'strength',
  secondaryMuscles: ['triceps', 'shoulders'],
}

const catalogue = [
  bench,
  { id: 'db-press', nameRu: 'Жим гантелей', muscleGroup: 'chest', equipment: 'dumbbell', level: 'intermediate', category: 'strength', secondaryMuscles: ['triceps', 'shoulders'] },
  { id: 'push-up', nameRu: 'Отжимания', muscleGroup: 'chest', equipment: 'body only', level: 'beginner', category: 'strength', secondaryMuscles: ['triceps'] },
  { id: 'fly', nameRu: 'Разводка', muscleGroup: 'chest', equipment: 'dumbbell', level: 'beginner', category: 'strength', secondaryMuscles: [] },
  { id: 'squat', nameRu: 'Присед', muscleGroup: 'quadriceps', equipment: 'barbell', level: 'intermediate', category: 'strength', secondaryMuscles: ['glutes'] },
  { id: 'planche', nameRu: 'Планш', muscleGroup: 'chest', equipment: 'body only', level: 'expert', category: 'strength', secondaryMuscles: ['shoulders'] },
]

const ids = (list) => list.map((ex) => ex.id)

describe('findAlternatives', () => {
  it('никогда не выходит за пределы той же группы мышц', () => {
    expect(ids(findAlternatives(bench, catalogue))).not.toContain('squat')
  })

  it('не предлагает само упражнение', () => {
    expect(ids(findAlternatives(bench, catalogue))).not.toContain('bench')
  })

  it('ставит выше то, что делит вспомогательные мышцы', () => {
    const [first] = findAlternatives(bench, catalogue)

    expect(first.id).toBe('db-press')
  })

  it('с заданным инвентарём предлагает только то, что человек может сделать', () => {
    const list = findAlternatives(bench, catalogue, { equipment: ['body only'] })

    expect(ids(list.slice(0, 2))).toEqual(['push-up', 'planche'])
  })

  it('не задвигает вперёд упражнение сложнее исходного', () => {
    const list = ids(findAlternatives(bench, catalogue, { equipment: ['body only'] }))

    expect(list.indexOf('push-up')).toBeLessThan(list.indexOf('planche'))
  })

  it('объясняет, почему это замена', () => {
    const [first] = findAlternatives(bench, catalogue, { equipment: ['dumbbell'] })

    expect(first.reason).toBe('Та же группа мышц, есть в вашем инвентаре')
  })

  it('ограничивает список', () => {
    expect(findAlternatives(bench, catalogue, { limit: 2 })).toHaveLength(2)
  })

  it('без группы мышц заменять нечем', () => {
    expect(findAlternatives({ id: 'x' }, catalogue)).toEqual([])
    expect(findAlternatives(null, catalogue)).toEqual([])
  })

  it('порядок не меняется между вызовами', () => {
    expect(ids(findAlternatives(bench, catalogue))).toEqual(ids(findAlternatives(bench, catalogue)))
  })
})
