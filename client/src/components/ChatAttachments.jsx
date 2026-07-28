import { useState } from 'react'
import { entrySets, formatEntry } from '../utils/workoutLog.js'

// Что можно приложить к вопросу: состав своих тренировок и историю весов.
// Без них тренер отвечает общими словами, с ними — называет конкретику.
export default function ChatAttachments({ value, onChange, workouts, history }) {
  const [open, setOpen] = useState(false)

  function toggleWorkout(id) {
    const next = value.workoutIds.includes(id)
      ? value.workoutIds.filter((x) => x !== id)
      : [...value.workoutIds, id]
    onChange({ ...value, workoutIds: next })
  }

  const attachedCount = value.workoutIds.length + (value.includeHistory ? 1 : 0)

  return (
    <div className="attach">
      <button
        type="button"
        className={`attach__toggle${attachedCount ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span aria-hidden="true">+</span>
        {attachedCount ? `Приложено: ${attachedCount}` : 'Приложить свои данные'}
      </button>

      {open && (
        <div className="attach__panel">
          <label className="attach__row">
            <input
              type="checkbox"
              checked={value.includeHistory}
              onChange={(e) => onChange({ ...value, includeHistory: e.target.checked })}
              disabled={history.length === 0}
            />
            <span>
              История выполнения
              <small>
                {history.length === 0
                  ? 'пока нет записей'
                  : `последние ${Math.min(history.length, 10)} из ${history.length}`}
              </small>
            </span>
          </label>

          {workouts.length === 0 && <p className="attach__hint">Сохранённых тренировок пока нет.</p>}

          {workouts.map((w) => (
            <label className="attach__row" key={w.id}>
              <input
                type="checkbox"
                checked={value.workoutIds.includes(w.id)}
                onChange={() => toggleWorkout(w.id)}
              />
              <span>
                {w.title}
                <small>{w.items?.length || 0} упражнений</small>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// Собирает то, что реально уйдёт воркеру: только выбранное и в сжатом виде.
export function buildContext({ workoutIds, includeHistory }, workouts, history) {
  const context = {}

  const picked = workouts.filter((w) => workoutIds.includes(w.id))
  if (picked.length) {
    context.workouts = picked.map((w) => ({
      title: w.title,
      items: (w.items || []).map((i) => ({
        exerciseName: i.exerciseName,
        targetSets: i.targetSets,
        targetReps: i.targetReps,
      })),
    }))
  }

  if (includeHistory && history.length) {
    context.history = history.slice(0, 10).map((s) => ({
      date: new Date(s.date).toLocaleDateString('ru-RU'),
      entries: (s.entries || [])
        .filter((e) => entrySets(e).length > 0)
        .map((e) => ({ name: e.exerciseName, sets: formatEntry(e) })),
    }))
  }

  return Object.keys(context).length ? context : undefined
}
