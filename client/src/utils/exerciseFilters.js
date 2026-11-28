import { exerciseName } from './translate.js'
import { BODY_PARTS } from './muscleGroups.js'

// zone — раздел по части тела («Спина»), muscleGroup — одна группа внутри
// него («Широчайшие»).
// Взаимоисключающи: выбор одного снимает другой, иначе получались бы
// невозможные сочетания вроде «Ноги + Трицепс», дающие пустой список.
export const emptyFilters = { search: '', zone: '', muscleGroup: '', equipment: '', level: '', category: '' }

export function filterExercises(exercises, filters = emptyFilters) {
  const query = (filters.search || '').trim().toLowerCase()
  const zone = filters.zone ? BODY_PARTS.find((p) => p.key === filters.zone) : null

  return exercises.filter((ex) => {
    if (zone && !zone.muscles.includes(ex.muscleGroup)) return false
    if (filters.muscleGroup && ex.muscleGroup !== filters.muscleGroup) return false
    if (filters.equipment && ex.equipment !== filters.equipment) return false
    if (filters.level && ex.level !== filters.level) return false
    if (filters.category && ex.category !== filters.category) return false
    if (!query) return true
    return (
      exerciseName(ex).toLowerCase().includes(query) ||
      (ex.name || '').toLowerCase().includes(query)
    )
  })
}

export function uniqueValues(exercises, field) {
  return [...new Set(exercises.map((ex) => ex[field]).filter(Boolean))].sort()
}
