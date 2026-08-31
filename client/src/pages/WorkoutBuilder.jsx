import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName } from '../utils/translate.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import ExercisePicker from '../components/ExercisePicker.jsx'
import BackLink from '../components/BackLink.jsx'
import { hasExerciseMedia } from '../utils/exerciseFrames.js'
import ExerciseAnimation from '../components/ExerciseAnimation.jsx'
import LoadAnalysis from '../components/LoadAnalysis.jsx'
import { classifyReps } from '../utils/repRanges.js'
import {
  clearBuilderDraft,
  loadBuilderDraft,
  saveBuilderDraft,
} from '../utils/workoutDraft.js'

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
  const hydrated = useRef(false)

  useEffect(() => {
    api.listExercises().then(setExercises).catch((e) => setLoadError(e.message))
    api.getMyProfileData().then((data) => setLevel(data.level || '')).catch(() => {})
  }, [])

  useEffect(() => {
    hydrated.current = false

    if (!isEdit) {
      const draft = loadBuilderDraft(null)
      if (draft) {
        setTitle(draft.title)
        setItems(draft.items)
      }
      hydrated.current = true
      return
    }

    api
      .getWorkout({ id })
      .then((w) => {
        const draft = loadBuilderDraft(id)
        if (draft && (draft.title || draft.items.length > 0)) {
          setTitle(draft.title || w.title || '')
          setItems(draft.items)
        } else {
          setTitle(w.title || '')
          setItems(w.items || [])
        }
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => {
        hydrated.current = true
        setLoading(false)
      })
  }, [id, isEdit])

  useEffect(() => {
    if (!hydrated.current) return
    saveBuilderDraft(isEdit ? id : null, { title, items })
  }, [title, items, id, isEdit])

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])
  const addedIds = useMemo(() => new Set(items.map((item) => item.exerciseId)), [items])

  function addExercise(ex) {
    setItems((prev) => {
      if (prev.some((item) => item.exerciseId === ex.id)) return prev
      return [...prev, { exerciseId: ex.id, exerciseName: exerciseName(ex), targetSets: 3, targetReps: 10 }]
    })
  }

  function removeExercise(exerciseId) {
    setItems((prev) => prev.filter((item) => item.exerciseId !== exerciseId))
  }

  function moveExercise(exerciseId, direction) {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.exerciseId === exerciseId)
      if (index < 0) return prev
      const next = index + direction
      if (next < 0 || next >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(index, 1)
      copy.splice(next, 0, moved)
      return copy
    })
  }

  function updateItem(exerciseId, field, value) {
    setItems((prev) => prev.map((item) => (item.exerciseId === exerciseId ? { ...item, [field]: value } : item)))
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
        clearBuilderDraft(id)
        navigate(`/workouts/${id}`)
      } else {
        const result = await run(() => api.createWorkout({ title, items }))
        clearBuilderDraft(null)
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
          {items.map((item, index) => {
            const zone = classifyReps(item.targetReps)
            return (
              <li key={item.exerciseId}>
                <span className="admin-list__reorder" aria-label={`Порядок: ${item.exerciseName}`}>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveExercise(item.exerciseId, -1)}
                    aria-label={`Выше: ${item.exerciseName}`}
                    title="Выше"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => moveExercise(item.exerciseId, 1)}
                    aria-label={`Ниже: ${item.exerciseName}`}
                    title="Ниже"
                  >
                    ↓
                  </button>
                </span>
                <span className="picked">
                  {hasExerciseMedia(exerciseById.get(item.exerciseId)) && (
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
