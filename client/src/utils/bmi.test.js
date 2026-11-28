import { describe, it, expect } from 'vitest'
import { calcBmi } from './bmi.js'

describe('calcBmi', () => {
  it('считает ИМТ и относит его к категории', () => {
    const result = calcBmi(70, 175)
    expect(result.value).toBe(22.9)
    expect(result.label).toBe('Норма')
    expect(result.tone).toBe('ok')
  })

  it('разбирает вес и рост, пришедшие строками из полей формы', () => {
    expect(calcBmi('70', '175').value).toBe(22.9)
  })

  it('различает все четыре категории', () => {
    expect(calcBmi(45, 175).label).toBe('Недостаток веса')
    expect(calcBmi(70, 175).label).toBe('Норма')
    expect(calcBmi(85, 175).label).toBe('Избыточный вес')
    expect(calcBmi(100, 175).label).toBe('Ожирение')
  })

  it('ставит границу 25 в «Избыточный вес», а не в «Норму»', () => {
    // ровно 25.0 при росте 200 см
    expect(calcBmi(100, 200).value).toBe(25)
    expect(calcBmi(100, 200).label).toBe('Избыточный вес')
  })

  it('возвращает null, когда данных нет', () => {
    expect(calcBmi(null, 175)).toBeNull()
    expect(calcBmi(70, null)).toBeNull()
    expect(calcBmi(0, 0)).toBeNull()
  })

  it('отсекает рост в метрах и другие явные опечатки', () => {
    expect(calcBmi(70, 1.75)).toBeNull()
    expect(calcBmi(70, 300)).toBeNull()
    expect(calcBmi(5, 175)).toBeNull()
    expect(calcBmi(500, 175)).toBeNull()
  })

  it('держит позицию на шкале в пределах 0–100', () => {
    expect(calcBmi(20, 260).percent).toBe(0)
    expect(calcBmi(400, 130).percent).toBe(100)
  })
})
