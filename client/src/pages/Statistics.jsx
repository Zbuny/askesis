import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/firestore.js'
import { pluralRu } from '../utils/translate.js'
import { PERIODS, daySummary, filterByPeriod, kpis, muscleVolume, strengthSeries, trainedExercises } from '../utils/statistics.js'
import { streakSummary } from '../utils/streak.js'
import { recordGain, recordList } from '../utils/records.js'
import { localDayKey } from '../utils/dates.js'
import { goalList } from '../utils/goals.js'
import ProgressChart from '../components/ProgressChart.jsx'
import TrainingCalendar from '../components/TrainingCalendar.jsx'
import GoalList from '../components/GoalList.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useConfirm } from '../hooks/useConfirm.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'

// Экран отвечает на вопрос «насколько я продвинулся». Поэтому наверху —
// крупные числа и серия, а разборы (календарь, график силы, объём по
// группам) идут ниже: их смотрят, когда общая картина уже понятна.

export default function Statistics() {
  const [history, setHistory] = useState([])
  const [exercises, setExercises] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { busy: goalBusy, run: runGoal } = useAsyncAction()
  const { ask, confirmProps } = useConfirm()

  const [period, setPeriod] = useState('month')
  const [exerciseId, setExerciseId] = useState('')
  // Календарь нумерует дни по-своему, а сводка ищет по ключу из dates.js —
  // держим оба, чтобы не пересобирать чужой формат строкой.
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    // Экран держится на журнале — его и ждём. Каталог упражнений нужен
    // только для подписей групп мышц, но на холодном кэше это 873
    // документа: если ждать и его, человек несколько секунд смотрит на
    // каркас вместо готовых цифр. Поэтому он догружается отдельно.
    api
      .listWorkoutHistory({ pageSize: 300 })
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    api.listExercises().then(setExercises).catch(() => {})
    api.listGoals().then(setGoals).catch(() => {})
  }, [])

  async function handleCreateGoal(goal) {
    const saved = await runGoal(() => api.createGoal(goal))
    setGoals((prev) => [{ id: saved.id, ...goal }, ...prev])
  }

  async function handleDeleteGoal(goal) {
    const confirmed = await ask({
      title: 'Убрать цель?',
      message: `«${goal.exerciseName}» исчезнет из списка. Рекорды и история останутся на месте.`,
    })
    if (!confirmed) return
    await runGoal(() => api.deleteGoal({ id: goal.id }))
    setGoals((prev) => prev.filter((g) => g.id !== goal.id))
  }

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])
  const scoped = useMemo(() => filterByPeriod(history, period), [history, period])
  const stats = useMemo(() => kpis(scoped), [scoped])
  // Серия и рекорды считаются по всей истории: за выбранный период они
  // означали бы не то, что человек ожидает увидеть под словом «рекорд».
  const streak = useMemo(() => streakSummary(history.map((s) => s.date)), [history])
  const records = useMemo(() => recordList(history), [history])
  const goalRows = useMemo(() => goalList(goals, history), [goals, history])
  const muscles = useMemo(() => muscleVolume(scoped, exerciseById), [scoped, exerciseById])
  const available = useMemo(() => trainedExercises(history), [history])

  // Длительность есть не у каждой тренировки: таймер включают не всегда.
  // Считаем график только по тем, где он был, — иначе провалы к нулю
  // читались бы как «тренировка на ноль минут».
  const durationSeries = useMemo(
    () =>
      scoped
        .filter((session) => Number(session.durationMinutes) > 0)
        .map((session) => ({
          value: Number(session.durationMinutes),
          label: new Date(session.date).toLocaleDateString('ru-RU'),
          date: session.date,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [scoped],
  )

  const currentExerciseId = exerciseId || available[0]?.exerciseId || ''
  const series = useMemo(() => strengthSeries(history, currentExerciseId), [history, currentExerciseId])
  const day = useMemo(
    () => (selectedDay ? daySummary(history, selectedDay.dayKey) : null),
    [history, selectedDay],
  )

  if (loading) {
    return (
      <section>
        <div className="skeleton skeleton--hero" />
        <div className="skeleton skeleton--card" />
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h2>Статистика</h2>
        <p className="error">{error}</p>
      </section>
    )
  }

  if (history.length === 0) {
    return (
      <section>
        <h2>Статистика</h2>
        <p>
          Пока нечего показывать. Отметьте первое выполнение на странице тренировки — и здесь появятся
          серия, рекорды, объём и график силы.
        </p>
      </section>
    )
  }

  return (
    <section className="statistics">
      <div className="statistics__head">
        <h2>Статистика</h2>
        <div className="period-switch" role="group" aria-label="Период">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={period === p.key ? 'is-active' : ''}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="streak-card">
        <span className="eyebrow">Серия</span>
        <strong>{streak.current}</strong>
        <span className="streak-card__unit">{pluralRu(streak.current, 'день', 'дня', 'дней')} подряд</span>
        <span className="streak-card__record">Рекорд — {streak.best} {pluralRu(streak.best, 'день', 'дня', 'дней')}</span>
      </div>

      <div className="kpi-grid">
        <div className="glass-card">
          <strong>{stats.sessions}</strong>
          <span>{pluralRu(stats.sessions, 'тренировка', 'тренировки', 'тренировок')}</span>
        </div>
        <div className="glass-card">
          <strong>{stats.hours}</strong>
          <span>часов в зале</span>
        </div>
        <div className="glass-card">
          <strong>{stats.sets}</strong>
          <span>{pluralRu(stats.sets, 'подход', 'подхода', 'подходов')}</span>
        </div>
        <div className="glass-card">
          <strong>{stats.volume.toLocaleString('ru-RU')}</strong>
          <span>кг объёма</span>
        </div>
        <div className="glass-card">
          <strong>{stats.avgMinutes || '—'}</strong>
          <span>минут в среднем</span>
        </div>
      </div>

      <h3>Календарь активности</h3>
      <TrainingCalendar
        sessions={history}
        selectedKey={selectedDay?.key || null}
        onSelectDay={(date, key) => setSelectedDay({ key, dayKey: localDayKey(date) })}
      />

      {day && (
        <div className="day-card">
          <div className="day-card__head">
            <strong>{new Date(day.sessions[0].date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</strong>
            <button type="button" onClick={() => setSelectedDay(null)} aria-label="Закрыть разбор дня">×</button>
          </div>
          {day.titles.length > 0 && <p className="day-card__title">{day.titles.join(' · ')}</p>}
          <div className="day-card__stats">
            <span>{day.exercises} {pluralRu(day.exercises, 'упражнение', 'упражнения', 'упражнений')}</span>
            <span>{day.sets} {pluralRu(day.sets, 'подход', 'подхода', 'подходов')}</span>
            <span>{day.volume.toLocaleString('ru-RU')} кг</span>
            {day.minutes > 0 && <span>{day.minutes} мин</span>}
          </div>
        </div>
      )}

      <h3>Прогресс силы</h3>
      {available.length === 0 ? (
        <p>Запишите вес хотя бы в одном упражнении — тогда появится график.</p>
      ) : (
        <>
          <select
            className="progress-chart-select"
            value={currentExerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            aria-label="Упражнение для графика"
          >
            {available.map((ex) => (
              <option key={ex.exerciseId} value={ex.exerciseId}>{ex.name}</option>
            ))}
          </select>
          {series.length > 1 ? (
            <ProgressChart
              points={series.map((p) => ({
                value: p.weight,
                label: new Date(p.date).toLocaleDateString('ru-RU'),
              }))}
              unit="кг"
            />
          ) : (
            <p>Для графика нужна хотя бы вторая тренировка с этим упражнением.</p>
          )}
        </>
      )}

      <h3>Время в зале</h3>
      {durationSeries.length < 2 ? (
        <p>
          Засекайте время кнопкой «Начать тренировку» на странице тренировки — по
          двум замерам и больше здесь появится график.
        </p>
      ) : (
        <ProgressChart points={durationSeries} unit="мин" />
      )}

      <h3>Объём по группам мышц</h3>
      {muscles.length === 0 ? (
        <p>За выбранный период записей нет.</p>
      ) : (
        <div className="muscle-bars">
          {muscles.map((muscle) => (
            <div key={muscle.key} className="muscle-bar">
              <span className="muscle-bar__label">{muscle.label}</span>
              <div className="muscle-bar__track">
                <span className="muscle-bar__fill" style={{ width: `${muscle.percent}%` }} />
              </div>
              <span className="muscle-bar__value">
                {muscle.volume.toLocaleString('ru-RU')} кг · {muscle.sets} {pluralRu(muscle.sets, 'подход', 'подхода', 'подходов')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Цели стоят перед рекордами намеренно: рекорд — то, что уже случилось,
          цель — то, ради чего человек сюда пришёл. */}
      <h3>Мои цели</h3>
      <GoalList
        goals={goalRows}
        available={available}
        history={history}
        onCreate={handleCreateGoal}
        onDelete={handleDeleteGoal}
        busy={goalBusy}
      />

      <h3>Личные рекорды</h3>
      {records.length === 0 ? (
        <p>Рекорды появятся, как только вы запишете вес в упражнении.</p>
      ) : (
        <div className="record-grid">
          {records.slice(0, 9).map((record) => {
            const gain = recordGain(record)
            return (
              <div key={record.exerciseId} className="record-card">
                <span className="record-card__name">{record.name}</span>
                <strong>{record.weight} кг × {record.reps}</strong>
                {record.oneRepMax && <span className="record-card__name">разовый максимум ≈ {record.oneRepMax} кг</span>}
                {gain ? <span className="record-card__gain">+{gain} кг</span> : <span className="record-card__gain record-card__gain--first">первый рекорд</span>}
                <time>{new Date(record.date).toLocaleDateString('ru-RU')}</time>
              </div>
            )
          })}
        </div>
      )}

      <h3>Последние тренировки</h3>
      <div className="history-list">
        {history.slice(0, 5).map((session) => (
          <div key={session.id} className="history-entry">
            <time>
              {new Date(session.date).toLocaleString('ru-RU')}
              {session.durationMinutes ? ` · ${session.durationMinutes} мин` : ''}
            </time>
            <p>{session.workoutTitle}</p>
          </div>
        ))}
      </div>

      <ConfirmDialog {...confirmProps} />
    </section>
  )
}
