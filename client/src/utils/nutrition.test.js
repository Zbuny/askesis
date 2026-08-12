import { describe, it, expect } from 'vitest'
import { activityFactor, basalMetabolicRate, dailyTargets, dayProgress, nutritionFacts } from './nutrition.js'

const person = { weight: 80, height: 180, age: 30 }

describe('basalMetabolicRate', () => {
  it('считает по Миффлину-Сан Жеору', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780
    expect(basalMetabolicRate({ ...person, sex: 'male' })).toBe(1780)
    expect(basalMetabolicRate({ ...person, sex: 'female' })).toBe(1614)
  })

  it('без пола берёт середину, а не считает человека мужчиной', () => {
    const neutral = basalMetabolicRate(person)

    expect(neutral).toBeLessThan(basalMetabolicRate({ ...person, sex: 'male' }))
    expect(neutral).toBeGreaterThan(basalMetabolicRate({ ...person, sex: 'female' }))
  })

  it('без данных и на явной ерунде ничего не выдумывает', () => {
    expect(basalMetabolicRate({ weight: 80 })).toBeNull()
    expect(basalMetabolicRate({ ...person, height: 1.8 })).toBeNull()
    expect(basalMetabolicRate({})).toBeNull()
  })
})

describe('activityFactor', () => {
  it('растёт с числом тренировок', () => {
    expect(activityFactor(0)).toBe(1.2)
    expect(activityFactor(3)).toBe(1.55)
    expect(activityFactor(6)).toBe(1.9)
  })

  it('не уходит за пределы недели', () => {
    expect(activityFactor(99)).toBe(activityFactor(7))
    expect(activityFactor('каждый день')).toBe(1.2)
  })
})

describe('dailyTargets', () => {
  it('складывает норму из обмена, активности и цели', () => {
    const target = dailyTargets({ ...person, sex: 'male', daysPerWeek: 3, goal: 'Поддерживать форму' })

    // 1780 × 1.55 = 2759 → округляем до десятков
    expect(target.calories).toBe(2760)
    expect(target.protein).toBe(128)
    expect(target.approximate).toBe(false)
  })

  it('на снижении веса режет калории и поднимает белок', () => {
    const cut = dailyTargets({ ...person, sex: 'male', daysPerWeek: 3, goal: 'Снизить вес' })
    const keep = dailyTargets({ ...person, sex: 'male', daysPerWeek: 3, goal: 'Поддерживать форму' })

    expect(cut.calories).toBeLessThan(keep.calories)
    expect(cut.protein).toBeGreaterThan(keep.protein)
  })

  it('на массе даёт профицит', () => {
    const bulk = dailyTargets({ ...person, sex: 'male', daysPerWeek: 3, goal: 'Набрать мышечную массу' })

    expect(bulk.calories).toBeGreaterThan(2760)
  })

  it('калории сходятся с суммой БЖУ', () => {
    const t = dailyTargets({ ...person, sex: 'male', daysPerWeek: 4, goal: 'Поддерживать форму' })
    const fromMacros = t.protein * 4 + t.fat * 9 + t.carbs * 4

    // Расхождение только от округления граммов — в пределах десятка калорий.
    expect(Math.abs(fromMacros - t.calories)).toBeLessThanOrEqual(10)
  })

  it('углеводы не уходят в минус при жёстком дефиците', () => {
    const t = dailyTargets({ weight: 120, height: 150, age: 60, sex: 'female', daysPerWeek: 0, goal: 'Снизить вес' })

    expect(t.carbs).toBeGreaterThanOrEqual(0)
  })

  it('без роста, веса или возраста норму не выдумывает', () => {
    expect(dailyTargets({ weight: 80, goal: 'Снизить вес' })).toBeNull()
    expect(dailyTargets()).toBeNull()
  })

  it('честно помечает норму приблизительной, если пол не указан', () => {
    expect(dailyTargets({ ...person, daysPerWeek: 3 }).approximate).toBe(true)
  })

  it('незнакомую цель считает как поддержание', () => {
    const unknown = dailyTargets({ ...person, sex: 'male', daysPerWeek: 3, goal: 'Стать космонавтом' })
    const keep = dailyTargets({ ...person, sex: 'male', daysPerWeek: 3, goal: 'Поддерживать форму' })

    expect(unknown.calories).toBe(keep.calories)
  })
})

describe('dayProgress', () => {
  const targets = { calories: 2000, protein: 150, fat: 60, carbs: 200 }

  it('показывает и остаток, и перебор', () => {
    const progress = dayProgress(targets, { calories: 2400, protein: 100, fat: 60, carbs: 150 })

    expect(progress.calories).toMatchObject({ eaten: 2400, over: 400, left: 0, percent: 120 })
    expect(progress.protein).toMatchObject({ eaten: 100, left: 50, over: 0, percent: 67 })
  })

  it('пустой день — это нули, а не ошибка', () => {
    expect(dayProgress(targets, {}).calories).toMatchObject({ eaten: 0, percent: 0, left: 2000 })
  })

  it('без нормы прогресса нет', () => {
    expect(dayProgress(null, { calories: 100 })).toBeNull()
  })
})

describe('nutritionFacts', () => {
  it('пересказывает норму и день строками для тренера', () => {
    const targets = dailyTargets({ ...person, sex: 'male', daysPerWeek: 3, goal: 'Снизить вес' })
    const facts = nutritionFacts(targets, dayProgress(targets, { calories: 1200, protein: 90 }))

    expect(facts[0]).toContain('Дневная норма')
    expect(facts.some((f) => f.startsWith('Белки: съедено 90 г'))).toBe(true)
    expect(facts.some((f) => f.includes('Пол не указан'))).toBe(false)
  })

  it('предупреждает о приблизительности, когда пол не указан', () => {
    const targets = dailyTargets({ ...person, daysPerWeek: 3 })

    expect(nutritionFacts(targets, dayProgress(targets, {})).some((f) => f.includes('Пол не указан'))).toBe(true)
  })

  it('без нормы молчит', () => {
    expect(nutritionFacts(null, null)).toEqual([])
  })
})
