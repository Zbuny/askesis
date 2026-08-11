import { describe, it, expect } from 'vitest'
import {
  classifyReps,
  effectiveSets,
  estimateOneRepMax,
  failureReachability,
  isExperienced,
  recommendedReps,
  setEffectiveness,
  setsForSameEffect,
  weightForReps,
} from './repRanges.js'

describe('classifyReps', () => {
  it('разводит повторы по зонам', () => {
    expect(classifyReps(3).key).toBe('strength')
    expect(classifyReps(7).key).toBe('strength-size')
    expect(classifyReps(12).key).toBe('hypertrophy')
    expect(classifyReps(20).key).toBe('endurance')
    expect(classifyReps(40).key).toBe('out-of-range')
  })

  it('ставит границы зон по верхнему числу диапазона', () => {
    expect(classifyReps(5).key).toBe('strength')
    expect(classifyReps(6).key).toBe('strength-size')
    expect(classifyReps(8).key).toBe('strength-size')
    expect(classifyReps(9).key).toBe('hypertrophy')
    expect(classifyReps(15).key).toBe('hypertrophy')
    expect(classifyReps(16).key).toBe('endurance')
    expect(classifyReps(30).key).toBe('endurance')
    expect(classifyReps(31).key).toBe('out-of-range')
  })

  it('возвращает null, когда повторов нет', () => {
    expect(classifyReps(0)).toBeNull()
    expect(classifyReps(null)).toBeNull()
    expect(classifyReps('')).toBeNull()
  })
})

describe('failureReachability', () => {
  it('до 15 повторений дойти до отказа мешает только желание', () => {
    expect(failureReachability(6)).toBe(1)
    expect(failureReachability(15)).toBe(1)
  })

  it('в многоповторке падает и на 30 доходит до 0.8', () => {
    expect(failureReachability(20)).toBeCloseTo(0.933, 3)
    expect(failureReachability(30)).toBeCloseTo(0.8, 3)
  })

  it('за окном роста подход почти не доводится до отказа', () => {
    expect(failureReachability(50)).toBe(0.55)
  })
})

describe('setEffectiveness', () => {
  it('подход на 8-15 повторениях считается эталонным', () => {
    expect(setEffectiveness(10)).toBe(1)
    expect(setEffectiveness(15)).toBe(1)
  })

  it('на тройке подход даёт три стимулирующих повторения из пяти', () => {
    expect(setEffectiveness(3)).toBeCloseTo(0.6, 5)
  })

  it('в многоповторке стимул полный, но отказ недостижим', () => {
    expect(setEffectiveness(30)).toBeCloseTo(0.8, 5)
  })
})

describe('effectiveSets', () => {
  it('приводит подходы к эталонным', () => {
    expect(effectiveSets(4, 3)).toBe(2.4)
    expect(effectiveSets(3, 10)).toBe(3)
  })

  it('возвращает ноль на пустых данных', () => {
    expect(effectiveSets(0, 10)).toBe(0)
    expect(effectiveSets(3, 0)).toBe(0)
  })
})

describe('setsForSameEffect', () => {
  // Приписка из ролика: чтобы получить эффект 3 подходов по 8-12, на тройках
  // подходов нужно заметно больше.
  it('пересчитывает 3×10 в пять подходов по 3 повторения', () => {
    expect(setsForSameEffect(3)).toBe(5)
  })

  it('внутри рабочего диапазона ничего добавлять не нужно', () => {
    expect(setsForSameEffect(8)).toBe(3)
    expect(setsForSameEffect(12)).toBe(3)
  })

  it('за многоповторку и за окном роста просит добавить подходы', () => {
    expect(setsForSameEffect(30)).toBe(4)
    expect(setsForSameEffect(40)).toBe(6)
  })

  it('не уходит в абсурд на единичных повторениях', () => {
    expect(setsForSameEffect(1)).toBe(12)
  })
})

describe('recommendedReps', () => {
  it('всем с опытом советует 6-8 повторений', () => {
    expect(recommendedReps('Средний')).toMatchObject({ min: 6, max: 8 })
    expect(recommendedReps('Продвинутый')).toMatchObject({ min: 6, max: 8 })
    // Уровень нигде не сохраняется, поэтому по умолчанию считаем, что опыт есть.
    expect(recommendedReps()).toMatchObject({ min: 6, max: 8 })
  })

  it('новичку оставляет 8-15', () => {
    expect(recommendedReps('Начинающий')).toMatchObject({ min: 8, max: 15 })
    expect(recommendedReps('beginner')).toMatchObject({ min: 8, max: 15 })
  })

  it('не зависит от регистра и пробелов в названии уровня', () => {
    expect(isExperienced(' начинающий ')).toBe(false)
    expect(isExperienced('ПРОДВИНУТЫЙ')).toBe(true)
  })

  it('объясняет выбор диапазона', () => {
    expect(recommendedReps('Средний').why).toMatch(/силов/i)
  })
})

describe('оценка веса', () => {
  it('считает разовый максимум по формуле Эпли', () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7)
    expect(estimateOneRepMax(100, 1)).toBe(103.3)
  })

  it('не оценивает максимум по многоповторным подходам', () => {
    expect(estimateOneRepMax(60, 20)).toBeNull()
    expect(estimateOneRepMax(0, 5)).toBeNull()
  })

  it('подбирает рабочий вес под диапазон и округляет до блинов', () => {
    expect(weightForReps(120, 8)).toBe(95)
    expect(weightForReps(120, 8, 5)).toBe(95)
    expect(weightForReps(116.7, 5)).toBe(100)
  })

  it('возвращается к исходному весу через прямой и обратный расчёт', () => {
    const oneRm = estimateOneRepMax(80, 6)
    expect(weightForReps(oneRm, 6)).toBe(80)
  })
})
