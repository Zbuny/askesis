import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/firestore.js'

export default function Workouts() {
  const [workouts, setWorkouts] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listMyWorkouts()
      .then(setWorkouts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) return <p>Ошибка: {error}</p>
  if (loading) return <p>Загрузка...</p>

  return (
    <section>
      <h2>Мои тренировки</h2>
      <div className="hero__actions">
        <Link to="/workouts/new" className="button">+ Собрать тренировку</Link>
        <Link to="/workouts/ai" className="button--ghost">Собрать с ИИ-тренером</Link>
      </div>

      {workouts.length === 0 && <p>Пока нет ни одной тренировки.</p>}

      <ul className="admin-list">
        {workouts.map((w) => (
          <li key={w.id}>
            <Link to={`/workouts/${w.id}`}>{w.title}</Link>
            <span>{w.items?.length || 0} упражнений</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
