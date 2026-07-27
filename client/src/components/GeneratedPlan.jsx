import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName } from '../utils/translate.js'

// Разбор и сохранение программы, которую собрала модель. Используется и
// пошаговым мастером, и чатом — сохранение должно вести себя одинаково.
export default function GeneratedPlan({ plan, exerciseById, heading = 'Ваша программа', autoSave = false }) {
  const navigate = useNavigate()
  const [savingIndex, setSavingIndex] = useState(null)
  const [savingAll, setSavingAll] = useState(false)
  const [savedTitles, setSavedTitles] = useState([])
  const [error, setError] = useState(null)
  const autoSavedFor = useRef(null)

  function buildItems(workout) {
    return workout.items.map((item) => {
      const ex = exerciseById.get(item.exerciseId)
      return {
        exerciseId: item.exerciseId,
        exerciseName: ex ? exerciseName(ex) : item.exerciseId,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
      }
    })
  }

  async function handleSave(workout, index) {
    setError(null)
    setSavingIndex(index)
    try {
      await api.createWorkout({ title: workout.title, items: buildItems(workout) })
      setSavedTitles((prev) => [...prev, workout.title])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingIndex(null)
    }
  }

  const saveAll = useCallback(async () => {
    setError(null)
    setSavingAll(true)
    const done = []
    try {
      // Последовательно, а не Promise.all: так при обрыве видно, какие дни
      // уже сохранились, и повтор не создаст их заново.
      for (const workout of plan.workouts) {
        await api.createWorkout({ title: workout.title, items: buildItems(workout) })
        done.push(workout.title)
        setSavedTitles([...done])
      }
    } catch (err) {
      setError(`Сохранено дней: ${done.length} из ${plan.workouts.length}. Ошибка: ${err.message}`)
    } finally {
      setSavingAll(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, exerciseById])

  // В чате кнопка обещает именно сохранение, поэтому сохраняем сразу, как
  // только модель вернула программу. Ref защищает от повторного прогона
  // эффекта в StrictMode — иначе дни создались бы дважды.
  useEffect(() => {
    if (!autoSave || !plan) return
    if (autoSavedFor.current === plan) return
    autoSavedFor.current = plan
    saveAll()
  }, [autoSave, plan, saveAll])

  if (!plan) return null

  const allSaved = savedTitles.length === plan.workouts.length

  return (
    <>
      <h3>{heading}</h3>
      {plan.summary && <p>{plan.summary}</p>}

      {savingAll && <p className="eyebrow">Сохраняем дни: {savedTitles.length} из {plan.workouts.length}</p>}
      {!savingAll && allSaved && <p className="eyebrow">Все дни сохранены в «Мои тренировки»</p>}
      {error && <p className="error">{error}</p>}

      {!autoSave && !allSaved && (
        <button type="button" className="button" disabled={savingAll} onClick={saveAll}>
          {savingAll ? 'Сохраняем...' : 'Сохранить все дни'}
        </button>
      )}

      {plan.workouts.map((workout, index) => (
        <div key={workout.title + index} className="plan-card">
          <h4>{workout.title}</h4>
          <ul>
            {workout.items.map((item) => {
              const ex = exerciseById.get(item.exerciseId)
              return (
                <li key={item.exerciseId}>
                  {ex ? exerciseName(ex) : item.exerciseId}
                  <small>{item.targetSets}×{item.targetReps}</small>
                </li>
              )
            })}
          </ul>
          {savedTitles.includes(workout.title) ? (
            <span className="eyebrow">Сохранено</span>
          ) : (
            <button
              type="button"
              disabled={savingIndex === index || savingAll}
              onClick={() => handleSave(workout, index)}
            >
              {savingIndex === index ? 'Сохраняем...' : 'Сохранить в мои тренировки'}
            </button>
          )}
        </div>
      ))}

      {savedTitles.length > 0 && !savingAll && (
        <button type="button" className="button" onClick={() => navigate('/workouts')}>
          Перейти к моим тренировкам
        </button>
      )}
    </>
  )
}
