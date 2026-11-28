import { describe, it, expect } from 'vitest'
import { EQUIPMENT_PRESETS, activePreset, matchesPreset, presetEquipment } from './equipmentPresets.js'

const gym = EQUIPMENT_PRESETS.find((p) => p.key === 'gym')
const bodyweight = EQUIPMENT_PRESETS.find((p) => p.key === 'bodyweight')

// То, что реально приходит из каталога упражнений.
const available = ['barbell', 'body only', 'cable', 'dumbbell', 'machine']

describe('presetEquipment', () => {
  it('берёт из набора только то, что есть в каталоге', () => {
    expect(presetEquipment(gym, available)).toEqual(['barbell', 'dumbbell', 'cable', 'machine', 'body only'])
  })

  it('на бедном каталоге не выдумывает инвентарь', () => {
    expect(presetEquipment(gym, ['body only'])).toEqual(['body only'])
    expect(presetEquipment(gym, [])).toEqual([])
  })
})

describe('matchesPreset', () => {
  it('не зависит от порядка отметок', () => {
    expect(matchesPreset(gym, ['machine', 'cable', 'body only', 'dumbbell', 'barbell'], available)).toBe(true)
  })

  it('неполный выбор набором не считается', () => {
    expect(matchesPreset(gym, ['barbell', 'dumbbell'], available)).toBe(false)
  })

  it('лишняя отметка сверх набора тоже не считается', () => {
    expect(matchesPreset(bodyweight, ['body only', 'barbell'], available)).toBe(false)
  })

  it('пустой выбор ничему не соответствует', () => {
    expect(matchesPreset(gym, [], available)).toBe(false)
    expect(activePreset([], available)).toBeNull()
  })
})

describe('activePreset', () => {
  it('узнаёт зал по полному набору', () => {
    expect(activePreset(presetEquipment(gym, available), available).key).toBe('gym')
  })

  it('узнаёт свой вес', () => {
    expect(activePreset(['body only'], available).key).toBe('bodyweight')
  })

  it('свой набор человека не выдаёт за готовый', () => {
    expect(activePreset(['barbell', 'body only'], available)).toBeNull()
  })
})
