import { useEffect, useState } from 'react'
import { api } from '../api/firestore.js'
import ProgramCard from '../components/ProgramCard.jsx'

export default function Programs() {
  const [programs, setPrograms] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listPrograms()
      .then(setPrograms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) return <p>Не удалось загрузить программы: {error}</p>
  if (loading) return <p>Загрузка...</p>

  return (
    <section>
      <h2>Программы тренировок</h2>
      {programs.length === 0 && <p>Пока ни одной программы не добавлено.</p>}
      <div className="program-grid">
        {programs.map((p) => (
          <ProgramCard key={p.id} program={p} />
        ))}
      </div>
    </section>
  )
}
