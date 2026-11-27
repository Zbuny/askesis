import { describe, expect, it } from 'vitest'
import { dropIndex, edgeScrollSpeed, moveItem } from './reorder.js'

describe('moveItem', () => {
  it('переносит вниз и вверх', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('не трогает список без перемещения и зажимает цель в границы', () => {
    const list = ['a', 'b']
    expect(moveItem(list, 1, 1)).toBe(list)
    expect(moveItem(list, 0, 10)).toEqual(['b', 'a'])
    expect(moveItem(list, 1, -3)).toEqual(['b', 'a'])
  })
})

describe('dropIndex', () => {
  const middles = [50, 150, 250, 350]

  it('считает только другие пункты выше точки', () => {
    expect(dropIndex(middles, 0, 10)).toBe(0)
    expect(dropIndex(middles, 0, 200)).toBe(1)
    expect(dropIndex(middles, 0, 400)).toBe(3)
    expect(dropIndex(middles, 3, 100)).toBe(1)
  })
})

describe('edgeScrollSpeed', () => {
  it('крутит только у краёв экрана', () => {
    expect(edgeScrollSpeed(400, 800)).toBe(0)
    expect(edgeScrollSpeed(0, 800)).toBe(-18)
    expect(edgeScrollSpeed(36, 800)).toBe(-9)
    expect(edgeScrollSpeed(800, 800)).toBe(18)
    expect(edgeScrollSpeed(900, 800)).toBe(18)
  })
})
