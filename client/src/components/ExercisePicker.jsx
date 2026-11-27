import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { exerciseName, translateEquipment, translateMuscle } from '../utils/translate.js'
import { emptyFilters, filterExercises } from '../utils/exerciseFilters.js'
import ExerciseFilterBar from './ExerciseFilterBar.jsx'
import { hasExerciseMedia } from '../utils/exerciseFrames.js'
import ExerciseAnimation from './ExerciseAnimation.jsx'

const PAGE_SIZE = 40

// Общий "пикер" упражнений из библиотеки — используется и в конструкторе
// тренировки, и в админке программ. filters/visibleCount живут здесь же,
// чтобы оба места собирали список одинаково и не расходились со временем.
//
// Два режима:
// - onAdd — каждая карточка добавляет упражнение сразу (админка);
// - picks + onToggle — множественный выбор: карточки отмечаются, на них
//   виден номер в порядке нажатия, а добавляет их уже владелец
//   (нижняя панель конструктора, ExerciseSheet).
export default function ExercisePicker({ exercises, addedIds, onAdd, picks, onToggle, title = 'Библиотека упражнений' }) {
  const [filters, setFilters] = useState(emptyFilters)
  const filtered = useMemo(() => filterExercises(exercises, filters), [exercises, filters])
  const multi = Boolean(onToggle)
  const pickOrder = useMemo(() => new Map((picks || []).map((id, i) => [id, i + 1])), [picks])

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
      {title && <h3>{title}</h3>}
      <ExerciseFilterBar exercises={exercises} filters={filters} onChange={setFilters} total={filtered.length} />
      <p className="picker__count">Найдено: {filtered.length}</p>
      <ul className="picker">
        {filtered.slice(0, visibleCount).map((ex) => {
          const added = addedIds.has(ex.id)
          const order = pickOrder.get(ex.id)
          const name = exerciseName(ex)
          const className = `picker__item${added ? ' is-added' : ''}${order ? ' is-picked' : ''}`
          return (
            <li key={ex.id} className={className}>
              <Link to={`/exercises/${ex.id}`} className="picker__media" title="Открыть упражнение">
                {hasExerciseMedia(ex) ? (
                  <ExerciseAnimation exercise={ex} alt={name} animate={false} />
                ) : (
                  <span className="picker__media-empty" aria-hidden="true" />
                )}
                {order && (
                  <span className="picker__order" aria-hidden="true">
                    {order}
                  </span>
                )}
              </Link>
              <div className="picker__info">
                <span className="picker__name">{name}</span>
                <small>{translateMuscle(ex.muscleGroup)} · {translateEquipment(ex.equipment)}</small>
              </div>
              {multi ? (
                <button
                  type="button"
                  onClick={() => onToggle(ex)}
                  disabled={added}
                  aria-pressed={added ? undefined : Boolean(order)}
                  aria-label={added ? `${name}: уже в тренировке` : order ? `${name}: выбрано, №${order}` : `Выбрать: ${name}`}
                >
                  {added ? 'Добавлено' : order ? `№${order}` : 'Выбрать'}
                </button>
              ) : (
                <button type="button" onClick={() => onAdd(ex)} disabled={added}>
                  {added ? 'Добавлено' : 'Добавить'}
                </button>
              )}
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
