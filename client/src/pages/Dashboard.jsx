import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/firestore.js'
import { pluralRu, translateMuscle } from '../utils/translate.js'
import { gamificationSummary, weeklyGoalFrom } from '../utils/gamification.js'
import { streakSummary } from '../utils/streak.js'
import { evaluateAchievements } from '../utils/achievements.js'
import { recordGain, recordList } from '../utils/records.js'
import { estimateMinutes, nextAfter, suggestTodayWorkout, workoutMuscles } from '../utils/planner.js'
import { sessionVolume } from '../utils/workoutLog.js'
import { weekKey } from '../utils/dates.js'
import { coachFacts, coachInsights } from '../utils/coach.js'
import CoachCard from '../components/CoachCard.jsx'

// Дашборд отвечает на один вопрос: что делать сегодня. Поэтому карточка
// тренировки — единственный крупный призыв к действию, а всё остальное
// (уровень, серия, рекорды) стоит ниже и лишь объясняет, зачем возвращаться.

function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 5) return 'Доброй ночи'
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export default function Dashboard() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [foodLogs, setFoodLogs] = useState([])
  const [exercises, setExercises] = useState([])
  const [goals, setGoals] = useState([])
  const [checkins, setCheckins] = useState([])
  const [profile, setProfile] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Ждём только то, без чего экран бессмысленен. Каталог упражнений на
    // холодном кэше — это 873 документа, и он нужен лишь для подписи групп
    // мышц под названием тренировки: ради неё держать человека на каркасе
    // незачем, поэтому он и питание догружаются отдельно.
    Promise.all([api.listWorkoutHistory({ pageSize: 200 }), api.listMyWorkouts()])
      .then(([loadedHistory, loadedWorkouts]) => {
        setHistory(loadedHistory)
        setWorkouts(loadedWorkouts)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    api.listFoodHistory({ pageSize: 100 }).then(setFoodLogs).catch(() => {})
    api.listExercises().then(setExercises).catch(() => {})
    // Уровень задаёт шаг прибавки веса, а значит и то, какие упражнения
    // тренер считает готовыми к прибавке. Не критичен: без него прогрессия
    // считает по среднему, а сам тренер об этом отдельно и напомнит.
    api.getMyProfileData().then(setProfile).catch(() => {})
    api.listGoals().then(setGoals).catch(() => {})
    api.listCheckins({ pageSize: 14 }).then(setCheckins).catch(() => {})
  }, [])

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])
  // Недельная цель — та частота, которую человек назвал в онбординге, а не
  // общая тройка: цель, в которую он сам не верит, не мотивирует.
  const weeklyGoal = useMemo(() => weeklyGoalFrom(profile), [profile])
  const summary = useMemo(
    () => gamificationSummary({ history, foodLogs, weeklyGoal }),
    [history, foodLogs, weeklyGoal],
  )
  const streak = useMemo(() => streakSummary(history.map((s) => s.date)), [history])
  const achievements = useMemo(() => evaluateAchievements({ history, foodLogs }), [history, foodLogs])
  const today = useMemo(() => suggestTodayWorkout(workouts, history), [workouts, history])
  const upNext = useMemo(
    () => (today ? nextAfter(workouts, history, today.workout.id) : null),
    [workouts, history, today],
  )

  const recentRecords = useMemo(() => recordList(history).slice(0, 3), [history])

  // Наблюдения тренера считаются здесь же, из уже загруженных данных: ни
  // одного лишнего запроса и ни одной цифры, которой не было бы на экране.
  const insights = useMemo(
    () =>
      coachInsights({
        history,
        workouts,
        exerciseById,
        foodLogs,
        goals,
        checkins,
        level: profile.level,
        weeklyGoal,
      }),
    [history, workouts, exerciseById, foodLogs, goals, checkins, profile.level, weeklyGoal],
  )
  const facts = useMemo(
    () => coachFacts({ insights, summary, streak, week: summary.week }),
    [insights, summary, streak],
  )

  const thisWeek = useMemo(() => {
    const key = weekKey(new Date())
    const sessions = history.filter((s) => weekKey(s.date) === key)
    return {
      sessions: sessions.length,
      volume: sessions.reduce((sum, s) => sum + sessionVolume(s), 0),
      minutes: sessions.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0),
    }
  }, [history])

  if (loading) {
    return (
      <section>
        <div className="skeleton skeleton--hero" />
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h2>Обзор</h2>
        <p className="error">{error}</p>
      </section>
    )
  }

  const muscles = today ? workoutMuscles(today.workout, exerciseById, translateMuscle) : []
  const minutes = today ? estimateMinutes(today.workout) : 0

  return (
    <section className="dashboard">
      <div className="glass-hero">
        <div className="glass-hero__glow" aria-hidden="true" />
        <div className="glass-hero__content">
          <span className="eyebrow">Askesis · Обзор</span>
          <h2>{greeting()}, {user?.displayName || 'спортсмен'}</h2>

          <div className="level-row">
            <div className="level-row__info">
              <strong>Уровень {summary.level}</strong>
              <span>{summary.title}</span>
            </div>
            <div className="level-bar" role="progressbar" aria-valuenow={summary.percent} aria-valuemin={0} aria-valuemax={100}>
              <span className="level-bar__fill" style={{ width: `${summary.percent}%` }} />
            </div>
            <span className="level-row__xp">
              {summary.xpInLevel.toLocaleString('ru-RU')} / {summary.xpForNext.toLocaleString('ru-RU')} XP
            </span>
          </div>

          {streak.current > 0 && (
            <p className="streak-line">
              <strong>{streak.current} {pluralRu(streak.current, 'день', 'дня', 'дней')} подряд</strong>
              {streak.next && <span> · до {streak.next.target} осталось {streak.next.remaining}</span>}
            </p>
          )}
        </div>
      </div>

      {/* Главное действие экрана. Всё, что ниже, — объяснение, зачем его делать. */}
      <div className="today-card">
        <span className="eyebrow">Тренировка на сегодня</span>
        {today ? (
          <>
            <h3>{today.workout.title}</h3>
            {muscles.length > 0 && <p className="today-card__muscles">{muscles.join(' · ')}</p>}
            <p className="today-card__meta">
              {today.workout.items?.length || 0} {pluralRu(today.workout.items?.length || 0, 'упражнение', 'упражнения', 'упражнений')}
              {minutes > 0 && ` · ~${minutes} мин`}
            </p>
            {today.doneToday && <p className="today-card__done">Сегодня уже сделана — можно повторить или взять другую.</p>}
            {!today.doneToday && today.lastDate && (
              <p className="today-card__last">
                Последний раз {new Date(today.lastDate).toLocaleDateString('ru-RU')}
              </p>
            )}
            <Link to={`/workouts/${today.workout.id}`} className="button today-card__cta">
              {today.doneToday ? 'Открыть тренировку' : 'Начать тренировку'}
            </Link>
            {upNext && <p className="today-card__next">Дальше: {upNext.title}</p>}
          </>
        ) : (
          <>
            <h3>Тренировок пока нет</h3>
            <p className="today-card__muscles">
              Соберите первую — или попросите ИИ-тренера составить программу под вашу цель.
            </p>
            <Link to="/workouts/new" className="button today-card__cta">Собрать тренировку</Link>
            <p className="today-card__next">
              <Link to="/workouts/ai">Составить с ИИ →</Link>
            </p>
          </>
        )}
      </div>

      {/* Тренер стоит сразу под главным действием: карточка выше говорит, что
          делать, а он — почему именно это и на что смотреть по дороге. */}
      <CoachCard insights={insights} facts={facts} kind="dashboard" />

      <div className="dashboard__section-head">
        <h3>Эта неделя</h3>
        <Link to="/statistics">Вся статистика →</Link>
      </div>
      <div className="week-grid">
        <div className="glass-card">
          <strong>{summary.week.done} / {summary.week.goal}</strong>
          <span>тренировок</span>
          <div className="level-bar level-bar--slim">
            <span className="level-bar__fill" style={{ width: `${summary.week.percent}%` }} />
          </div>
        </div>
        <div className="glass-card">
          <strong>{Math.round(thisWeek.volume).toLocaleString('ru-RU')}</strong>
          <span>кг объёма</span>
        </div>
        <div className="glass-card">
          <strong>{thisWeek.minutes || '—'}</strong>
          <span>минут в зале</span>
        </div>
        <div className="glass-card">
          <strong>{achievements.unlocked} / {achievements.total}</strong>
          <span>достижений</span>
        </div>
      </div>

      {recentRecords.length > 0 && (
        <>
          <h3>Личные рекорды</h3>
          <div className="record-grid">
            {recentRecords.map((record) => {
              const gain = recordGain(record)
              return (
                <div key={record.exerciseId} className="record-card">
                  <span className="record-card__name">{record.name}</span>
                  <strong>{record.weight} кг × {record.reps}</strong>
                  {gain ? <span className="record-card__gain">+{gain} кг</span> : <span className="record-card__gain record-card__gain--first">первый рекорд</span>}
                  <time>{new Date(record.date).toLocaleDateString('ru-RU')}</time>
                </div>
              )
            })}
          </div>
        </>
      )}

      <h3>Достижения</h3>
      <div className="achievement-grid">
        {achievements.items.map((item) => (
          <div key={item.key} className={`achievement${item.unlocked ? ' is-unlocked' : ''}`} title={item.hint}>
            <span className="achievement__title">{item.title}</span>
            <span className="achievement__hint">{item.hint}</span>
            {item.progress && (
              <div className="level-bar level-bar--slim">
                <span className="level-bar__fill" style={{ width: `${item.progress.percent}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {history.length === 0 && (
        <p className="dashboard__empty">
          Пока нет ни одной записи. Отметьте первое выполнение — и здесь появятся серия, рекорды и уровень.
        </p>
      )}
    </section>
  )
}
