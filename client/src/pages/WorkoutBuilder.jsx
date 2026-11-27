import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName } from '../utils/translate.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { useDragReorder } from '../hooks/useDragReorder.js'
import ExerciseSheet from '../components/ExerciseSheet.jsx'
import BackLink from '../components/BackLink.jsx'
import { PageError, PageLoading } from '../components/PageState.jsx'
import { hasExerciseMedia } from '../utils/exerciseFrames.js'
import ExerciseAnimation from '../components/ExerciseAnimation.jsx'
import LoadAnalysis from '../components/LoadAnalysis.jsx'
import { classifyReps } from '../utils/repRanges.js'
import { moveItem } from '../utils/reorder.js'
import { editItemField, MAX_REPS, MAX_SETS, normalizePlanItems } from '../utils/programItems.js'
import {
  clearBuilderDraft,
  loadBuilderDraft,
  loadPickDraft,
  saveBuilderDraft,
  savePickDraft,
} from '../utils/workoutDraft.js'
import '../styles/builder.css'

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
  // Библиотека открывается нижней панелью. picks — отмеченные, но ещё не
  // добавленные упражнения в порядке нажатия. Они переживают переход на
  // страницу упражнения из панели: вернувшись, человек видит панель с тем
  // же выбором (см. loadPickDraft).
  const [picks, setPicks] = useState(() => loadPickDraft(isEdit ? id : null))
  const [sheetOpen, setSheetOpen] = useState(() => picks.length > 0)

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

  useEffect(() => {
    savePickDraft(isEdit ? id : null, picks)
  }, [picks, id, isEdit])

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])
  const addedIds = useMemo(() => new Set(items.map((item) => item.exerciseId)), [items])
  const ids = useMemo(() => items.map((item) => item.exerciseId), [items])

  function togglePick(ex) {
    setPicks((prev) => (prev.includes(ex.id) ? prev.filter((pid) => pid !== ex.id) : [...prev, ex.id]))
  }

  // Добавляем в том порядке, в каком упражнения отмечали.
  function addPicked() {
    const fresh = picks
      .filter((pid) => !addedIds.has(pid) && exerciseById.has(pid))
      .map((pid) => ({
        exerciseId: pid,
        exerciseName: exerciseName(exerciseById.get(pid)),
        targetSets: 3,
        targetReps: 10,
      }))
    setItems((prev) => [...prev, ...fresh])
    setPicks([])
    setSheetOpen(false)
  }

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
    setPicks([])
  }, [])

  function removeExercise(exerciseId) {
    setItems((prev) => prev.filter((item) => item.exerciseId !== exerciseId))
  }

  // raw — строка из поля ввода. Пустое поле остаётся пустым (''), иначе
  // Number('') === 0 тут же вписал бы ноль обратно и стереть его было бы
  // нельзя. В числа приводим перед сохранением (normalizePlanItems).
  function updateItem(exerciseId, field, raw) {
    setItems((prev) => prev.map((item) => (item.exerciseId === exerciseId ? editItemField(item, field, raw) : item)))
  }

  const moveExercise = useCallback((from, to) => setItems((prev) => moveItem(prev, from, to)), [])
  const labelOf = useCallback(
    (exerciseId) => items.find((item) => item.exerciseId === exerciseId)?.exerciseName || 'Упражнение',
    [items],
  )
  const { drag, rowRef, handleProps, rowStyle, announcement } = useDragReorder({
    ids,
    onMove: moveExercise,
    labelOf,
  })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title || items.length === 0) {
      setError('Укажите название и добавьте хотя бы одно упражнение')
      return
    }
    const normalized = normalizePlanItems(items)
    if (normalized.error) {
      setError(normalized.error)
      return
    }
    const payload = normalized.items
    try {
      if (isEdit) {
        await run(() => api.updateWorkout({ id, title, items: payload }))
        clearBuilderDraft(id)
        navigate(`/workouts/${id}`)
      } else {
        const result = await run(() => api.createWorkout({ title, items: payload }))
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

      <form className="admin-form builder-form" onSubmit={handleSubmit}>
        <input placeholder="Название тренировки" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <h3 className="builder__heading">
          Упражнения <span>{items.length}</span>
        </h3>
        {items.length === 0 && <p className="builder__empty">Пока пусто. Откройте библиотеку и отметьте упражнения.</p>}
        <ol className={`workout-items${drag ? ' is-reordering' : ''}`}>
          {items.map((item, index) => {
            const zone = classifyReps(item.targetReps)
            const exercise = exerciseById.get(item.exerciseId)
            const canDrag = items.length > 1
            return (
              <li
                key={item.exerciseId}
                ref={rowRef(item.exerciseId)}
                className={`plan-row${drag?.id === item.exerciseId ? ' is-dragging' : ''}`}
                style={rowStyle(item.exerciseId, index)}
              >
                {canDrag ? (
                  <button
                    type="button"
                    className="drag-handle"
                    aria-label={`Переместить: ${item.exerciseName}, позиция ${index + 1} из ${items.length}. Стрелки вверх и вниз меняют порядок`}
                    title="Потяните, чтобы изменить порядок"
                    {...handleProps(item.exerciseId, index)}
                  >
                    <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true" focusable="false">
                      <circle cx="3" cy="4" r="1.6" />
                      <circle cx="9" cy="4" r="1.6" />
                      <circle cx="3" cy="10" r="1.6" />
                      <circle cx="9" cy="10" r="1.6" />
                      <circle cx="3" cy="16" r="1.6" />
                      <circle cx="9" cy="16" r="1.6" />
                    </svg>
                  </button>
                ) : (
                  <span className="drag-handle drag-handle--placeholder" aria-hidden="true" />
                )}

                <div className="plan-row__main">
                  <div className="plan-row__head">
                    {hasExerciseMedia(exercise) && (
                      <span className="plan-row__media">
                        <ExerciseAnimation exercise={exercise} alt={item.exerciseName} animate={false} />
                      </span>
                    )}
                    <span className="plan-row__title">
                      <span className="plan-row__num">{String(index + 1).padStart(2, '0')}</span>
                      <span className="plan-row__name">{item.exerciseName}</span>
                    </span>
                  </div>

                  <div className="plan-row__params">
                    <label className="plan-field">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={MAX_SETS}
                        value={item.targetSets}
                        onChange={(e) => updateItem(item.exerciseId, 'targetSets', e.target.value)}
                        aria-label={`Подходы: ${item.exerciseName}`}
                      />
                      <span aria-hidden="true">подходы</span>
                    </label>
                    <span className="plan-row__x" aria-hidden="true">×</span>
                    <label className="plan-field">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={MAX_REPS}
                        value={item.targetReps}
                        onChange={(e) => updateItem(item.exerciseId, 'targetReps', e.target.value)}
                        aria-label={`Повторы: ${item.exerciseName}`}
                        title="0 - до отказа"
                      />
                      <span aria-hidden="true">{item.targetReps === 0 ? 'до отказа' : 'повторы'}</span>
                    </label>
                    {zone && (
                      <span className={`rep-zone rep-zone--${zone.tone} plan-row__zone`} title={zone.hint}>
                        {zone.label}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="plan-row__remove"
                  onClick={() => removeExercise(item.exerciseId)}
                  aria-label={`Убрать: ${item.exerciseName}`}
                  title="Убрать из тренировки"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
                    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="builder__live" aria-live="polite">{announcement}</p>

        <button type="button" className="builder__add" onClick={() => setSheetOpen(true)}>
          <span className="builder__add-icon" aria-hidden="true">+</span>
          Добавить упражнения
        </button>

        <LoadAnalysis items={items} exerciseById={exerciseById} level={level} />

        <div className="admin-form__actions">
          <button type="submit" disabled={saving}>{isEdit ? 'Сохранить изменения' : 'Сохранить тренировку'}</button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <ExerciseSheet
        open={sheetOpen}
        exercises={exercises}
        addedIds={addedIds}
        picks={picks}
        onToggle={togglePick}
        onSubmit={addPicked}
        onClose={closeSheet}
      />
    </section>
  )
}
