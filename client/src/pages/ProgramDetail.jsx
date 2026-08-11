import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { exerciseName } from '../utils/translate.js'
import { formatReps, programItems } from '../utils/programItems.js'
import BackLink from '../components/BackLink.jsx'

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [program, setProgram] = useState(null)
  const [exercises, setExercises] = useState([])
  const [existingWorkout, setExistingWorkout] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const { busy: starting, error: startError, run } = useAsyncAction()

  useEffect(() => {
    const tasks = [api.getProgram({ id }), api.listExercises()]
    if (user) tasks.push(api.findWorkoutFromProgram({ programId: id }))
    Promise.all(tasks)
      .then(([programData, exerciseList, workout]) => {
        setProgram(programData)
        setExercises(exerciseList)
        setExistingWorkout(workout || null)
      })
      .catch((e) => setLoadError(e.message))
  }, [id, user])

  async function handleStart() {
    // Уже есть личная тренировка из этой программы — не плодим копии молча,
    // даём выбор: открыть существующую или всё же завести ещё одну.
    if (existingWorkout) {
      const openExisting = window.confirm(
        `Вы уже начинали эту программу — тренировка «${existingWorkout.title}» уже есть. Открыть её?\n\nНажмите «Отмена», чтобы создать ещё одну.`,
      )
      if (openExisting) {
        navigate(`/workouts/${existingWorkout.id}`)
        return
      }
    }
    try {
      const result = await run(() => api.startProgram({ programId: id }))
      navigate(`/workouts/${result.id}`)
    } catch {
      // ошибка уже показана ниже через startError
    }
  }

  if (loadError) return <p>Ошибка: {loadError}</p>
  if (!program) return <p>Загрузка...</p>

  const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]))
  const items = programItems(program)

  return (
    <section>
      <BackLink fallback="/programs" label="К программам" />
      <h2>{program.title}</h2>
      <p>{program.level} · {program.duration}</p>
      <p>{program.description}</p>

      {user ? (
        <button type="button" className="button" onClick={handleStart} disabled={starting || items.length === 0}>
          {starting ? 'Создаём тренировку...' : existingWorkout ? 'Открыть или начать заново' : 'Начать программу'}
        </button>
      ) : (
        <p><Link to="/login">Войдите</Link>, чтобы начать эту программу.</p>
      )}
      {startError && <p className="error">{startError}</p>}

      <ul className="program-exercise-list">
        {items.map((item) => {
          const ex = exerciseById.get(item.exerciseId)
          return (
            <li key={item.exerciseId}>
              <Link to={`/exercises/${item.exerciseId}`}>
                <span className="program-exercise-list__name">{ex ? exerciseName(ex) : item.exerciseId}</span>
                <small>{item.targetSets}×{formatReps(item)}</small>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
