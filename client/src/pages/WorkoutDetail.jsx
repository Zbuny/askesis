import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { formatDuration, useWorkoutTimer } from '../hooks/useWorkoutTimer.js'

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [history, setHistory] = useState([])
  const [results, setResults] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
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
    Promise.all([api.getWorkout({ id }), loadHistory()]).then(([w, loadedHistory]) => {
      setWorkout(w)
      const lastEntries = new Map((loadedHistory?.[0]?.entries || []).map((e) => [e.exerciseId, e]))
      const initialResults = {}
      w.items.forEach((item) => {
        const last = lastEntries.get(item.exerciseId)
        initialResults[item.exerciseId] = {
          weight: last ? String(last.weight) : '',
          reps: last ? String(last.reps) : String(item.targetReps || ''),
        }
      })
      setResults(initialResults)
    }).catch((e) => setError(e.message))
  }, [id])

  function updateResult(exerciseId, field, value) {
    setResults({ ...results, [exerciseId]: { ...results[exerciseId], [field]: value } })
  }

  async function handleLogSession(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const entries = workout.items.map((item) => ({
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        weight: Number(results[item.exerciseId]?.weight) || 0,
        reps: Number(results[item.exerciseId]?.reps) || 0,
      }))
      await api.logWorkoutSession({
        workoutId: id,
        date: new Date().toISOString(),
        entries,
        startedAt,
        durationMinutes: startedAt ? Math.max(1, Math.round(elapsedSeconds / 60)) : null,
      })
      reset()
      loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await api.deleteWorkout({ id })
      navigate('/workouts')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDuplicate() {
    setError(null)
    setDuplicating(true)
    try {
      const result = await api.duplicateWorkout({ id })
      navigate(`/workouts/${result.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setDuplicating(false)
    }
  }

  if (error) return <p>Ошибка: {error}</p>
  if (!workout) return <p>Загрузка...</p>

  return (
    <section>
      <h2>{workout.title}</h2>
      <div className="admin-list__actions">
        <button type="button" onClick={() => navigate(`/workouts/${id}/edit`)}>Редактировать</button>
        <button type="button" onClick={handleDuplicate} disabled={duplicating}>
          {duplicating ? 'Копируем...' : 'Скопировать как новую'}
        </button>
        <button type="button" onClick={handleDelete}>Удалить тренировку</button>
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

      <form className="admin-form" onSubmit={handleLogSession}>
        <ul className="admin-list">
          {workout.items.map((item) => (
            <li key={item.exerciseId}>
              <span>{item.exerciseName} <small>(цель: {item.targetSets}×{item.targetReps})</small></span>
              <span className="admin-list__actions">
                <input
                  type="number"
                  className="number-input"
                  placeholder="кг"
                  value={results[item.exerciseId]?.weight ?? ''}
                  onChange={(e) => updateResult(item.exerciseId, 'weight', e.target.value)}
                />
                кг ×
                <input
                  type="number"
                  className="number-input"
                  placeholder="повт."
                  value={results[item.exerciseId]?.reps ?? ''}
                  onChange={(e) => updateResult(item.exerciseId, 'reps', e.target.value)}
                />
              </span>
            </li>
          ))}
        </ul>
        <div className="admin-form__actions">
          <button type="submit" disabled={saving}>Записать сегодняшнюю тренировку</button>
        </div>
      </form>

      <h3>История</h3>
      {history.length === 0 && <p>Пока нет записей о выполнении.</p>}
      {history.map((session) => (
        <div key={session.id} className="history-entry">
          <time>
            {new Date(session.date).toLocaleString('ru-RU')}
            {session.durationMinutes ? ` · ${session.durationMinutes} мин в зале` : ''}
          </time>
          <ul>
            {session.entries.map((entry, i) => (
              <li key={i}>{entry.exerciseName}: {entry.weight} кг × {entry.reps}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
