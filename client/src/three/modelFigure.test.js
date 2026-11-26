import { describe, it, expect } from 'vitest'
import { UNTRAINED, influenceFor, isItemVisible } from './modelFigure.js'

const look = { top: 'tee', bottom: 'shorts', shoes: 'sneakers', head: 'none', hair: 'short', extra: 'none' }

describe('influenceFor', () => {
  it('рост 0 — нетренированное тело, 1 — предел', () => {
    expect(influenceFor(0)).toBeCloseTo(UNTRAINED)
    expect(influenceFor(1)).toBeCloseTo(1)
    expect(influenceFor(0.5)).toBeGreaterThan(0)
  })

  it('памп добавляет сверху и не выходит за разумное', () => {
    expect(influenceFor(1, 1)).toBeGreaterThan(1)
    expect(influenceFor(1, 5)).toBeCloseTo(influenceFor(1, 1))
    expect(influenceFor(-3)).toBeCloseTo(UNTRAINED)
  })
})

describe('isItemVisible', () => {
  it('показывает только выбранную вещь слота', () => {
    expect(isItemVisible('top_tee', look)).toBe(true)
    expect(isItemVisible('top_tank', look)).toBe(false)
    expect(isItemVisible('body', look)).toBe(true)
    expect(isItemVisible('eye_L', look)).toBe(true)
  })

  it('объёмная причёска прячется под кепку, хвост — нет', () => {
    expect(isItemVisible('hair_short', { ...look, head: 'cap' })).toBe(false)
    expect(isItemVisible('hair_ponytail', { ...look, hair: 'ponytail', head: 'cap' })).toBe(true)
    expect(isItemVisible('hair_short', { ...look, head: 'headband' })).toBe(true)
  })
})
