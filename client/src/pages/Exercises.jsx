import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { useAsyncData } from '../hooks/useAsyncData.js'
import { exerciseName, translateEquipment, translateMuscle } from '../utils/translate.js'
import { emptyFilters, filterExercises } from '../utils/exerciseFilters.js'
import ExerciseFilterBar from '../components/ExerciseFilterBar.jsx'
import { hasExerciseMedia } from '../utils/exerciseFrames.js'
import ExerciseAnimation from '../components/ExerciseAnimation.jsx'
import { PageError, PageLoading } from '../components/PageState.jsx'

export default function Exercises() {
  const { data, loading, error, reload } = useAsyncData(api.listExercises, [])
  const exercises = data || []
  const [filters, setFilters] = useState(emptyFilters)
  // В сетке крутим кадры только у карточки под курсором — иначе сотни
  // одновременных таймеров и предзагрузок вторых кадров.
  const [hoveredId, setHoveredId] = useState(null)

  const filtered = useMemo(() => filterExercises(exercises, filters), [exercises, filters])

  if (loading) return <PageLoading cards={4} label="Загружаем упражнения" />
  if (error) return <PageError title="Не получилось загрузить упражнения" message={error} onRetry={reload} backTo="/dashboard" />

  return (
    <section>
      <h1 className="page-title">Библиотека упражнений</h1>
      <ExerciseFilterBar
        exercises={exercises}
        filters={filters}
        onChange={setFilters}
        total={filtered.length}
      />
      {exercises.length === 0 && (
        <p>Библиотека пуста — импортируйте датасет (см. README/SETUP).</p>
      )}
      {exercises.length > 0 && filtered.length === 0 && <p>Ничего не найдено по этим фильтрам.</p>}
      <div className="exercise-grid">
        {filtered.map((ex) => (
          <Link
            to={`/exercises/${ex.id}`}
            key={ex.id}
            className="exercise-card"
            onMouseEnter={() => setHoveredId(ex.id)}
            onMouseLeave={() => setHoveredId(null)}
            onFocus={() => setHoveredId(ex.id)}
            onBlur={() => setHoveredId(null)}
          >
            {hasExerciseMedia(ex) && (
              <ExerciseAnimation
                exercise={ex}
                alt={exerciseName(ex)}
                animate={hoveredId === ex.id}
              />
            )}
            <h3>{exerciseName(ex)}</h3>
            <p>{translateMuscle(ex.muscleGroup)} · {translateEquipment(ex.equipment)}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
