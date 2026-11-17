import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { useAsyncData } from '../hooks/useAsyncData.js'
import TiltCard from '../components/TiltCard.jsx'
import { EmptyState, PageError, PageLoading } from '../components/PageState.jsx'
import { pluralRu, translateMuscle } from '../utils/translate.js'
import { estimateMinutes, workoutMuscles } from '../utils/planner.js'
import { exerciseFrames } from '../utils/exerciseFrames.js'

// Сюда приходят, чтобы начать тренировку, поэтому список собственных
// тренировок — главное на экране и стоит первым. Создание новой — одна
// кнопка в шапке, а ИИ-варианты ниже как дополнительные пути: раньше три
// равных по весу призыва стояли над списком и спорили за внимание.
export default function Workouts() {
  const { data: workouts, loading, error, reload } = useAsyncData(api.listMyWorkouts, [])
  // Каталог нужен только для картинок и групп мышц на карточках. Он кэшируется
  // на сутки (api/cache.js), так что обычно приходит без запроса; без него
  // карточки просто остаются текстовыми.
  const [exercises, setExercises] = useState([])
  useEffect(() => {
    api.listExercises().then(setExercises).catch(() => {})
  }, [])
  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])

  if (loading) return <PageLoading label="Загружаем тренировки" />
  if (error) return <PageError message={error} onRetry={reload} backTo="/dashboard" />

  return (
    <section>
      <div className="page-head">
        <h1>Мои тренировки</h1>
        {workouts.length > 0 && (
          <Link to="/workouts/new" className="button">+ Собрать тренировку</Link>
        )}
      </div>

      {workouts.length === 0 ? (
        <EmptyState
          title="Пока нет ни одной тренировки"
          text="Соберите свою из библиотеки, начните готовую программу или попросите ИИ-тренера составить план под цель."
        >
          <Link to="/workouts/new" className="button">Собрать тренировку</Link>
          <Link to="/programs" className="button--ghost">Готовые программы</Link>
        </EmptyState>
      ) : (
        <div className="program-grid">
          {workouts.map((w) => {
            const count = w.items?.length || 0
            const muscles = workoutMuscles(w, exerciseById, translateMuscle)
            // Миниатюры первых упражнений — список тренировок узнаётся по
            // картинкам быстрее, чем по названиям вроде «День 1» и «День 2».
            const thumbs = (w.items || [])
              .map((item) => exerciseFrames(exerciseById.get(item.exerciseId))[0])
              .filter(Boolean)
              .slice(0, 3)
            return (
              <TiltCard as={Link} to={`/workouts/${w.id}`} className="program-card workout-card" key={w.id}>
                {thumbs.length > 0 && (
                  <span className="workout-card__thumbs" aria-hidden="true">
                    {thumbs.map((src) => (
                      <img key={src} src={src} alt="" loading="lazy" />
                    ))}
                  </span>
                )}
                <h3>{w.title}</h3>
                {muscles.length > 0 && (
                  <span className="chips">
                    {muscles.map((muscle) => (
                      <span key={muscle} className="chip">{muscle}</span>
                    ))}
                  </span>
                )}
                <p>
                  {count} {pluralRu(count, 'упражнение', 'упражнения', 'упражнений')}
                  {estimateMinutes(w) > 0 && ` · ~${estimateMinutes(w)} мин`}
                </p>
              </TiltCard>
            )
          })}
        </div>
      )}

      <span className="eyebrow section-label">С помощью ИИ</span>
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
    </section>
  )
}
