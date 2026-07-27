import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName, translateEquipment, translateMuscle } from '../utils/translate.js'
import { emptyFilters, filterExercises } from '../utils/exerciseFilters.js'
import ExerciseFilterBar from '../components/ExerciseFilterBar.jsx'

export default function WorkoutBuilder() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [title, setTitle] = useState('')
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    api.listExercises().then(setExercises).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api
      .getWorkout({ id })
      .then((w) => {
        setTitle(w.title || '')
        setItems(w.items || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const filtered = useMemo(() => filterExercises(exercises, filters), [exercises, filters])

  function addExercise(ex) {
    if (items.some((item) => item.exerciseId === ex.id)) return
    setItems([...items, { exerciseId: ex.id, exerciseName: exerciseName(ex), targetSets: 3, targetReps: 10 }])
  }

  function removeExercise(exerciseId) {
    setItems(items.filter((item) => item.exerciseId !== exerciseId))
  }

  function updateItem(exerciseId, field, value) {
    setItems(items.map((item) => (item.exerciseId === exerciseId ? { ...item, [field]: value } : item)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!title || items.length === 0) {
      setError('Укажите название и добавьте хотя бы одно упражнение')
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await api.updateWorkout({ id, title, items })
        navigate(`/workouts/${id}`)
      } else {
        const result = await api.createWorkout({ title, items })
        navigate(`/workouts/${result.id}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Загрузка...</p>

  return (
    <section>
      <h2>{isEdit ? 'Редактировать тренировку' : 'Собрать тренировку'}</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input placeholder="Название тренировки" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <h3>Выбрано ({items.length})</h3>
        {items.length === 0 && <p>Добавьте упражнения из списка ниже.</p>}
        <ul className="admin-list">
          {items.map((item) => (
            <li key={item.exerciseId}>
              <span>{item.exerciseName}</span>
              <span className="admin-list__actions">
                <input
                  type="number"
                  min="1"
                  className="number-input"
                  value={item.targetSets}
                  onChange={(e) => updateItem(item.exerciseId, 'targetSets', Number(e.target.value))}
                  title="Подходы"
                />
                ×
                <input
                  type="number"
                  min="1"
                  className="number-input"
                  value={item.targetReps}
                  onChange={(e) => updateItem(item.exerciseId, 'targetReps', Number(e.target.value))}
                  title="Повторы"
                />
                <button type="button" onClick={() => removeExercise(item.exerciseId)}>Убрать</button>
              </span>
            </li>
          ))}
        </ul>

        <div className="admin-form__actions">
          <button type="submit" disabled={saving}>{isEdit ? 'Сохранить изменения' : 'Сохранить тренировку'}</button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <h3>Библиотека упражнений</h3>
      <ExerciseFilterBar exercises={exercises} filters={filters} onChange={setFilters} />
      <ul className="admin-list">
        {filtered.map((ex) => (
          <li key={ex.id}>
            <span>{exerciseName(ex)} <small>{translateMuscle(ex.muscleGroup)} · {translateEquipment(ex.equipment)}</small></span>
            <button type="button" onClick={() => addExercise(ex)}>Добавить</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
