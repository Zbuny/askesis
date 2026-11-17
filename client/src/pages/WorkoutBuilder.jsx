import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName } from '../utils/translate.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import ExercisePicker from '../components/ExercisePicker.jsx'
import BackLink from '../components/BackLink.jsx'
import { PageError, PageLoading } from '../components/PageState.jsx'
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
  // Черновик новой тренировки читаем сразу при создании состояния, а не в
  // эффекте. В эффекте он терялся: StrictMode в разработке запускает эффекты
  // дважды, первый проход успевал сохранить пустую форму поверх черновика, и
  // второй читал уже пустоту.
  const [initialDraft] = useState(() => (isEdit ? null : loadBuilderDraft(null)))
  const [title, setTitle] = useState(() => initialDraft?.title || '')
  const [items, setItems] = useState(() => initialDraft?.items || [])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [level, setLevel] = useState('')
  const { busy: saving, error, setError, run } = useAsyncAction()
  const hydrated = useRef(false)
  // Перетаскивание пунктов мышью/пальцем. itemRefs хранит DOM-узлы <li> —
  // по ним меряем, куда сейчас указывает палец, и на сколько раздвинуть
  // соседей, чтобы освободить место. drag — null, пока ничего не тащат.
  const itemRefs = useRef(new Map())
  const [drag, setDrag] = useState(null)

  useEffect(() => {
    api.listExercises().then(setExercises).catch((e) => setLoadError(e.message))
    api.getMyProfileData().then((data) => setLevel(data.level || '')).catch(() => {})
  }, [])

  useEffect(() => {
    hydrated.current = false

    if (!isEdit) {
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

  // Сколько пунктов сейчас лежат выше clientY — их индекс в списке без
  // перетаскиваемого элемента. Пока идёт жест, сам список не переставляем
  // (перечитывать items на каждый пиксель незачем), поэтому позиции соседей
  // стабильны и их можно смерить напрямую через DOM.
  function targetIndexFromY(draggedId, clientY) {
    let index = 0
    for (const item of items) {
      if (item.exerciseId === draggedId) continue
      const el = itemRefs.current.get(item.exerciseId)
      if (el && clientY > el.getBoundingClientRect().top + el.offsetHeight / 2) index++
    }
    return index
  }

  function handleDragStart(e, exerciseId, index) {
    // Подходы/повторы и «Убрать» должны работать как обычно — тащим только
    // если палец или курсор лёг на саму строку, а не на элемент управления.
    if (e.target.closest('.admin-list__actions')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = itemRefs.current.get(exerciseId)
    if (!el) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id: exerciseId, fromIndex: index, targetIndex: index, startY: e.clientY, y: 0, height: el.offsetHeight })
  }

  function handleDragMove(e) {
    if (!drag) return
    setDrag((prev) => prev && { ...prev, y: e.clientY - prev.startY, targetIndex: targetIndexFromY(prev.id, e.clientY) })
  }

  function handleDragEnd() {
    setDrag((prev) => {
      if (!prev) return null
      if (prev.targetIndex !== prev.fromIndex) {
        setItems((list) => {
          const copy = [...list]
          const from = copy.findIndex((item) => item.exerciseId === prev.id)
          if (from < 0) return list
          const [moved] = copy.splice(from, 1)
          copy.splice(prev.targetIndex, 0, moved)
          return copy
        })
      }
      return null
    })
  }

  function dragRowStyle(exerciseId, index) {
    if (!drag) return undefined
    if (drag.id === exerciseId) return { transform: `translateY(${drag.y}px)` }
    // Раздвигаем только тех соседей, что оказались между стартом и текущей
    // целью перетаскивания — остальные стоят на месте.
    const offset = drag.height + 1
    if (drag.fromIndex > drag.targetIndex && index >= drag.targetIndex && index < drag.fromIndex) {
      return { transform: `translateY(${offset}px)` }
    }
    if (drag.fromIndex < drag.targetIndex && index > drag.fromIndex && index <= drag.targetIndex) {
      return { transform: `translateY(-${offset}px)` }
    }
    return undefined
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

  if (loadError) return <PageError title="Не получилось открыть конструктор" message={loadError} backTo="/workouts" backLabel="К тренировкам" />
  if (loading) return <PageLoading cards={2} label="Загружаем конструктор" />

  return (
    <section>
      <BackLink fallback="/workouts" label="К тренировкам" />
      <h1 className="page-title">{isEdit ? 'Редактировать тренировку' : 'Собрать тренировку'}</h1>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input placeholder="Название тренировки" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <h3>Выбрано ({items.length})</h3>
        {items.length === 0 && <p>Добавьте упражнения из списка ниже.</p>}
        <ul className={`admin-list workout-items${drag ? ' is-reordering' : ''}`}>
          {items.map((item, index) => {
            const zone = classifyReps(item.targetReps)
            return (
              <li
                key={item.exerciseId}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.exerciseId, el)
                  else itemRefs.current.delete(item.exerciseId)
                }}
                className={drag?.id === item.exerciseId ? 'is-dragging' : undefined}
                style={dragRowStyle(item.exerciseId, index)}
                tabIndex={0}
                aria-label={`${item.exerciseName}. Потяните строку или используйте стрелки вверх/вниз, чтобы изменить порядок`}
                // Тащим за саму строку — отдельная ручка на узком экране
                // только отжимала название за край (см. скриншот в задаче).
                onPointerDown={(e) => handleDragStart(e, item.exerciseId, index)}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    moveExercise(item.exerciseId, -1)
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    moveExercise(item.exerciseId, 1)
                  }
                }}
              >
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
                  <span className="picked__name">{item.exerciseName}</span>
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
