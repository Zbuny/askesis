import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/firestore.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { friendlyErrorMessage } from '../utils/errors.js'
import ProgressChart from '../components/ProgressChart.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useConfirm } from '../hooks/useConfirm.js'
import { calcBmi } from '../utils/bmi.js'
import { TRAINING_LEVELS } from '../utils/repRanges.js'
import { SEX_OPTIONS } from '../utils/nutrition.js'

// Профиль — это данные о себе, и только они: кто я, какие у меня рост,
// возраст, уровень и режим, сколько я вешу. Всё, что считается из журнала
// тренировок, живёт на «Статистике» — там для этого есть и период, и разбор
// дня, и рекорды.
//
// Побочный, но важный эффект разделения: журнал здесь больше не читается.
// Раньше страница тянула listWorkoutHistory({}) целиком — без пагинации, всю
// историю до первого дня — ради четырёх чисел в шапке. На Spark-плане это
// был самый дорогой экран приложения при том, что открывают его чаще других.

const emptyProfileData = { height: '', age: '', level: '', daysPerWeek: '', sex: '' }
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Profile() {
  const { user, isAdmin } = useAuth()
  const [uidCopied, setUidCopied] = useState(false)

  const [profileData, setProfileData] = useState(emptyProfileData)
  // Форма живёт до того, как приедут данные из Firestore: человек может
  // начать печатать раньше, чем вернётся запрос, и ответ не имеет права
  // затирать введённое. На быстром соединении это незаметно, на медленном —
  // выглядит как «поле само очистилось».
  const editedRef = useRef(false)
  const { busy: profileSaving, error, setError, run } = useAsyncAction()
  const [profileSaved, setProfileSaved] = useState(false)

  const [weightHistory, setWeightHistory] = useState([])
  const [weightEntry, setWeightEntry] = useState({ weight: '', date: todayStr() })
  const [deletingWeightId, setDeletingWeightId] = useState(null)
  const { ask, confirmProps } = useConfirm()

  useEffect(() => {
    api.listWeightHistory().then(setWeightHistory).catch((e) => setError(e.message))
    api
      .getMyProfileData()
      .then((data) => {
        if (editedRef.current) return
        setProfileData({
          height: data.height ?? '',
          age: data.age ?? '',
          level: data.level ?? '',
          daysPerWeek: data.daysPerWeek ?? '',
          sex: data.sex ?? '',
        })
      })
      .catch((e) => setError(e.message))
  }, [setError])

  const latestWeight = weightHistory[0]?.weight

  const bmi = useMemo(
    () => calcBmi(latestWeight, profileData.height),
    [latestWeight, profileData.height],
  )

  const weightSeries = useMemo(
    () =>
      [...weightHistory]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((w) => ({ value: w.weight, label: new Date(w.date).toLocaleDateString('ru-RU') })),
    [weightHistory],
  )

  // Каждое поле помечает форму изменённой: см. editedRef выше.
  function edit(patch) {
    editedRef.current = true
    setProfileSaved(false)
    setProfileData((prev) => ({ ...prev, ...patch }))
  }

  async function handleCopyUid() {
    if (!user?.uid) return
    try {
      await navigator.clipboard.writeText(user.uid)
      setUidCopied(true)
      setTimeout(() => setUidCopied(false), 2000)
    } catch {
      // Clipboard API недоступен (http, старый браузер) — uid всё равно виден на экране.
      setUidCopied(false)
    }
  }

  async function handleSaveProfileData(e) {
    e.preventDefault()
    setProfileSaved(false)
    try {
      await run(() =>
        api.updateMyProfileData({
          height: profileData.height === '' ? null : Number(profileData.height),
          age: profileData.age === '' ? null : Number(profileData.age),
          level: profileData.level || null,
          daysPerWeek: profileData.daysPerWeek === '' ? null : Number(profileData.daysPerWeek),
          sex: profileData.sex || null,
        }),
      )
      setProfileSaved(true)
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleLogWeight(e) {
    e.preventDefault()
    if (!weightEntry.weight) return
    try {
      await run(() => api.logWeight({ weight: weightEntry.weight, date: weightEntry.date }))
      setWeightEntry({ weight: '', date: todayStr() })
      setWeightHistory(await api.listWeightHistory())
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleDeleteWeight(id) {
    const confirmed = await ask({
      title: 'Удалить запись веса?',
      message: 'Точка исчезнет с графика и из расчёта ИМТ.',
    })
    if (!confirmed) return
    setDeletingWeightId(id)
    try {
      await api.deleteWeightLog({ id })
      setWeightHistory((prev) => prev.filter((w) => w.id !== id))
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setDeletingWeightId(null)
    }
  }

  return (
    <section>
      <div className="glass-hero">
        <div className="glass-hero__glow" aria-hidden="true" />
        <div className="glass-hero__content">
          <span className="eyebrow">Askesis · Профиль</span>
          <h2>Привет, {user?.displayName || 'спортсмен'}</h2>
          <p>
            Здесь только данные о вас — от них зависят диапазон повторений, шаг
            прибавки веса, недельная цель и норма калорий.{' '}
            <Link to="/statistics">Прогресс и графики — на «Статистике»</Link>.
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="profile-layout">
        <div className="profile-sidebar">
          <h3>Мои данные</h3>
          <form className="admin-form" onSubmit={handleSaveProfileData}>
            <input
              type="number"
              placeholder="Рост, см"
              value={profileData.height}
              onChange={(e) => edit({ height: e.target.value })}
            />
            <input
              type="number"
              placeholder="Возраст"
              value={profileData.age}
              onChange={(e) => edit({ age: e.target.value })}
            />
            {/* От уровня зависят и рекомендованный диапазон повторений,
                и шаг прибавки веса — поэтому спрашиваем его один раз здесь. */}
            <select
              className={profileData.level ? undefined : 'is-placeholder'}
              value={profileData.level}
              onChange={(e) => edit({ level: e.target.value })}
              aria-label="Уровень подготовки"
            >
              <option value="">Уровень подготовки</option>
              {TRAINING_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            {/* Частота — это и есть недельная цель на дашборде. Держим её
                рядом с уровнем: оба ответа даются в онбординге, и оба должны
                оставаться исправимыми, когда режим изменился. */}
            <select
              className={profileData.daysPerWeek ? undefined : 'is-placeholder'}
              value={profileData.daysPerWeek}
              onChange={(e) => edit({ daysPerWeek: e.target.value })}
              aria-label="Тренировок в неделю"
            >
              <option value="">Тренировок в неделю</option>
              {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                <option key={days} value={days}>{days} в неделю</option>
              ))}
            </select>
            {/* Пол нужен ровно для одного — основного обмена в дневных нормах
                КБЖУ. Формула различает только два значения, поэтому их и два;
                без ответа норма считается по середине и честно помечается
                приблизительной. */}
            <select
              className={profileData.sex ? undefined : 'is-placeholder'}
              value={profileData.sex}
              onChange={(e) => edit({ sex: e.target.value })}
              aria-label="Пол — для расчёта нормы калорий"
            >
              <option value="">Пол — для нормы калорий</option>
              {SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div className="admin-form__actions">
              <button type="submit" disabled={profileSaving}>Сохранить</button>
              {profileSaved && <span className="eyebrow">Сохранено</span>}
            </div>
          </form>

          <h3>Мой ID</h3>
          <div className="uid-block">
            <code className="uid-block__value">{user?.uid}</code>
            <button type="button" onClick={handleCopyUid}>
              {uidCopied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
          <p className="uid-block__hint">
            {isAdmin ? 'У вас права администратора.' : 'Нужен, только чтобы выдать права администратора.'}
          </p>
        </div>

        <div className="profile-content">
          <h3>Вес</h3>
          <form className="admin-form" onSubmit={handleLogWeight}>
            <input
              type="number"
              placeholder="Вес, кг"
              value={weightEntry.weight}
              onChange={(e) => setWeightEntry({ ...weightEntry, weight: e.target.value })}
            />
            <input
              type="date"
              value={weightEntry.date}
              max={todayStr()}
              onChange={(e) => setWeightEntry({ ...weightEntry, date: e.target.value })}
            />
            <div className="admin-form__actions">
              <button type="submit" disabled={profileSaving || !weightEntry.weight}>Записать</button>
            </div>
          </form>

          {bmi ? (
            <div className={`bmi bmi--${bmi.tone}`}>
              <div className="bmi__head">
                <strong>{bmi.value}</strong>
                <span>ИМТ · {bmi.label}</span>
              </div>
              <div className="bmi__scale">
                <span className="bmi__marker" style={{ left: `${bmi.percent}%` }} />
              </div>
              <div className="bmi__legend">
                <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
              </div>
            </div>
          ) : (
            <p className="bmi__hint">Запишите вес и укажите рост слева — посчитаем индекс массы тела.</p>
          )}

          {weightSeries.length === 0 && <p>Пока нет записей веса — добавьте первую выше.</p>}
          {weightSeries.length > 1 && <ProgressChart points={weightSeries} unit="кг" />}

          {weightHistory.length > 0 && (
            <div className="history-list">
              {weightHistory.slice(0, 10).map((entry) => (
                <div key={entry.id} className="history-entry">
                  <time>{new Date(entry.date).toLocaleDateString('ru-RU')}</time>
                  <div className="history-entry__row">
                    <p>{entry.weight} кг</p>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => handleDeleteWeight(entry.id)}
                      disabled={deletingWeightId === entry.id}
                    >
                      {deletingWeightId === entry.id ? 'Удаляем...' : 'Удалить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog {...confirmProps} />
    </section>
  )
}
