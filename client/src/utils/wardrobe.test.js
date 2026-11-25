import { describe, it, expect } from 'vitest'
import { AVATAR_KEYS, avatarLook, defaultAvatar, nextUnlocks, normalizeAvatar, sameAvatar } from './wardrobe.js'

describe('normalizeAvatar', () => {
  it('пустой профиль получает образ по полу', () => {
    expect(normalizeAvatar(undefined).body).toBe('m')
    expect(normalizeAvatar(null, { sex: 'female' }).body).toBe('f')
  })

  it('всегда возвращает полный набор ключей', () => {
    const result = normalizeAvatar({ top: 'tank' })
    expect(Object.keys(result).sort()).toEqual([...AVATAR_KEYS].sort())
    expect(result.top).toBe('tank')
  })

  it('вещь выше уровня заменяется базовой', () => {
    expect(normalizeAvatar({ top: 'hoodie' }, { level: 2 }).top).toBe('tee')
    expect(normalizeAvatar({ top: 'hoodie' }, { level: 8 }).top).toBe('hoodie')
    expect(normalizeAvatar({ topColor: 'gold' }, { level: 9 }).topColor).toBe('stone')
    expect(normalizeAvatar({ head: 'laurel' }, { level: 30 }).head).toBe('laurel')
  })

  it('вещь не для этой фигуры заменяется', () => {
    expect(normalizeAvatar({ body: 'f', top: 'none' }).top).not.toBe('none')
    expect(normalizeAvatar({ body: 'm', top: 'bra' }).top).not.toBe('bra')
  })

  it('неизвестные значения и чужие ключи отбрасываются', () => {
    const result = normalizeAvatar({ top: 'cape', skin: 'green', hack: true })
    expect(result.top).toBe('tee')
    expect(result.skin).toBe('sand')
    expect(result).not.toHaveProperty('hack')
  })
})

describe('nextUnlocks', () => {
  it('показывает ближайшие вещи по возрастанию уровня', () => {
    const upcoming = nextUnlocks(1, 'm', 3)
    expect(upcoming).toHaveLength(3)
    expect(upcoming.map((item) => item.level)).toEqual([...upcoming.map((item) => item.level)].sort((a, b) => a - b))
    expect(upcoming.every((item) => item.level > 1)).toBe(true)
  })

  it('на максимуме открывать нечего', () => {
    expect(nextUnlocks(99)).toEqual([])
  })
})

describe('sameAvatar и avatarLook', () => {
  it('сравнивает по значимым полям', () => {
    const a = defaultAvatar()
    expect(sameAvatar(a, { ...a })).toBe(true)
    expect(sameAvatar(a, { ...a, top: 'tank' })).toBe(false)
  })

  it('переводит id цветов в hex для сцены', () => {
    const look = avatarLook(defaultAvatar())
    expect(look.skinHex).toMatch(/^#[0-9a-f]{6}$/i)
    expect(look.topHex).toMatch(/^#[0-9a-f]{6}$/i)
    expect(look.hairHex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
