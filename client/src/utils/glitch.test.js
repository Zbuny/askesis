import { describe, it, expect } from 'vitest'
import { scrambleDigits, hasDigits, nextDelay } from './glitch.js'

describe('scrambleDigits', () => {
  const zero = () => 0

  it('в конце возвращает исходную строку', () => {
    expect(scrambleDigits('1 240 / 2 000 XP', 1, zero)).toBe('1 240 / 2 000 XP')
  })

  it('подменяет только цифры и не меняет длину', () => {
    const out = scrambleDigits('Уровень 12', 0, () => 0.99)
    expect(out).toBe('Уровень 99')
    expect(out.length).toBe('Уровень 12'.length)
  })

  it('цифры встают на место слева направо', () => {
    expect(scrambleDigits('1234', 0.5, zero)).toBe('1200')
  })

  it('строку без цифр не трогает', () => {
    expect(scrambleDigits('—', 0.2, zero)).toBe('—')
  })
})

describe('hasDigits', () => {
  it('находит цифры', () => {
    expect(hasDigits('7 дней')).toBe(true)
    expect(hasDigits('—')).toBe(false)
    expect(hasDigits(null)).toBe(false)
  })
})

describe('nextDelay', () => {
  it('держится в границах', () => {
    expect(nextDelay(4000, 8000, () => 0)).toBe(4000)
    expect(nextDelay(4000, 8000, () => 1)).toBe(8000)
  })
})
