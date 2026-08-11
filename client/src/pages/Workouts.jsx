import { Link } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { useAsyncData } from '../hooks/useAsyncData.js'
import TiltCard from '../components/TiltCard.jsx'
import { pluralRu } from '../utils/translate.js'

export default function Workouts() {
  const { data: workouts, loading, error } = useAsyncData(api.listMyWorkouts, [])

  if (error) return <p>Ошибка: {error}</p>
  if (loading) return <p>Загрузка...</p>

  return (
    <section>
      <h2>Мои тренировки</h2>
      <div className="hero__actions">
        <Link to="/workouts/new" className="button">+ Собрать тренировку</Link>
      </div>

      <div className="ai-actions">
        <Link to="/workouts/ai" className="ai-action">
          <span className="ai-action__glow" aria-hidden="true" />
          <span className="ai-action__body">
            <span className="ai-action__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span className="ai-action__text">
              <strong>Собрать с ИИ-тренером</strong>
              <small>Пять вопросов — и готовая программа</small>
            </span>
            <span className="ai-action__arrow" aria-hidden="true">→</span>
          </span>
        </Link>

        <Link to="/workouts/chat" className="ai-action">
          <span className="ai-action__glow" aria-hidden="true" />
          <span className="ai-action__body">
            <span className="ai-action__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
                <path d="M9 11h6M9 15h4" />
              </svg>
            </span>
            <span className="ai-action__text">
              <strong>Спросить тренера</strong>
              <small>Свободный вопрос про технику и план</small>
            </span>
            <span className="ai-action__arrow" aria-hidden="true">→</span>
          </span>
        </Link>
      </div>

      {workouts.length === 0 && <p>Пока нет ни одной тренировки.</p>}

      <div className="program-grid">
        {workouts.map((w) => {
          const count = w.items?.length || 0
          return (
            <TiltCard as={Link} to={`/workouts/${w.id}`} className="program-card" key={w.id}>
              <h3>{w.title}</h3>
              <p>{count} {pluralRu(count, 'упражнение', 'упражнения', 'упражнений')}</p>
            </TiltCard>
          )
        })}
      </div>
    </section>
  )
}
