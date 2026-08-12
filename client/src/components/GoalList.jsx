import { useState } from 'react'
import {
  GOAL_MILESTONES,
  MAX_GOAL_REPS,
  MAX_GOAL_WEIGHT,
  formatGoal,
  startScoreFor,
} from '../utils/goals.js'

// Цели живут рядом с рекордами: одно и то же упражнение, одна и та же шкала,
// разница только в том, что рекорд уже случился, а цель ещё нет.

const emptyDraft = { exerciseId: '', targetWeight: '', targetReps: '1' }

// Цель на повторения меряется повторениями, весовая — поднятым подходом.
function describeRecord({ record, unit }) {
  if (unit === 'повт.') return `${record.reps} повт.`
  return `${record.weight} кг × ${record.reps}`
}

function Milestones({ percent }) {
  return (
    <div className="goal__scale" aria-hidden="true">
      <span className="goal__fill" style={{ width: `${percent}%` }} />
      {GOAL_MILESTONES.slice(0, -1).map((milestone) => (
        <span
          key={milestone}
          className={`goal__milestone${percent >= milestone ? ' is-passed' : ''}`}
          style={{ left: `${milestone}%` }}
        />
      ))}
    </div>
  )
}

export default function GoalList({ goals, available, history, onCreate, onDelete, busy }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [adding, setAdding] = useState(false)

  const exercise = available.find((ex) => ex.exerciseId === draft.exerciseId)
  const repsOnly = draft.targetWeight === '' || Number(draft.targetWeight) === 0

  function handleSubmit(e) {
    e.preventDefault()
    if (!draft.exerciseId) return

    const goal = {
      exerciseId: draft.exerciseId,
      exerciseName: exercise?.name || draft.exerciseId,
      targetWeight: repsOnly ? 0 : Number(draft.targetWeight),
      targetReps: Number(draft.targetReps) || 1,
    }

    // Точку отсчёта считаем здесь, на момент постановки: позже её взять
    // будет неоткуда — рекорд к тому времени уже вырастет.
    onCreate({ ...goal, startScore: startScoreFor(goal, history) })
    setDraft(emptyDraft)
    setAdding(false)
  }

  return (
    <div className="goals">
      {goals.length === 0 && !adding && (
        <p className="goals__empty">
          Целей пока нет. Цель — это не «стать сильнее», а конкретное число:
          «жим 100 кг» или «15 подтягиваний». Тогда видно, сколько до него осталось.
        </p>
      )}

      {goals.map((row) => (
        <div key={row.goal.id} className={`goal${row.achieved ? ' goal--done' : ''}`}>
          <div className="goal__head">
            <div>
              <strong className="goal__name">{row.goal.exerciseName}</strong>
              <span className="goal__target">
                {formatGoal(row.goal)}
                {row.achieved && <em> — взято</em>}
              </span>
            </div>
            <button
              type="button"
              className="is-danger"
              onClick={() => onDelete(row.goal)}
              disabled={busy}
              aria-label={`Удалить цель ${row.goal.exerciseName}`}
            >
              Удалить
            </button>
          </div>

          <Milestones percent={row.percent} />

          <p className="goal__meta">
            {row.record ? (
              <>
                {/* Показываем и реально поднятое, и пересчёт: цель сравнивается
                    через оценку разового максимума, и «сейчас 19.6 кг» без
                    пояснения читается как вес, которого человек не поднимал. */}
                Лучший подход: {describeRecord(row)}
                {row.unit === 'кг' && <> ≈ {row.current} кг на раз</>}
                {' · '}{row.percent}% пути
                {!row.achieved && <> · осталось {row.remaining} {row.unit}</>}
              </>
            ) : (
              <>Пока нет ни одной записи с этим упражнением — цель начнёт считаться после первой.</>
            )}
          </p>
        </div>
      ))}

      {adding ? (
        <form className="admin-form goals__form" onSubmit={handleSubmit}>
          <select
            className={draft.exerciseId ? undefined : 'is-placeholder'}
            value={draft.exerciseId}
            onChange={(e) => setDraft({ ...draft, exerciseId: e.target.value })}
            aria-label="Упражнение"
          >
            <option value="">Упражнение</option>
            {available.map((ex) => (
              <option key={ex.exerciseId} value={ex.exerciseId}>{ex.name}</option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            max={MAX_GOAL_WEIGHT}
            step="0.5"
            placeholder="Вес, кг (пусто — цель на повторения)"
            value={draft.targetWeight}
            onChange={(e) => setDraft({ ...draft, targetWeight: e.target.value })}
          />

          <input
            type="number"
            min="1"
            max={MAX_GOAL_REPS}
            placeholder={repsOnly ? 'Повторений' : 'На сколько раз'}
            value={draft.targetReps}
            onChange={(e) => setDraft({ ...draft, targetReps: e.target.value })}
          />

          <p className="goals__hint">
            {repsOnly
              ? 'Без веса цель считается по повторениям — так ставят подтягивания и отжимания.'
              : 'Вес и повторения сравниваются через оценку разового максимума: «85 кг × 5» и «100 кг × 1» — это одна и та же сила.'}
          </p>

          <div className="admin-form__actions">
            <button type="submit" disabled={busy || !draft.exerciseId}>Поставить цель</button>
            <button type="button" onClick={() => { setDraft(emptyDraft); setAdding(false) }}>Отмена</button>
          </div>
        </form>
      ) : (
        <button type="button" className="goals__add" onClick={() => setAdding(true)} disabled={available.length === 0}>
          + Поставить цель
        </button>
      )}

      {available.length === 0 && !adding && (
        <p className="goals__hint">
          Цель ставится на упражнение из вашего журнала — запишите хотя бы одну тренировку.
        </p>
      )}
    </div>
  )
}
