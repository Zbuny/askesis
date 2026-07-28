import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName, translateEquipment, translateMuscle } from '../utils/translate.js'
import { emptyFilters, filterExercises } from '../utils/exerciseFilters.js'
import ExerciseFilterBar from '../components/ExerciseFilterBar.jsx'
import BackLink from '../components/BackLink.jsx'
import ExerciseAnimation from '../components/ExerciseAnimation.jsx'

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

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])

  // Показываем список порциями: 873 карточки с картинками разом рисовать
  // незачем, а при смене фильтра счётчик сбрасывается на первую порцию.
  const [visibleCount, setVisibleCount] = useState(40)
  useEffect(() => setVisibleCount(40), [filters])

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
      <BackLink fallback="/workouts" label="К тренировкам" />
      <h2>{isEdit ? 'Редактировать тренировку' : 'Собрать тренировку'}</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input placeholder="Название тренировки" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <h3>Выбрано ({items.length})</h3>
        {items.length === 0 && <p>Добавьте упражнения из списка ниже.</p>}
        <ul className="admin-list">
          {items.map((item) => (
            <li key={item.exerciseId}>
              <span className="picked">
                {exerciseById.get(item.exerciseId)?.imageUrl && (
                  <span className="picked__media">
                    <ExerciseAnimation
                      exercise={exerciseById.get(item.exerciseId)}
                      alt={item.exerciseName}
                      animate={false}
                    />
                  </span>
                )}
                {item.exerciseName}
              </span>
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
      <p className="picker__count">Найдено: {filtered.length}</p>
      <ul className="picker">
        {filtered.slice(0, visibleCount).map((ex) => {
          const added = items.some((item) => item.exerciseId === ex.id)
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
              <button type="button" onClick={() => addExercise(ex)} disabled={added}>
                {added ? 'Добавлено' : 'Добавить'}
              </button>
            </li>
          )
        })}
      </ul>
      {visibleCount < filtered.length && (
        <button type="button" className="picker__more" onClick={() => setVisibleCount(visibleCount + 40)}>
          Показать ещё ({filtered.length - visibleCount})
        </button>
      )}
    </section>
  )
}
