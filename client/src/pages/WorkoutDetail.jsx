import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { formatDuration, useWorkoutTimer } from '../hooks/useWorkoutTimer.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { friendlyErrorMessage } from '../utils/errors.js'
import { entrySets, formatEntry } from '../utils/workoutLog.js'
import { exerciseName } from '../utils/translate.js'
import { formatReps } from '../utils/programItems.js'
import { formatTarget, nextSessionTarget } from '../utils/progression.js'
import ExerciseAnimation from '../components/ExerciseAnimation.jsx'
import BackLink from '../components/BackLink.jsx'

const emptySet = () => ({ weight: '', reps: '' })

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState({})
  const [history, setHistory] = useState([])
  const [results, setResults] = useState({})
  const [level, setLevel] = useState('')
  const { busy: saving, error, setError, run } = useAsyncAction()
  const [duplicating, setDuplicating] = useState(false)
  const [deletingWorkout, setDeletingWorkout] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState(null)
  const { startedAt, elapsedSeconds, start, reset } = useWorkoutTimer(id)

  function loadHistory() {
    return api
      .listWorkoutHistory({ workoutId: id })
      .then((sessions) => {
        setHistory(sessions)
        return sessions
      })
      .catch((e) => {
        setError(e.message)
        return []
      })
  }

  useEffect(() => {
    // Уровень задаёт шаг прибавки веса; без него считаем по среднему.
    api.getMyProfileData().then((data) => setLevel(data.level || '')).catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([api.getWorkout({ id }), loadHistory()])
      .then(([w, loadedHistory]) => {
        setWorkout(w)

        // Подставляем прошлый результат по каждому подходу — так проще
        // ориентироваться, с каким весом заходить сегодня.
        const lastEntries = new Map((loadedHistory?.[0]?.entries || []).map((e) => [e.exerciseId, e]))
        const initial = {}
        w.items.forEach((item) => {
          const lastSets = entrySets(lastEntries.get(item.exerciseId))
          const count = Math.max(item.targetSets || 1, lastSets.length, 1)
          // Ничего не подставляем «из цели»: пустой подход должен означать
          // «не делал». Цель показываем плейсхолдером.
          initial[item.exerciseId] = Array.from({ length: count }, (_, i) => ({
            weight: lastSets[i] ? String(lastSets[i].weight) : '',
            reps: lastSets[i] ? String(lastSets[i].reps) : '',
          }))
        })
        setResults(initial)

        // Картинка и ссылка «как выполнять» — тянем только нужные упражнения,
        // а не всю библиотеку из 873 документов.
        Promise.all(
          w.items.map((item) =>
            api.getExercise({ id: item.exerciseId }).catch(() => null),
          ),
        ).then((list) => {
          const byId = {}
          list.forEach((ex) => {
            if (ex) byId[ex.id] = ex
          })
          setExercises(byId)
        })
      })
      .catch((e) => setError(e.message))
  }, [id])

  // Что ставить сегодня — считаем из последней записи по этой же тренировке:
  // добрал верх диапазона во всех подходах — вес растёт, нет — добираем повторы.
  const targets = useMemo(() => {
    const last = history[0]
    const lastEntries = new Map((last?.entries || []).map((entry) => [entry.exerciseId, entry]))
    const map = new Map()
    ;(workout?.items || []).forEach((item) => {
      map.set(
        item.exerciseId,
        nextSessionTarget({
          item,
          lastEntry: lastEntries.get(item.exerciseId),
          lastDate: last?.date,
          exercise: exercises[item.exerciseId],
          level,
        }),
      )
    })
    return map
  }, [workout, history, exercises, level])

  function applyTarget(item) {
    const target = targets.get(item.exerciseId)
    if (!target) return
    const count = Math.max(Number(item.targetSets) || 1, 1)
    setResults((prev) => ({
      ...prev,
      [item.exerciseId]: Array.from({ length: count }, () => ({
        weight: target.weight ? String(target.weight) : '',
        reps: String(target.reps),
      })),
    }))
  }

  function updateSet(exerciseId, index, field, value) {
    setResults((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((set, i) => (i === index ? { ...set, [field]: value } : set)),
    }))
  }

  function addSet(exerciseId) {
    setResults((prev) => ({ ...prev, [exerciseId]: [...prev[exerciseId], emptySet()] }))
  }

  function removeSet(exerciseId, index) {
    setResults((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].filter((_, i) => i !== index),
    }))
  }

  async function handleLogSession(e) {
    e.preventDefault()

    const entries = workout.items
      .map((item) => ({
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        // Пустые подходы не записываем — упражнение могли пропустить.
        sets: (results[item.exerciseId] || [])
          .filter((set) => set.weight !== '' || set.reps !== '')
          .map((set) => ({ weight: Number(set.weight) || 0, reps: Number(set.reps) || 0 })),
      }))
      .filter((entry) => entry.sets.length > 0)

    if (entries.length === 0) {
      setError('Заполните хотя бы один подход')
      return
    }

    try {
      await run(() =>
        api.logWorkoutSession({
          workoutId: id,
          date: new Date().toISOString(),
          entries,
          startedAt,
          durationMinutes: startedAt ? Math.max(1, Math.round(elapsedSeconds / 60)) : null,
        }),
      )
      reset()
      loadHistory()
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить тренировку «${workout.title}»? Это действие необратимо.`)) return
    setDeletingWorkout(true)
    try {
      await api.deleteWorkout({ id })
      navigate('/workouts')
    } catch (err) {
      setError(friendlyErrorMessage(err))
      setDeletingWorkout(false)
    }
  }

  async function handleDeleteSession(sessionId) {
    if (!window.confirm('Удалить эту запись о выполнении? Это действие необратимо.')) return
    setDeletingSessionId(sessionId)
    try {
      await api.deleteWorkoutLog({ id: sessionId })
      setHistory((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setDeletingSessionId(null)
    }
  }

  async function handleDuplicate() {
    setError(null)
    setDuplicating(true)
    try {
      const result = await api.duplicateWorkout({ id })
      navigate(`/workouts/${result.id}`)
    } catch (err) {
      setError(friendlyErrorMessage(err))
      setDuplicating(false)
    }
  }

  if (error && !workout) return <p>Ошибка: {error}</p>
  if (!workout) return <p>Загрузка...</p>

  return (
    <section>
      <BackLink fallback="/workouts" label="К тренировкам" />
      <h2>{workout.title}</h2>
      <div className="admin-list__actions">
        <button type="button" onClick={() => navigate(`/workouts/${id}/edit`)}>Редактировать</button>
        <button type="button" onClick={handleDuplicate} disabled={duplicating}>
          {duplicating ? 'Копируем...' : 'Скопировать как новую'}
        </button>
        <button type="button" className="is-danger" onClick={handleDelete} disabled={deletingWorkout}>
          {deletingWorkout ? 'Удаляем...' : 'Удалить тренировку'}
        </button>
      </div>

      <h3>Отметить выполнение</h3>

      <div className="timer">
        {startedAt ? (
          <>
            <span className="timer__value">{formatDuration(elapsedSeconds)}</span>
            <span className="timer__label">
              в зале с {new Date(startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button type="button" onClick={reset}>Сбросить</button>
          </>
        ) : (
          <>
            <span className="timer__label">Засечь время тренировки, чтобы оно попало в статистику</span>
            <button type="button" onClick={start}>Начать тренировку</button>
          </>
        )}
      </div>

      <form onSubmit={handleLogSession}>
        {workout.items.map((item) => {
          const ex = exercises[item.exerciseId]
          const sets = results[item.exerciseId] || []
          const target = targets.get(item.exerciseId)
          return (
            <div className="log-exercise" key={item.exerciseId}>
              <div className="log-exercise__head">
                <Link to={`/exercises/${item.exerciseId}`} className="log-exercise__media">
                  {ex?.imageUrl ? (
                    <ExerciseAnimation exercise={ex} alt={exerciseName(ex)} animate={false} />
                  ) : (
                    <span className="log-exercise__media-empty" aria-hidden="true" />
                  )}
                </Link>

                <div className="log-exercise__info">
                  <Link to={`/exercises/${item.exerciseId}`} className="log-exercise__name">
                    {ex ? exerciseName(ex) : item.exerciseName}
                  </Link>
                  <span className="log-exercise__target">
                    Цель: {item.targetSets} × {formatReps(item)}
                  </span>
                  {target && (
                    <span className={`next-target next-target--${target.action}`}>
                      <strong>Сегодня: {formatTarget(target)}</strong>
                      {target.action !== 'start' && (
                        <button type="button" onClick={() => applyTarget(item)}>
                          Взять
                        </button>
                      )}
                      <small>{target.hint}</small>
                    </span>
                  )}
                  <Link to={`/exercises/${item.exerciseId}`} className="log-exercise__how">
                    Как выполнять →
                  </Link>
                </div>
              </div>

              <div className="log-sets">
                {sets.map((set, i) => (
                  <div className="log-set" key={i}>
                    <span className="log-set__num">{i + 1}</span>
                    <label className="log-set__field">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        placeholder="0"
                        value={set.weight}
                        onChange={(e) => updateSet(item.exerciseId, i, 'weight', e.target.value)}
                      />
                      <span>кг</span>
                    </label>
                    <label className="log-set__field">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        placeholder={String(item.targetReps || '')}
                        value={set.reps}
                        onChange={(e) => updateSet(item.exerciseId, i, 'reps', e.target.value)}
                      />
                      <span>повт.</span>
                    </label>
                    <button
                      type="button"
                      className="log-set__remove"
                      onClick={() => removeSet(item.exerciseId, i)}
                      title="Убрать подход"
                      aria-label={`Убрать подход ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="log-sets__add" onClick={() => addSet(item.exerciseId)}>
                  + подход
                </button>
              </div>
            </div>
          )
        })}

        {error && <p className="error">{error}</p>}

        <div className="admin-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Сохраняем...' : 'Записать сегодняшнюю тренировку'}
          </button>
        </div>
      </form>

      <h3>История</h3>
      {history.length === 0 && <p>Пока нет записей о выполнении.</p>}
      {history.map((session) => (
        <div key={session.id} className="history-entry">
          <div className="history-entry__row">
            <time>
              {new Date(session.date).toLocaleString('ru-RU')}
              {session.durationMinutes ? ` · ${session.durationMinutes} мин в зале` : ''}
            </time>
            <button
              type="button"
              className="is-danger"
              onClick={() => handleDeleteSession(session.id)}
              disabled={deletingSessionId === session.id}
            >
              {deletingSessionId === session.id ? 'Удаляем...' : 'Удалить'}
            </button>
          </div>
          <ul>
            {session.entries.map((entry, i) => (
              <li key={i}>{entry.exerciseName}: {formatEntry(entry)}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
