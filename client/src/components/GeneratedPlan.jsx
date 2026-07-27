import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { exerciseName } from '../utils/translate.js'

// Разбор и сохранение программы, которую собрала модель. Используется и
// пошаговым мастером, и чатом — сохранение должно вести себя одинаково.
export default function GeneratedPlan({ plan, exerciseById, heading = 'Ваша программа' }) {
  const navigate = useNavigate()
  const [savingIndex, setSavingIndex] = useState(null)
  const [savedTitles, setSavedTitles] = useState([])
  const [error, setError] = useState(null)

  async function handleSave(workout, index) {
    setError(null)
    setSavingIndex(index)
    try {
      const items = workout.items.map((item) => {
        const ex = exerciseById.get(item.exerciseId)
        return {
          exerciseId: item.exerciseId,
          exerciseName: ex ? exerciseName(ex) : item.exerciseId,
          targetSets: item.targetSets,
          targetReps: item.targetReps,
        }
      })
      await api.createWorkout({ title: workout.title, items })
      setSavedTitles((prev) => [...prev, workout.title])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingIndex(null)
    }
  }

  if (!plan) return null

  return (
    <>
      <h3>{heading}</h3>
      {plan.summary && <p>{plan.summary}</p>}
      {error && <p className="error">{error}</p>}

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
            <button type="button" disabled={savingIndex === index} onClick={() => handleSave(workout, index)}>
              {savingIndex === index ? 'Сохраняем...' : 'Сохранить в мои тренировки'}
            </button>
          )}
        </div>
      ))}

      {savedTitles.length > 0 && (
        <button type="button" className="button" onClick={() => navigate('/workouts')}>
          Перейти к моим тренировкам
        </button>
      )}
    </>
  )
}
