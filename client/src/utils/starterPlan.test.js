import { describe, it, expect } from 'vitest'
import { buildStarterPlan, pickForMuscle } from './starterPlan.js'

// Каталог нарочно небогатый: программа должна собираться и из того, что есть.
const catalogue = [
  { id: 'bench', nameRu: 'Жим лёжа', muscleGroup: 'chest', equipment: 'barbell', level: 'intermediate', category: 'strength' },
  { id: 'push-up', nameRu: 'Отжимания', muscleGroup: 'chest', equipment: 'body only', level: 'beginner', category: 'strength' },
  { id: 'fly', nameRu: 'Разводка', muscleGroup: 'chest', equipment: 'dumbbell', level: 'beginner', category: 'strength' },
  { id: 'ohp', nameRu: 'Жим стоя', muscleGroup: 'shoulders', equipment: 'barbell', level: 'intermediate', category: 'strength' },
  { id: 'lateral', nameRu: 'Махи в стороны', muscleGroup: 'shoulders', equipment: 'dumbbell', level: 'beginner', category: 'strength' },
  { id: 'dip', nameRu: 'Отжимания на брусьях', muscleGroup: 'triceps', equipment: 'body only', level: 'intermediate', category: 'strength' },
  { id: 'pushdown', nameRu: 'Разгибания на блоке', muscleGroup: 'triceps', equipment: 'cable', level: 'beginner', category: 'strength' },
  { id: 'pullup', nameRu: 'Подтягивания', muscleGroup: 'lats', equipment: 'body only', level: 'intermediate', category: 'strength' },
  { id: 'row', nameRu: 'Тяга в наклоне', muscleGroup: 'middle back', equipment: 'barbell', level: 'intermediate', category: 'strength' },
  { id: 'curl', nameRu: 'Подъём на бицепс', muscleGroup: 'biceps', equipment: 'dumbbell', level: 'beginner', category: 'strength' },
  { id: 'squat', nameRu: 'Присед', muscleGroup: 'quadriceps', equipment: 'barbell', level: 'intermediate', category: 'strength' },
  { id: 'lunge', nameRu: 'Выпады', muscleGroup: 'quadriceps', equipment: 'body only', level: 'beginner', category: 'strength' },
  { id: 'rdl', nameRu: 'Румынская тяга', muscleGroup: 'hamstrings', equipment: 'barbell', level: 'intermediate', category: 'strength' },
  { id: 'hipthrust', nameRu: 'Ягодичный мост', muscleGroup: 'glutes', equipment: 'barbell', level: 'beginner', category: 'strength' },
  { id: 'plank', nameRu: 'Планка', muscleGroup: 'abdominals', equipment: 'body only', level: 'beginner', category: 'strength' },
  { id: 'crunch', nameRu: 'Скручивания', muscleGroup: 'abdominals', equipment: 'body only', level: 'beginner', category: 'strength' },
  // Тяговых в реальной библиотеке столько же, сколько жимовых. Без этой
  // пары «день спины» упирался бы в бедность фикстуры, а не в алгоритм.
  { id: 'latpulldown', nameRu: 'Тяга верхнего блока', muscleGroup: 'lats', equipment: 'cable', level: 'beginner', category: 'strength' },
  { id: 'seatedrow', nameRu: 'Тяга сидя', muscleGroup: 'middle back', equipment: 'cable', level: 'beginner', category: 'strength' },
  { id: 'hammer', nameRu: 'Молот', muscleGroup: 'biceps', equipment: 'dumbbell', level: 'beginner', category: 'strength' },
  { id: 'kb-swing', nameRu: 'Мах гирей', muscleGroup: 'glutes', equipment: 'kettlebells', level: 'beginner', category: 'strength' },
]

const allIds = (plan) => plan.workouts.flatMap((w) => w.items.map((i) => i.exerciseId))

describe('pickForMuscle', () => {
  it('выбирает упражнение ближе к уровню человека', () => {
    expect(pickForMuscle(catalogue, 'chest', { level: 'Начинающий' }).id).toBe('push-up')
    expect(pickForMuscle(catalogue, 'chest', { level: 'Продвинутый' }).id).toBe('bench')
  })

  it('не предлагает уже занятое упражнение', () => {
    const used = new Set(['push-up'])
    expect(pickForMuscle(catalogue, 'chest', { level: 'Начинающий', used }).id).not.toBe('push-up')
  })

  it('на пустой группе возвращает ничего, а не падает', () => {
    expect(pickForMuscle(catalogue, 'calves', { level: 'Средний' })).toBeUndefined()
  })
})

describe('buildStarterPlan', () => {
  it('собирает столько дней, сколько человек готов ходить', () => {
    expect(buildStarterPlan({ exercises: catalogue, daysPerWeek: 2 }).workouts).toHaveLength(2)
    expect(buildStarterPlan({ exercises: catalogue, daysPerWeek: 4 }).workouts).toHaveLength(4)
  })

  it('за пределами 2-6 дней сводит к ближайшему разумному', () => {
    expect(buildStarterPlan({ exercises: catalogue, daysPerWeek: 99 }).workouts).toHaveLength(6)
    expect(buildStarterPlan({ exercises: catalogue, daysPerWeek: 1 }).workouts).toHaveLength(2)
    expect(buildStarterPlan({ exercises: catalogue }).workouts).toHaveLength(3)
  })

  it('пока библиотеки хватает, упражнения между днями не повторяются', () => {
    const ids = allIds(buildStarterPlan({ exercises: catalogue, daysPerWeek: 3 }))

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('внутри дня упражнение не повторяется никогда, даже когда библиотека кончилась', () => {
    // Шесть дней на шестнадцати упражнениях — библиотека исчерпывается, и
    // повторы между днями неизбежны. Обещанные шесть дней важнее.
    const plan = buildStarterPlan({ exercises: catalogue, daysPerWeek: 6 })

    expect(plan.workouts).toHaveLength(6)
    plan.workouts.forEach((workout) => {
      const ids = workout.items.map((item) => item.exerciseId)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('ставит подходы и диапазон повторений из общей модели', () => {
    const [first] = buildStarterPlan({ exercises: catalogue, daysPerWeek: 3, level: 'Средний' }).workouts

    expect(first.items[0]).toMatchObject({ targetSets: 3, targetReps: 6, targetRepsMax: 8 })
  })

  it('новичку даёт более щадящий диапазон', () => {
    const [first] = buildStarterPlan({ exercises: catalogue, daysPerWeek: 3, level: 'Начинающий' }).workouts

    expect(first.items[0]).toMatchObject({ targetReps: 8, targetRepsMax: 15 })
  })

  it('учитывает инвентарь', () => {
    const plan = buildStarterPlan({ exercises: catalogue, daysPerWeek: 2, equipment: ['body only'] })
    const chosen = allIds(plan)

    expect(chosen.every((id) => catalogue.find((ex) => ex.id === id).equipment === 'body only')).toBe(true)
  })

  it('при слишком узком инвентаре не оставляет человека с огрызком', () => {
    // Под «kettlebells» в каталоге всего одно упражнение — программу из него
    // не собрать, поэтому возвращаемся ко всей библиотеке целиком.
    const plan = buildStarterPlan({ exercises: catalogue, daysPerWeek: 3, equipment: ['kettlebells'] })

    expect(plan.workouts.length).toBe(3)
    expect(allIds(plan).length).toBeGreaterThan(3)
  })

  it('одна и та же анкета даёт одну и ту же программу', () => {
    const args = { exercises: catalogue, daysPerWeek: 3, level: 'Средний', equipment: [] }

    expect(allIds(buildStarterPlan(args))).toEqual(allIds(buildStarterPlan(args)))
  })

  it('на пустом каталоге возвращает пустую программу, а не падает', () => {
    expect(buildStarterPlan({ exercises: [], daysPerWeek: 3 }).workouts).toEqual([])
  })

  it('объясняет, почему программа такая', () => {
    const plan = buildStarterPlan({ exercises: catalogue, daysPerWeek: 3, level: 'Средний' })

    expect(plan.summary).toContain('6-8 повторений')
    expect(plan.summary).not.toContain('Уровень не указан')
    expect(buildStarterPlan({ exercises: catalogue, daysPerWeek: 3 }).summary).toContain('Уровень не указан')
  })
})
