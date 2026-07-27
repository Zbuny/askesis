import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName, translateEquipment, translateMuscle } from '../utils/translate.js'
import { emptyFilters, filterExercises } from '../utils/exerciseFilters.js'
import ExerciseFilterBar from '../components/ExerciseFilterBar.jsx'

export default function Exercises() {
  const [exercises, setExercises] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(emptyFilters)

  useEffect(() => {
    api
      .listExercises()
      .then(setExercises)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => filterExercises(exercises, filters), [exercises, filters])

  if (error) return <p>Не удалось загрузить упражнения: {error}</p>
  if (loading) return <p>Загрузка...</p>

  return (
    <section>
      <h2>Библиотека упражнений</h2>
      <ExerciseFilterBar exercises={exercises} filters={filters} onChange={setFilters} />
      {exercises.length === 0 && (
        <p>Библиотека пуста — импортируйте датасет (см. README/SETUP).</p>
      )}
      {exercises.length > 0 && filtered.length === 0 && <p>Ничего не найдено по этим фильтрам.</p>}
      <div className="exercise-grid">
        {filtered.map((ex) => (
          <Link to={`/exercises/${ex.id}`} key={ex.id} className="exercise-card">
            {ex.imageUrl && <img src={ex.imageUrl} alt={exerciseName(ex)} loading="lazy" />}
            <h3>{exerciseName(ex)}</h3>
            <p>{translateMuscle(ex.muscleGroup)} · {translateEquipment(ex.equipment)}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
