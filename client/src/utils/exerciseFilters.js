import { exerciseName } from './translate.js'

export const emptyFilters = { search: '', muscleGroup: '', equipment: '', level: '', category: '' }

export function filterExercises(exercises, filters = emptyFilters) {
  const query = (filters.search || '').trim().toLowerCase()
  return exercises.filter((ex) => {
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
