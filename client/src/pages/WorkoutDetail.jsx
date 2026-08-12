import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { formatDuration, useWorkoutTimer } from '../hooks/useWorkoutTimer.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { friendlyErrorMessage } from '../utils/errors.js'
import { entrySets, formatEntry } from '../utils/workoutLog.js'
import { exerciseName } from '../utils/translate.js'
import { formatReps } from '../utils/programItems.js'
import { formatTarget, nextSessionTarget } from '../utils/progression.js'
import { RIR_OPTIONS } from '../utils/repRanges.js'
import { reviewSession } from '../utils/sessionReview.js'
import { weeklyGoalFrom } from '../utils/gamification.js'
import SessionReview from '../components/SessionReview.jsx'
import ReadinessCheckin from '../components/ReadinessCheckin.jsx'
import ExerciseSwap from '../components/ExerciseSwap.jsx'
import { readinessScore, todayCheckin } from '../utils/readiness.js'
import ExerciseAnimation from '../components/ExerciseAnimation.jsx'
import BackLink from '../components/BackLink.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useConfirm } from '../hooks/useConfirm.js'

const emptySet = () => ({ weight: '', reps: '' })
const HISTORY_PAGE_SIZE = 10

// Сколько истории тянем ради разбора. Рекорд определяется сравнением со всей
// историей, а не только с этой тренировкой: одно и то же упражнение может
// стоять в нескольких, и по отфильтрованной выборке «рекорд» получился бы
// незаслуженным. Запрос идёт один раз на записанную тренировку, а не на
// каждый рендер, — на квоту чтений Spark-плана это не влияет.
const REVIEW_HISTORY_SIZE = 200

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState({})
  const [history, setHistory] = useState([])
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false)
  const [results, setResults] = useState({})
  // Упражнения, где человек взял предложенный вес кнопкой «Взять». Отметка
  // уходит в журнал: без следа в данных награду за выполненную рекомендацию
  // не начислить, ведь XP считается из истории, а не копится счётчиком.
  const [followed, setFollowed] = useState(new Set())
  // Запас до отказа по каждому упражнению. Не подставляем из прошлой
  // записи — это оценка сегодняшнего усилия, а не настройка упражнения.
  const [rir, setRir] = useState({})
  const [profile, setProfile] = useState({})
  const { busy: saving, error, setError, run } = useAsyncAction()
  const [duplicating, setDuplicating] = useState(false)
  const [deletingWorkout, setDeletingWorkout] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState(null)
  const [review, setReview] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [swapping, setSwapping] = useState(false)
  const reviewRef = useRef(null)
  const { startedAt, elapsedSeconds, start, reset } = useWorkoutTimer(id)
  const { ask, confirmProps } = useConfirm()

  function loadHistory() {
    return api
      .listWorkoutHistory({ workoutId: id, pageSize: HISTORY_PAGE_SIZE })
      .then((sessions) => {
        setHistory(sessions)
        setHasMoreHistory(sessions.length === HISTORY_PAGE_SIZE)
        return sessions
      })
      .catch((e) => {
        setError(e.message)
        return []
      })
  }

  async function loadMoreHistory() {
    const last = history[history.length - 1]
    if (!last) return
    setLoadingMoreHistory(true)
    try {
      const more = await api.listWorkoutHistory({ workoutId: id, pageSize: HISTORY_PAGE_SIZE, after: last.date })
      setHistory((prev) => [...prev, ...more])
      setHasMoreHistory(more.length === HISTORY_PAGE_SIZE)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMoreHistory(false)
    }
  }

  useEffect(() => {
    // Уровень задаёт шаг прибавки веса; без него считаем по среднему.
    api.getMyProfileData().then(setProfile).catch(() => {})
    api.listCheckins({ pageSize: 14 }).then(setCheckins).catch(() => {})
  }, [])

  async function handleCheckin(draft) {
    const existing = todayCheckin(checkins)
    setSwapping(true)
    try {
      const saved = await api.saveCheckin({ id: existing?.id, ...draft })
      const entry = { id: saved.id, date: existing?.date || new Date().toISOString(), ...draft }
      setCheckins((prev) => [entry, ...prev.filter((c) => c.id !== saved.id)])
      return true
    } catch (err) {
      setError(friendlyErrorMessage(err))
      return false
    } finally {
      setSwapping(false)
    }
  }

  // Замена упражнения меняет саму тренировку, а не разовую запись: человек
  // заменяет его не «на сегодня», а потому что это упражнение ему не подходит.
  async function handleSwap(item, replacement) {
    setSwapping(true)
    try {
      const items = workout.items.map((current) =>
        current.exerciseId === item.exerciseId
          ? { ...current, exerciseId: replacement.id, exerciseName: exerciseName(replacement) }
          : current,
      )
      await api.updateWorkout({ id, title: workout.title, items })
      setWorkout({ ...workout, items })
      // Поля результата привязаны к id упражнения — переносим заполненное,
      // иначе человек теряет уже введённые подходы.
      setResults((prev) => {
        const next = { ...prev }
        next[replacement.id] = prev[item.exerciseId] || []
        delete next[item.exerciseId]
        return next
      })
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setSwapping(false)
    }
  }

  // Форма длинная, и после сохранения разбор оказывается ниже экрана —
  // подводим к нему сами, иначе главный ответ («что в следующий раз») никто
  // не увидит.
  useEffect(() => {
    if (review) reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [review])

  useEffect(() => {
    Promise.all([api.getWorkout({ id }), loadHistory()])
      .then(([w, loadedHistory]) => {
        setWorkout(w)

        // Подставляем прошлый результат по каждому подходу — так проще
        // ориентироваться, с каким весом заходить сегодня.
        const lastEntries = new Map((loadedHistory?.[0]?.entries || []).map((e) => [e.exerciseId, e]))
        const initial = {}
        w.items.forEach((item) => {
          const lastSets = entrySets(lastEntries.get(item.exerciseId))
          const count = Math.max(item.targetSets || 1, lastSets.length, 1)
          // Ничего не подставляем «из цели»: пустой подход должен означать
          // «не делал». Цель показываем плейсхолдером.
          initial[item.exerciseId] = Array.from({ length: count }, (_, i) => ({
            weight: lastSets[i] ? String(lastSets[i].weight) : '',
            reps: lastSets[i] ? String(lastSets[i].reps) : '',
          }))
        })
        setResults(initial)

        // Картинка и ссылка «как выполнять» — берём из уже закэшированного
        // каталога (см. api/cache.js), а не читаем каждое упражнение
        // отдельным запросом: список кэшируется на сутки и общий для всех
        // страниц, так что здесь это обычно вообще без обращения к сети.
        api
          .listExercises()
          .then((list) => {
            const byId = {}
            list.forEach((ex) => {
              byId[ex.id] = ex
            })
            setExercises(byId)
          })
          .catch(() => {})
      })
      .catch((e) => setError(e.message))
  }, [id])

  // Что ставить сегодня — считаем из последней записи по этой же тренировке:
  // добрал верх диапазона во всех подходах — вес растёт, нет — добираем повторы.
  const targets = useMemo(() => {
    const last = history[0]
    const lastEntries = new Map((last?.entries || []).map((entry) => [entry.exerciseId, entry]))
    const map = new Map()
    ;(workout?.items || []).forEach((item) => {
      map.set(
        item.exerciseId,
        nextSessionTarget({
          item,
          lastEntry: lastEntries.get(item.exerciseId),
          lastDate: last?.date,
          exercise: exercises[item.exerciseId],
          level: profile.level,
        }),
      )
    })
    return map
  }, [workout, history, exercises, profile.level])

  const catalogue = useMemo(() => Object.values(exercises), [exercises])
  const readiness = useMemo(() => readinessScore(todayCheckin(checkins)), [checkins])

  function applyTarget(item) {
    const target = targets.get(item.exerciseId)
    if (!target) return
    const count = Math.max(Number(item.targetSets) || 1, 1)
    setResults((prev) => ({
      ...prev,
      [item.exerciseId]: Array.from({ length: count }, () => ({
        weight: target.weight ? String(target.weight) : '',
        reps: String(target.reps),
      })),
    }))
    setFollowed((prev) => new Set(prev).add(item.exerciseId))
  }

  function updateSet(exerciseId, index, field, value) {
    setResults((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((set, i) => (i === index ? { ...set, [field]: value } : set)),
    }))
  }

  function addSet(exerciseId) {
    setResults((prev) => ({ ...prev, [exerciseId]: [...prev[exerciseId], emptySet()] }))
  }

  function removeSet(exerciseId, index) {
    setResults((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].filter((_, i) => i !== index),
    }))
  }

  async function handleLogSession(e) {
    e.preventDefault()

    const entries = workout.items
      .map((item) => ({
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        // Пустые подходы не записываем — упражнение могли пропустить.
        sets: (results[item.exerciseId] || [])
          .filter((set) => set.weight !== '' || set.reps !== '')
          .map((set) => ({ weight: Number(set.weight) || 0, reps: Number(set.reps) || 0 })),
        ...(followed.has(item.exerciseId) ? { followedTarget: true } : {}),
        ...(rir[item.exerciseId] != null ? { rir: rir[item.exerciseId] } : {}),
      }))
      .filter((entry) => entry.sets.length > 0)

    if (entries.length === 0) {
      setError('Заполните хотя бы один подход')
      return
    }

    try {
      const saved = await run(() =>
        api.logWorkoutSession({
          workoutId: id,
          date: new Date().toISOString(),
          entries,
          startedAt,
          durationMinutes: startedAt ? Math.max(1, Math.round(elapsedSeconds / 60)) : null,
        }),
      )
      reset()
      setFollowed(new Set())
      setRir({})
      loadHistory()
      buildReview(saved?.id)
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function buildReview(sessionId) {
    if (!sessionId) return
    try {
      // Питание читаем ради одного: XP за дни с записанной едой входит в
      // общий счёт, и без него новый уровень определился бы неверно —
      // либо потерялся, либо объявился на тренировку раньше срока.
      const [full, foodLogs] = await Promise.all([
        api.listWorkoutHistory({ pageSize: REVIEW_HISTORY_SIZE }),
        api.listFoodHistory({ pageSize: REVIEW_HISTORY_SIZE }).catch(() => []),
      ])
      const session = full.find((s) => s.id === sessionId)
      if (!session) return
      setReview(
        reviewSession({
          session,
          history: full,
          workout,
          exerciseById: new Map(Object.entries(exercises)),
          foodLogs,
          weeklyGoal: weeklyGoalFrom(profile),
          level: profile.level,
        }),
      )
    } catch {
      // Разбор — дополнение к записи, а не её часть: тренировка уже сохранена,
      // и ронять экран из-за неудавшегося чтения истории нельзя.
    }
  }

  async function handleDelete() {
    const confirmed = await ask({
      title: 'Удалить тренировку?',
      message: `«${workout.title}» и её настройки будут удалены. Записи о выполнении останутся в истории.`,
    })
    if (!confirmed) return
    setDeletingWorkout(true)
    try {
      await api.deleteWorkout({ id })
      navigate('/workouts')
    } catch (err) {
      setError(friendlyErrorMessage(err))
      setDeletingWorkout(false)
    }
  }

  async function handleDeleteSession(sessionId) {
    const confirmed = await ask({
      title: 'Удалить запись?',
      message: 'Запись о выполнении исчезнет из истории и перестанет учитываться в прогрессе.',
    })
    if (!confirmed) return
    setDeletingSessionId(sessionId)
    try {
      await api.deleteWorkoutLog({ id: sessionId })
      setHistory((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setDeletingSessionId(null)
    }
  }

  async function handleDuplicate() {
    setError(null)
    setDuplicating(true)
    try {
      const result = await api.duplicateWorkout({ id })
      navigate(`/workouts/${result.id}`)
    } catch (err) {
      setError(friendlyErrorMessage(err))
      setDuplicating(false)
    }
  }

  if (error && !workout) return <p>Ошибка: {error}</p>
  if (!workout) return <p>Загрузка...</p>

  return (
    <section>
      <BackLink fallback="/workouts" label="К тренировкам" />
      <h2>{workout.title}</h2>
      <div className="admin-list__actions">
        <button type="button" onClick={() => navigate(`/workouts/${id}/edit`)}>Редактировать</button>
        <button type="button" onClick={handleDuplicate} disabled={duplicating}>
          {duplicating ? 'Копируем...' : 'Скопировать как новую'}
        </button>
        <button type="button" className="is-danger" onClick={handleDelete} disabled={deletingWorkout}>
          {deletingWorkout ? 'Удаляем...' : 'Удалить тренировку'}
        </button>
      </div>

      <h3>Отметить выполнение</h3>

      {/* Чек-ин стоит до формы: прогрессия предлагает прибавку так, будто
          человек каждый раз приходит одинаковым, а после четырёх часов сна
          та же прибавка — не прогресс, а способ поймать травму. */}
      <ReadinessCheckin checkin={todayCheckin(checkins)} onSave={handleCheckin} busy={swapping} />

      <div className="timer">
        {startedAt ? (
          <>
            <span className="timer__value">{formatDuration(elapsedSeconds)}</span>
            <span className="timer__label">
              в зале с {new Date(startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button type="button" onClick={reset}>Сбросить</button>
          </>
        ) : (
          <>
            <span className="timer__label">Засечь время тренировки, чтобы оно попало в статистику</span>
            <button type="button" onClick={start}>Начать тренировку</button>
          </>
        )}
      </div>

      <form onSubmit={handleLogSession}>
        {workout.items.map((item) => {
          const ex = exercises[item.exerciseId]
          const sets = results[item.exerciseId] || []
          const target = targets.get(item.exerciseId)
          return (
            <div className="log-exercise" key={item.exerciseId}>
              <div className="log-exercise__head">
                <Link to={`/exercises/${item.exerciseId}`} className="log-exercise__media">
                  {ex?.imageUrl ? (
                    <ExerciseAnimation exercise={ex} alt={exerciseName(ex)} animate={false} />
                  ) : (
                    <span className="log-exercise__media-empty" aria-hidden="true" />
                  )}
                </Link>

                <div className="log-exercise__info">
                  <Link to={`/exercises/${item.exerciseId}`} className="log-exercise__name">
                    {ex ? exerciseName(ex) : item.exerciseName}
                  </Link>
                  <span className="log-exercise__target">
                    Цель: {item.targetSets} × {formatReps(item)}
                  </span>
                  {target && (
                    <span className={`next-target next-target--${target.action}`}>
                      <strong>Сегодня: {formatTarget(target)}</strong>
                      {target.action !== 'start' && (
                        <button type="button" onClick={() => applyTarget(item)}>
                          Взять
                        </button>
                      )}
                      <small>{target.hint}</small>
                      {/* Прогрессия считает по цифрам прошлой тренировки и о
                          сегодняшнем состоянии не знает — предупреждаем здесь,
                          а сам расчёт не трогаем: он должен оставаться
                          воспроизводимым. */}
                      {readiness && readiness.loadFactor < 1 && target.action === 'add-weight' && (
                        <small className="next-target__readiness">
                          Сегодня готовность {readiness.percent}% — прибавку лучше отложить, а не брать через силу.
                        </small>
                      )}
                    </span>
                  )}
                  <div className="log-exercise__links">
                    <Link to={`/exercises/${item.exerciseId}`} className="log-exercise__how">
                      Как выполнять →
                    </Link>
                    <ExerciseSwap
                      origin={ex}
                      catalogue={catalogue}
                      equipment={profile.equipment}
                      busy={swapping}
                      onSwap={(replacement) => handleSwap(item, replacement)}
                    />
                  </div>
                </div>
              </div>

              <div className="log-sets">
                {sets.map((set, i) => (
                  <div className="log-set" key={i}>
                    <span className="log-set__num">{i + 1}</span>
                    <label className="log-set__field">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        placeholder="0"
                        value={set.weight}
                        onChange={(e) => updateSet(item.exerciseId, i, 'weight', e.target.value)}
                      />
                      <span>кг</span>
                    </label>
                    <label className="log-set__field">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        placeholder={String(item.targetReps || '')}
                        value={set.reps}
                        onChange={(e) => updateSet(item.exerciseId, i, 'reps', e.target.value)}
                      />
                      <span>повт.</span>
                    </label>
                    <button
                      type="button"
                      className="log-set__remove"
                      onClick={() => removeSet(item.exerciseId, i)}
                      title="Убрать подход"
                      aria-label={`Убрать подход ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="log-sets__add" onClick={() => addSet(item.exerciseId)}>
                  + подход
                </button>
              </div>

              {/* Сколько повторений осталось в запасе. Само число повторений
                  об усилии не говорит: 8 с запасом в четыре и 8 на пределе в
                  журнале выглядят одинаково, а для роста это разные подходы.
                  Спросить об этом можно только у человека — отсюда поле. */}
              <div className="log-rir">
                <span className="log-rir__label">Осталось в запасе</span>
                <div className="log-rir__options">
                  {RIR_OPTIONS.map((option) => {
                    const selected = rir[item.exerciseId] === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={selected ? 'is-selected' : undefined}
                        aria-pressed={selected}
                        title={option.hint}
                        onClick={() =>
                          setRir((prev) => ({
                            ...prev,
                            // Повторное нажатие снимает отметку: «не отмечал»
                            // и «дошёл до отказа» — разные вещи.
                            [item.exerciseId]: selected ? undefined : option.value,
                          }))
                        }
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}

        {error && <p className="error">{error}</p>}

        <div className="admin-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Сохраняем...' : 'Записать сегодняшнюю тренировку'}
          </button>
        </div>
      </form>

      {/* Разбор появляется сразу под формой: пока человек ещё на странице,
          у него есть и цифры сегодняшнего дня, и цель на следующий раз. */}
      <div ref={reviewRef}>
        <SessionReview review={review} onClose={() => setReview(null)} />
      </div>

      <h3>История</h3>
      {history.length === 0 && <p>Пока нет записей о выполнении.</p>}
      {history.map((session) => (
        <div key={session.id} className="history-entry">
          <div className="history-entry__row">
            <time>
              {new Date(session.date).toLocaleString('ru-RU')}
              {session.durationMinutes ? ` · ${session.durationMinutes} мин в зале` : ''}
            </time>
            <button
              type="button"
              className="is-danger"
              onClick={() => handleDeleteSession(session.id)}
              disabled={deletingSessionId === session.id}
            >
              {deletingSessionId === session.id ? 'Удаляем...' : 'Удалить'}
            </button>
          </div>
          <ul>
            {session.entries.map((entry, i) => (
              <li key={i}>{entry.exerciseName}: {formatEntry(entry)}</li>
            ))}
          </ul>
        </div>
      ))}
      {hasMoreHistory && (
        <button type="button" className="picker__more" onClick={loadMoreHistory} disabled={loadingMoreHistory}>
          {loadingMoreHistory ? 'Загружаем...' : 'Показать ещё'}
        </button>
      )}

      <ConfirmDialog {...confirmProps} />
    </section>
  )
}
