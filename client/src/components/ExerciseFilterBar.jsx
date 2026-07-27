import { translateCategory, translateEquipment, translateLevel, translateMuscle } from '../utils/translate.js'
import { uniqueValues } from '../utils/exerciseFilters.js'

export default function ExerciseFilterBar({ exercises, filters, onChange, showSearch = true }) {
  function set(field, value) {
    onChange({ ...filters, [field]: value })
  }

  return (
    <div className="filter-bar">
      {showSearch && (
        <input
          className="search-input filter-bar__search"
          placeholder="Поиск по названию или группе мышц..."
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      )}
      <select value={filters.muscleGroup} onChange={(e) => set('muscleGroup', e.target.value)}>
        <option value="">Все группы мышц</option>
        {uniqueValues(exercises, 'muscleGroup').map((v) => (
          <option key={v} value={v}>{translateMuscle(v)}</option>
        ))}
      </select>
      <select value={filters.equipment} onChange={(e) => set('equipment', e.target.value)}>
        <option value="">Весь инвентарь</option>
        {uniqueValues(exercises, 'equipment').map((v) => (
          <option key={v} value={v}>{translateEquipment(v)}</option>
        ))}
      </select>
      <select value={filters.level} onChange={(e) => set('level', e.target.value)}>
        <option value="">Любой уровень</option>
        {uniqueValues(exercises, 'level').map((v) => (
          <option key={v} value={v}>{translateLevel(v)}</option>
        ))}
      </select>
      <select value={filters.category} onChange={(e) => set('category', e.target.value)}>
        <option value="">Любая категория</option>
        {uniqueValues(exercises, 'category').map((v) => (
          <option key={v} value={v}>{translateCategory(v)}</option>
        ))}
      </select>
    </div>
  )
}
