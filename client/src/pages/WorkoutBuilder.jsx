import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName } from '../utils/translate.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import ExercisePicker from '../components/ExercisePicker.jsx'
import BackLink from '../components/BackLink.jsx'
import ExerciseAnimation from '../components/ExerciseAnimation.jsx'
import LoadAnalysis from '../components/LoadAnalysis.jsx'
import { classifyReps } from '../utils/repRanges.js'

export default function WorkoutBuilder() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [title, setTitle] = useState('')
  const [items, setItems] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [level, setLevel] = useState('')
  const { busy: saving, error, setError, run } = useAsyncAction()

  useEffect(() => {
    api.listExercises().then(setExercises).catch((e) => setLoadError(e.message))
    // Уровень нужен только для подсказки о диапазоне повторений — если его
    // не удалось прочитать, конструктор всё равно должен работать.
    api.getMyProfileData().then((data) => setLevel(data.level || '')).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api
      .getWorkout({ id })
      .then((w) => {
        setTitle(w.title || '')
        setItems(w.items || [])
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])
  const addedIds = useMemo(() => new Set(items.map((item) => item.exerciseId)), [items])

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
    if (!title || items.length === 0) {
      setError('Укажите название и добавьте хотя бы одно упражнение')
      return
    }
    try {
      if (isEdit) {
        await run(() => api.updateWorkout({ id, title, items }))
        navigate(`/workouts/${id}`)
      } else {
        const result = await run(() => api.createWorkout({ title, items }))
        navigate(`/workouts/${result.id}`)
      }
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  if (loadError) return <p>Ошибка: {loadError}</p>
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
          {items.map((item) => {
            const zone = classifyReps(item.targetReps)
            return (
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
                  {zone && (
                    <span className={`rep-zone rep-zone--${zone.tone}`} title={zone.hint}>
                      {zone.label}
                    </span>
                  )}
                </span>
                <span className="admin-list__actions">
                  <input
                    type="number"
                    min="1"
                    className="number-input"
                    value={item.targetSets}
                    onChange={(e) => updateItem(item.exerciseId, 'targetSets', Number(e.target.value))}
                    title="Подходы"
                    aria-label={`Подходы: ${item.exerciseName}`}
                  />
                  ×
                  <input
                    type="number"
                    min="1"
                    className="number-input"
                    value={item.targetReps}
                    onChange={(e) => updateItem(item.exerciseId, 'targetReps', Number(e.target.value))}
                    title="Повторы"
                    aria-label={`Повторы: ${item.exerciseName}`}
                  />
                  <button type="button" className="is-danger" onClick={() => removeExercise(item.exerciseId)}>Убрать</button>
                </span>
              </li>
            )
          })}
        </ul>

        <LoadAnalysis items={items} exerciseById={exerciseById} level={level} />

        <div className="admin-form__actions">
          <button type="submit" disabled={saving}>{isEdit ? 'Сохранить изменения' : 'Сохранить тренировку'}</button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <ExercisePicker exercises={exercises} addedIds={addedIds} onAdd={addExercise} />
    </section>
  )
}
