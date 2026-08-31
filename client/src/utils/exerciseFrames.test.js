import { describe, it, expect } from 'vitest'
import { exerciseAnimationUrl, exerciseFrames, hasExerciseMedia } from './exerciseFrames.js'

const BASE = 'https://cdn.example/exercises/Bench_Press/'

describe('exerciseFrames', () => {
  it('берёт оба кадра из imageUrls, когда они есть', () => {
    expect(exerciseFrames({ imageUrls: [`${BASE}0.jpg`, `${BASE}1.jpg`] }))
      .toEqual([`${BASE}0.jpg`, `${BASE}1.jpg`])
  })

  it('достраивает второй кадр старым записям с одним imageUrl', () => {
    expect(exerciseFrames({ imageUrl: `${BASE}0.jpg` }))
      .toEqual([`${BASE}0.jpg`, `${BASE}1.jpg`])
  })

  it('не выдумывает второй кадр, если имя не по шаблону', () => {
    expect(exerciseFrames({ imageUrl: `${BASE}cover.png` })).toEqual([`${BASE}cover.png`])
  })

  it('без картинок отдаёт пустой список', () => {
    expect(exerciseFrames({})).toEqual([])
    expect(exerciseFrames(null)).toEqual([])
  })
})

describe('exerciseAnimationUrl', () => {
  it('отдаёт ссылку на анимацию, когда она заполнена', () => {
    expect(exerciseAnimationUrl({ animationUrl: 'https://cdn.example/bench.gif' }))
      .toBe('https://cdn.example/bench.gif')
  })

  it('пробелы и пустая строка считаются отсутствием', () => {
    // В админке поле легко очистить не до конца — пробел не должен
    // подменять рабочую перелистовку кадров битой картинкой.
    expect(exerciseAnimationUrl({ animationUrl: '   ' })).toBeNull()
    expect(exerciseAnimationUrl({ animationUrl: '' })).toBeNull()
  })

  it('без поля и без упражнения отдаёт null', () => {
    expect(exerciseAnimationUrl({})).toBeNull()
    expect(exerciseAnimationUrl(null)).toBeNull()
  })

  it('не путается с кадрами: они остаются доступны рядом', () => {
    const ex = { animationUrl: 'a.gif', imageUrl: `${BASE}0.jpg` }

    expect(exerciseAnimationUrl(ex)).toBe('a.gif')
    expect(exerciseFrames(ex)).toHaveLength(2)
  })
})

describe('hasExerciseMedia', () => {
  it('видит упражнение с одной только анимацией', () => {
    // Раньше экраны спрашивали про imageUrl, и такое упражнение показывалось
    // бы вообще без картинки.
    expect(hasExerciseMedia({ animationUrl: 'a.gif' })).toBe(true)
  })

  it('видит упражнение с одними кадрами', () => {
    expect(hasExerciseMedia({ imageUrl: `${BASE}0.jpg` })).toBe(true)
  })

  it('на пустом упражнении отвечает нет', () => {
    expect(hasExerciseMedia({})).toBe(false)
    expect(hasExerciseMedia(null)).toBe(false)
    expect(hasExerciseMedia({ animationUrl: '  ' })).toBe(false)
  })
})
