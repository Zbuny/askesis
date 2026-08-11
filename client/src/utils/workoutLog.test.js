import { describe, it, expect } from 'vitest'
import { entrySets, entryVolume, entryTopWeight, sessionVolume, formatEntry } from './workoutLog.js'

// Главное, что здесь проверяется, — что старые записи из Firestore (одна пара
// «вес × повторы» вместо массива подходов) по-прежнему читаются. Мигрировать
// их некому: Cloud Functions на Spark-плане нет.
describe('entrySets', () => {
  it('возвращает массив подходов как есть', () => {
    const sets = [{ weight: 60, reps: 8 }]
    expect(entrySets({ sets })).toBe(sets)
  })

  it('оборачивает запись старого формата в один подход', () => {
    expect(entrySets({ weight: 50, reps: 10 })).toEqual([{ weight: 50, reps: 10 }])
  })

  it('понимает старую запись даже с нулевым весом — это упражнение со своим весом', () => {
    expect(entrySets({ weight: 0, reps: 12 })).toEqual([{ weight: 0, reps: 12 }])
  })

  it('отдаёт пустой список для пустых и битых записей', () => {
    expect(entrySets(null)).toEqual([])
    expect(entrySets({})).toEqual([])
  })
})

describe('entryVolume', () => {
  it('суммирует вес × повторы по всем подходам', () => {
    expect(entryVolume({ sets: [{ weight: 60, reps: 8 }, { weight: 70, reps: 5 }] })).toBe(830)
  })

  it('считает нулём подходы без веса', () => {
    expect(entryVolume({ sets: [{ weight: 0, reps: 20 }] })).toBe(0)
  })

  it('не падает на нечисловых значениях', () => {
    expect(entryVolume({ sets: [{ weight: 'много', reps: 8 }] })).toBe(0)
  })
})

describe('entryTopWeight', () => {
  it('берёт самый тяжёлый подход, а не последний', () => {
    expect(entryTopWeight({ sets: [{ weight: 60, reps: 8 }, { weight: 80, reps: 3 }, { weight: 70, reps: 5 }] })).toBe(80)
  })

  it('возвращает 0, когда подходов нет', () => {
    expect(entryTopWeight({})).toBe(0)
  })
})

describe('sessionVolume', () => {
  it('складывает объём по всем упражнениям тренировки', () => {
    const session = {
      entries: [
        { sets: [{ weight: 60, reps: 10 }] },
        { weight: 40, reps: 10 },
      ],
    }
    expect(sessionVolume(session)).toBe(1000)
  })

  it('не падает на тренировке без записей', () => {
    expect(sessionVolume(undefined)).toBe(0)
    expect(sessionVolume({})).toBe(0)
  })
})

describe('formatEntry', () => {
  it('схлопывает одинаковые подходы', () => {
    const sets = [
      { weight: 60, reps: 8 },
      { weight: 60, reps: 8 },
      { weight: 60, reps: 8 },
    ]
    expect(formatEntry({ sets })).toBe('3×8 по 60 кг')
  })

  it('перечисляет разные подходы по отдельности', () => {
    expect(formatEntry({ sets: [{ weight: 60, reps: 8 }, { weight: 70, reps: 5 }] })).toBe('60×8, 70×5')
  })

  it('единственный подход не превращает в «1×...»', () => {
    expect(formatEntry({ sets: [{ weight: 60, reps: 8 }] })).toBe('60×8')
  })

  it('показывает прочерк вместо пустоты', () => {
    expect(formatEntry({})).toBe('—')
  })
})
