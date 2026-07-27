import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import ExerciseAnimation from '../components/ExerciseAnimation.jsx'
import BackLink from '../components/BackLink.jsx'
import {
  exerciseInstructions,
  exerciseName,
  translateCategory,
  translateEquipment,
  translateLevel,
  translateMuscle,
} from '../utils/translate.js'

export default function ExerciseDetail() {
  const { id } = useParams()
  const [exercise, setExercise] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setExercise(null)
    setError(null)
    api.getExercise({ id }).then(setExercise).catch((e) => setError(e.message))
  }, [id])

  if (error) return <p>Ошибка: {error}</p>
  if (!exercise) return <p>Загрузка...</p>

  const steps = exerciseInstructions(exercise)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  const secondary = (exercise.secondaryMuscles || []).map(translateMuscle)

  return (
    <section className="exercise-detail">
      <BackLink fallback="/exercises" label="К библиотеке" />

      <div className="exercise-detail__layout">
        {exercise.imageUrl && (
          <div className="exercise-detail__media">
            <ExerciseAnimation exercise={exercise} alt={exerciseName(exercise)} />
          </div>
        )}

        <div className="exercise-detail__info">
          <h2>{exerciseName(exercise)}</h2>

          <div className="exercise-detail__tags">
            {exercise.muscleGroup && <span className="tag">{translateMuscle(exercise.muscleGroup)}</span>}
            {exercise.equipment && <span className="tag">{translateEquipment(exercise.equipment)}</span>}
            {exercise.level && <span className="tag">{translateLevel(exercise.level)}</span>}
            {exercise.category && <span className="tag">{translateCategory(exercise.category)}</span>}
          </div>

          {secondary.length > 0 && (
            <p className="exercise-detail__secondary">
              Дополнительно: {secondary.join(', ')}
            </p>
          )}

          <h3>Как выполнять</h3>
          {steps.length === 0 && <p>Инструкция пока не добавлена.</p>}
          {steps.length > 0 && (
            <ol className="exercise-detail__steps">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
