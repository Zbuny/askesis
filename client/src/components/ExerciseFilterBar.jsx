import { translateCategory, translateEquipment, translateLevel, translateMuscle } from '../utils/translate.js'
import { uniqueValues } from '../utils/exerciseFilters.js'
import { bodyPartSections } from '../utils/muscleGroups.js'

// Фильтры библиотеки. Главный — часть тела: 17 групп мышц плоским списком
// человек не разбирает. Внутри раздела мышцы показываются карточками с
// картинкой: названия вроде «абдукторы» или «трапеции» половине читателей
// ничего не говорят, а по кадру упражнения видно сразу.

export default function ExerciseFilterBar({ exercises, filters, onChange, total }) {
  const sections = bodyPartSections(exercises)
  const active = sections.find((s) => s.key === filters.zone) || null
  // Без выбранного раздела показываем все — это заодно визуальный указатель
  // по библиотеке, а не только фильтр.
  const shown = active ? [active] : sections

  function set(patch) {
    onChange({ ...filters, ...patch })
  }

  return (
    <div className="filters">
      <div className="part-row">
        <button
          type="button"
          className={!filters.zone ? 'part is-selected' : 'part'}
          onClick={() => set({ zone: '', muscleGroup: '' })}
        >
          Все <em>{exercises.length}</em>
        </button>
        {sections.map((part) => (
          <button
            key={part.key}
            type="button"
            className={filters.zone === part.key ? 'part is-selected' : 'part'}
            onClick={() => set({ zone: part.key, muscleGroup: '' })}
          >
            {part.label} <em>{part.count}</em>
          </button>
        ))}
      </div>

      {shown.map((part) => (
        <div className="muscle-section" key={part.key}>
          {!active && <h3 className="muscle-section__title">{part.label}</h3>}
          <div className="muscle-grid">
            {part.muscles.map((muscle) => {
              const selected = filters.muscleGroup === muscle.key
              return (
                <button
                  key={muscle.key}
                  type="button"
                  className={selected ? 'muscle-card is-selected' : 'muscle-card'}
                  aria-pressed={selected}
                  onClick={() =>
                    set(
                      selected
                        ? { muscleGroup: '' }
                        : { muscleGroup: muscle.key, zone: part.key },
                    )
                  }
                >
                  <span className="muscle-card__media">
                    {muscle.cover ? (
                      <img src={muscle.cover} alt="" loading="lazy" />
                    ) : (
                      <span className="muscle-card__media-empty" aria-hidden="true" />
                    )}
                  </span>
                  <span className="muscle-card__name">{translateMuscle(muscle.key)}</span>
                  <span className="muscle-card__count">{muscle.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="filter-bar">
        <input
          className="search-input filter-bar__search"
          placeholder="Поиск по названию или группе мышц..."
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
        <select value={filters.equipment} onChange={(e) => set({ equipment: e.target.value })} aria-label="Инвентарь">
          <option value="">Весь инвентарь</option>
          {uniqueValues(exercises, 'equipment').map((v) => (
            <option key={v} value={v}>{translateEquipment(v)}</option>
          ))}
        </select>
        <select value={filters.level} onChange={(e) => set({ level: e.target.value })} aria-label="Уровень">
          <option value="">Любой уровень</option>
          {uniqueValues(exercises, 'level').map((v) => (
            <option key={v} value={v}>{translateLevel(v)}</option>
          ))}
        </select>
        <select value={filters.category} onChange={(e) => set({ category: e.target.value })} aria-label="Категория">
          <option value="">Любая категория</option>
          {uniqueValues(exercises, 'category').map((v) => (
            <option key={v} value={v}>{translateCategory(v)}</option>
          ))}
        </select>
      </div>

      {total != null && <p className="filters__count">Показано: {total} из {exercises.length}</p>}
    </div>
  )
}
