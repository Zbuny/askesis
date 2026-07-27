import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { useAuth } from '../context/AuthContext.jsx'
import { exerciseName } from '../utils/translate.js'
import { programItems } from '../utils/programItems.js'
import BackLink from '../components/BackLink.jsx'

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [program, setProgram] = useState(null)
  const [exercises, setExercises] = useState([])
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    Promise.all([api.getProgram({ id }), api.listExercises()])
      .then(([programData, exerciseList]) => {
        setProgram(programData)
        setExercises(exerciseList)
      })
      .catch((e) => setError(e.message))
  }, [id])

  async function handleStart() {
    setError(null)
    setStarting(true)
    try {
      const result = await api.startProgram({ programId: id })
      navigate(`/workouts/${result.id}`)
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  if (error) return <p>Ошибка: {error}</p>
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
          {starting ? 'Создаём тренировку...' : 'Начать программу'}
        </button>
      ) : (
        <p><Link to="/login">Войдите</Link>, чтобы начать эту программу.</p>
      )}
      {error && <p className="error">{error}</p>}

      <ul className="program-exercise-list">
        {items.map((item) => {
          const ex = exerciseById.get(item.exerciseId)
          return (
            <li key={item.exerciseId}>
              <Link to={`/exercises/${item.exerciseId}`}>
                <span className="program-exercise-list__name">{ex ? exerciseName(ex) : item.exerciseId}</span>
                <small>{item.targetSets}×{item.targetReps}</small>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
