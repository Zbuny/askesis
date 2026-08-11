import { describe, it, expect } from 'vitest'
import {
  translateMuscle,
  translateEquipment,
  translateLevel,
  translateCategory,
  pluralRu,
  exerciseName,
  exerciseInstructions,
} from './translate.js'

describe('словари перевода', () => {
  it('переводят известные значения датасета', () => {
    expect(translateMuscle('chest')).toBe('Грудь')
    expect(translateEquipment('body only')).toBe('Свой вес')
    expect(translateLevel('expert')).toBe('Продвинутый')
    expect(translateCategory('strength')).toBe('Силовое')
  })

  it('не зависят от регистра', () => {
    expect(translateMuscle('CHEST')).toBe('Грудь')
    expect(translateEquipment('Body Only')).toBe('Свой вес')
  })

  it('оставляют незнакомое значение как есть, а не теряют его', () => {
    expect(translateMuscle('gills')).toBe('gills')
    expect(translateCategory('crossfit')).toBe('crossfit')
  })

  it('пропускают пустые значения', () => {
    expect(translateMuscle('')).toBe('')
    expect(translateMuscle(undefined)).toBeUndefined()
  })
})

describe('pluralRu', () => {
  it('выбирает форму по последней цифре', () => {
    expect(pluralRu(1, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировка')
    expect(pluralRu(3, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировки')
    expect(pluralRu(5, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировок')
    expect(pluralRu(21, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировка')
    expect(pluralRu(22, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировки')
  })

  it('обрабатывает исключение 11–14', () => {
    expect(pluralRu(11, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralRu(12, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralRu(14, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralRu(111, 'день', 'дня', 'дней')).toBe('дней')
  })

  it('для нуля берёт форму множественного числа', () => {
    expect(pluralRu(0, 'запись', 'записи', 'записей')).toBe('записей')
  })
})

describe('поля упражнения', () => {
  it('предпочитают русский перевод английскому оригиналу', () => {
    expect(exerciseName({ name: 'Bench Press', nameRu: 'Жим лёжа' })).toBe('Жим лёжа')
    expect(exerciseInstructions({ instructions: 'Lie down', instructionsRu: 'Лягте' })).toBe('Лягте')
  })

  it('откатываются на оригинал, если перевода нет', () => {
    expect(exerciseName({ name: 'Bench Press' })).toBe('Bench Press')
    expect(exerciseInstructions({ instructions: 'Lie down' })).toBe('Lie down')
  })

  it('отдают пустую строку вместо undefined — её сразу видно в разметке', () => {
    expect(exerciseName(null)).toBe('')
    expect(exerciseInstructions(undefined)).toBe('')
  })
})
