import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/firestore.js'
import ProgressChart from '../components/ProgressChart.jsx'
import TrainingHeatmap from '../components/TrainingHeatmap.jsx'
import { pluralRu } from '../utils/translate.js'

const emptyProfileData = { weight: '', height: '', age: '' }

export default function Profile() {
  const { user, isAdmin, claimAdmin } = useAuth()
  const [claimError, setClaimError] = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)

  const [profileData, setProfileData] = useState(emptyProfileData)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')

  useEffect(() => {
    api.listWorkoutHistory({}).then(setHistory).catch((e) => setError(e.message))
    api
      .getMyProfileData()
      .then((data) =>
        setProfileData({
          weight: data.weight ?? '',
          height: data.height ?? '',
          age: data.age ?? '',
        }),
      )
      .catch((e) => setError(e.message))
  }, [])

  const stats = useMemo(() => {
    const totalSessions = history.length
    const totalVolume = history.reduce(
      (sum, session) => sum + session.entries.reduce((s, e) => s + e.weight * e.reps, 0),
      0,
    )
    const lastSession = history[0]?.date

    const timed = history.filter((session) => session.durationMinutes > 0)
    const totalMinutes = timed.reduce((sum, session) => sum + session.durationMinutes, 0)
    const avgMinutes = timed.length ? Math.round(totalMinutes / timed.length) : 0

    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 28)
    const lastMonth = history.filter((session) => new Date(session.date) >= monthAgo)
    const perWeek = (lastMonth.length / 4).toFixed(1)

    // Серия — сколько недель подряд, считая от текущей, была хотя бы одна тренировка.
    const weekKeys = new Set(
      history.map((session) => {
        const date = new Date(session.date)
        const monday = new Date(date)
        monday.setHours(0, 0, 0, 0)
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
        return monday.toDateString()
      }),
    )
    let streak = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7))
    while (weekKeys.has(cursor.toDateString())) {
      streak += 1
      cursor.setDate(cursor.getDate() - 7)
    }

    return { totalSessions, totalVolume, lastSession, totalMinutes, avgMinutes, perWeek, streak }
  }, [history])

  const durationSeries = useMemo(
    () =>
      history
        .filter((session) => session.durationMinutes > 0)
        .map((session) => ({ date: session.date, value: session.durationMinutes }))
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [history],
  )

  const exerciseSeries = useMemo(() => {
    const map = new Map()
    history.forEach((session) => {
      session.entries.forEach((entry) => {
        if (!entry.weight) return
        if (!map.has(entry.exerciseId)) map.set(entry.exerciseId, { name: entry.exerciseName, points: [] })
        map.get(entry.exerciseId).points.push({ date: session.date, value: entry.weight })
      })
    })
    const series = [...map.entries()].map(([exerciseId, s]) => ({
      exerciseId,
      name: s.name,
      points: [...s.points].sort((a, b) => new Date(a.date) - new Date(b.date)),
    }))
    series.sort((a, b) => b.points.length - a.points.length)
    return series
  }, [history])

  const selectedSeries =
    exerciseSeries.find((s) => s.exerciseId === selectedExerciseId) || exerciseSeries[0]

  async function handleClaimAdmin() {
    setClaimError(null)
    setClaiming(true)
    try {
      await claimAdmin()
    } catch (err) {
      setClaimError(err.message)
    } finally {
      setClaiming(false)
    }
  }

  async function handleSaveProfileData(e) {
    e.preventDefault()
    setError(null)
    setProfileSaving(true)
    setProfileSaved(false)
    try {
      await api.updateMyProfileData({
        weight: profileData.weight === '' ? null : Number(profileData.weight),
        height: profileData.height === '' ? null : Number(profileData.height),
        age: profileData.age === '' ? null : Number(profileData.age),
      })
      setProfileSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <section>
      <div className="glass-hero">
        <div className="glass-hero__glow" aria-hidden="true" />
        <div className="glass-hero__content">
          <span className="eyebrow">Askesis · Личный кабинет</span>
          <h2>Привет, {user?.displayName || 'спортсмен'}</h2>
          <p>{stats.streak > 0
            ? `${stats.streak} ${pluralRu(stats.streak, 'неделя', 'недели', 'недель')} подряд без пропусков. Держите темп.`
            : 'Запишите первую тренировку — статистика начнёт собираться сама.'}</p>

          <div className="glass-cards">
            <div className="glass-card">
              <strong>{stats.totalSessions}</strong>
              <span>тренировок</span>
            </div>
            <div className="glass-card">
              <strong>{stats.perWeek}</strong>
              <span>в неделю</span>
            </div>
            <div className="glass-card">
              <strong>{Math.floor(stats.totalMinutes / 60)} ч</strong>
              <span>в зале всего</span>
            </div>
            <div className="glass-card">
              <strong>{stats.avgMinutes || '—'}{stats.avgMinutes ? ' мин' : ''}</strong>
              <span>средняя тренировка</span>
            </div>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div>
          <button type="button" onClick={handleClaimAdmin} disabled={claiming}>
            Стать администратором
          </button>
          {claimError && <p className="error">{claimError}</p>}
        </div>
      )}

      <h3>Мои данные</h3>
      <form className="admin-form" onSubmit={handleSaveProfileData}>
        <input
          type="number"
          placeholder="Вес, кг"
          value={profileData.weight}
          onChange={(e) => {
            setProfileSaved(false)
            setProfileData({ ...profileData, weight: e.target.value })
          }}
        />
        <input
          type="number"
          placeholder="Рост, см"
          value={profileData.height}
          onChange={(e) => {
            setProfileSaved(false)
            setProfileData({ ...profileData, height: e.target.value })
          }}
        />
        <input
          type="number"
          placeholder="Возраст"
          value={profileData.age}
          onChange={(e) => {
            setProfileSaved(false)
            setProfileData({ ...profileData, age: e.target.value })
          }}
        />
        <div className="admin-form__actions">
          <button type="submit" disabled={profileSaving}>Сохранить</button>
          {profileSaved && <span className="eyebrow">Сохранено</span>}
        </div>
      </form>

      <h3>Прогресс</h3>
      {error && <p className="error">{error}</p>}
      <div className="stat-cards">
        <div className="stat-card">
          <strong>{stats.totalVolume.toLocaleString('ru-RU')}</strong>
          кг суммарного объёма
        </div>
        <div className="stat-card">
          <strong>{stats.lastSession ? new Date(stats.lastSession).toLocaleDateString('ru-RU') : '—'}</strong>
          последняя тренировка
        </div>
        <div className="stat-card">
          <strong>{stats.streak}</strong>
          {pluralRu(stats.streak, 'неделя', 'недели', 'недель')} подряд
        </div>
      </div>

      <h3>Когда вы тренировались</h3>
      <TrainingHeatmap sessions={history} />

      <h3>Время в зале</h3>
      {durationSeries.length === 0 && (
        <p>Пока нет данных — засеките время кнопкой «Начать тренировку» на странице тренировки.</p>
      )}
      {durationSeries.length > 0 && (
        <ProgressChart
          points={durationSeries.map((p) => ({
            value: p.value,
            label: new Date(p.date).toLocaleDateString('ru-RU'),
          }))}
          unit="мин"
        />
      )}

      <h3>Прогресс по упражнению</h3>
      {exerciseSeries.length === 0 && (
        <p>Пока нет данных для графика — запишите вес хотя бы в одной тренировке.</p>
      )}
      {selectedSeries && (
        <>
          <select
            className="progress-chart-select"
            value={selectedSeries.exerciseId}
            onChange={(e) => setSelectedExerciseId(e.target.value)}
          >
            {exerciseSeries.map((s) => (
              <option key={s.exerciseId} value={s.exerciseId}>{s.name}</option>
            ))}
          </select>
          <ProgressChart
            points={selectedSeries.points.map((p) => ({
              value: p.value,
              label: new Date(p.date).toLocaleDateString('ru-RU'),
            }))}
          />
        </>
      )}

      <h3>Последние тренировки</h3>
      {history.length === 0 && <p>Пока нет записей — начните с раздела «Мои тренировки».</p>}
      {history.slice(0, 5).map((session) => (
        <div key={session.id} className="history-entry">
          <time>{new Date(session.date).toLocaleString('ru-RU')}</time>
          <p>{session.workoutTitle}</p>
        </div>
      ))}
    </section>
  )
}
