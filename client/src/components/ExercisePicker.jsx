import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { exerciseName, translateEquipment, translateMuscle } from '../utils/translate.js'
import { emptyFilters, filterExercises } from '../utils/exerciseFilters.js'
import ExerciseFilterBar from './ExerciseFilterBar.jsx'
import ExerciseAnimation from './ExerciseAnimation.jsx'

const PAGE_SIZE = 40

// Общий "пикер" упражнений из библиотеки — используется и в конструкторе
// тренировки, и в админке программ. filters/visibleCount живут здесь же,
// чтобы оба места собирали список одинаково и не расходились со временем.
export default function ExercisePicker({ exercises, addedIds, onAdd }) {
  const [filters, setFilters] = useState(emptyFilters)
  const filtered = useMemo(() => filterExercises(exercises, filters), [exercises, filters])

  // Показываем список порциями: сотни карточек с картинками разом рисовать
  // незачем, а при смене фильтра счётчик сбрасывается на первую порцию.
  // Сброс — прямо в рендере, а не в эффекте: React отбросит текущий проход и
  // отрисует сразу верное значение, тогда как эффект сначала показал бы
  // пользователю старую длинную выдачу и лишь потом обрезал её.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [lastFilters, setLastFilters] = useState(filters)
  if (lastFilters !== filters) {
    setLastFilters(filters)
    setVisibleCount(PAGE_SIZE)
  }

  return (
    <>
      <h3>Библиотека упражнений</h3>
      <ExerciseFilterBar exercises={exercises} filters={filters} onChange={setFilters} />
      <p className="picker__count">Найдено: {filtered.length}</p>
      <ul className="picker">
        {filtered.slice(0, visibleCount).map((ex) => {
          const added = addedIds.has(ex.id)
          return (
            <li key={ex.id} className={`picker__item${added ? ' is-added' : ''}`}>
              <Link to={`/exercises/${ex.id}`} className="picker__media" title="Открыть упражнение">
                {ex.imageUrl ? (
                  <ExerciseAnimation exercise={ex} alt={exerciseName(ex)} animate={false} />
                ) : (
                  <span className="picker__media-empty" aria-hidden="true" />
                )}
              </Link>
              <div className="picker__info">
                <span className="picker__name">{exerciseName(ex)}</span>
                <small>{translateMuscle(ex.muscleGroup)} · {translateEquipment(ex.equipment)}</small>
              </div>
              <button type="button" onClick={() => onAdd(ex)} disabled={added}>
                {added ? 'Добавлено' : 'Добавить'}
              </button>
            </li>
          )
        })}
      </ul>
      {visibleCount < filtered.length && (
        <button type="button" className="picker__more" onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}>
          Показать ещё ({filtered.length - visibleCount})
        </button>
      )}
    </>
  )
}
