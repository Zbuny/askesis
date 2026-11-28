import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { aiConfigured, scanFood } from '../api/ai.js'
import { cropDataUrl, resizeImageToDataUrl } from '../utils/image.js'
import PhotoCrop from '../components/PhotoCrop.jsx'
import { dailyTargets, dayProgress } from '../utils/nutrition.js'
import DailyTargets from '../components/DailyTargets.jsx'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { friendlyErrorMessage } from '../utils/errors.js'
import BackLink from '../components/BackLink.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useConfirm } from '../hooks/useConfirm.js'

const emptyEntry = { name: '', calories: '', protein: '', fat: '', carbs: '' }
// С запасом на день с большим числом приёмов пищи — todayTotals ниже должен
// увидеть все сегодняшние записи целиком, а не только первую страницу.
const HISTORY_PAGE_SIZE = 50

function isToday(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export default function FoodScanner() {
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [cropping, setCropping] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [entry, setEntry] = useState(null)
  const { busy: saving, error, setError, run } = useAsyncAction()
  const [deletingId, setDeletingId] = useState(null)
  const { ask, confirmProps } = useConfirm()
  const [history, setHistory] = useState([])
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false)
  // Норма считается из профиля и последнего записанного веса: рост и возраст
  // человек указывает один раз, а вес меняется — брать его из профиля нельзя.
  const [profile, setProfile] = useState({})
  const [weight, setWeight] = useState(null)

  useEffect(() => {
    api
      .listFoodHistory({ pageSize: HISTORY_PAGE_SIZE })
      .then((list) => {
        setHistory(list)
        setHasMoreHistory(list.length === HISTORY_PAGE_SIZE)
      })
      .catch((e) => setError(friendlyErrorMessage(e)))

    api.getMyProfileData().then(setProfile).catch(() => {})
    api.listWeightHistory({ pageSize: 1 }).then(([last]) => setWeight(last?.weight ?? null)).catch(() => {})
  }, [])

  async function loadMoreHistory() {
    const last = history[history.length - 1]
    if (!last) return
    setLoadingMoreHistory(true)
    try {
      const more = await api.listFoodHistory({ pageSize: HISTORY_PAGE_SIZE, after: last.date })
      setHistory((prev) => [...prev, ...more])
      setHasMoreHistory(more.length === HISTORY_PAGE_SIZE)
    } catch (e) {
      setError(friendlyErrorMessage(e))
    } finally {
      setLoadingMoreHistory(false)
    }
  }

  const todayTotals = useMemo(() => {
    const today = history.filter((f) => isToday(f.date))
    return today.reduce(
      (acc, f) => ({
        calories: acc.calories + (Number(f.calories) || 0),
        protein: acc.protein + (Number(f.protein) || 0),
        fat: acc.fat + (Number(f.fat) || 0),
        carbs: acc.carbs + (Number(f.carbs) || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    )
  }, [history])

  const targets = useMemo(
    () => dailyTargets({ ...profile, weight }),
    [profile, weight],
  )
  const progress = useMemo(() => dayProgress(targets, todayTotals), [targets, todayTotals])

  // Фото выбрали — не распознаём сразу, а показываем кадр для обрезки.
  // Со снимка со всем столом модель считает калории по всему, что в кадре,
  // и одна лишняя тарелка рядом ломает оценку сильнее любых промптов.
  async function handlePickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setEntry(null)
    try {
      setPreview(await resizeImageToDataUrl(file))
      setCropping(true)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    }
  }

  async function handleScan(area) {
    setError(null)
    try {
      const dataUrl = area ? await cropDataUrl(preview, area) : preview
      setPreview(dataUrl)
      setCropping(false)
      setScanning(true)
      const result = await scanFood(dataUrl)
      setEntry({
        name: result.name,
        calories: String(result.calories),
        protein: String(result.protein),
        fat: String(result.fat),
        carbs: String(result.carbs),
      })
    } catch (err) {
      setError(friendlyErrorMessage(err))
      // Даже если распознавание не удалось, оставляем пустую форму —
      // можно вписать КБЖУ вручную по тому же фото.
      setEntry({ ...emptyEntry })
    } finally {
      setScanning(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!entry?.name) return
    try {
      await run(() => api.logFood(entry))
      setEntry(null)
      setPreview(null)
      setCropping(false)
      const list = await api.listFoodHistory({ pageSize: HISTORY_PAGE_SIZE })
      setHistory(list)
      setHasMoreHistory(list.length === HISTORY_PAGE_SIZE)
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleDelete(id) {
    const confirmed = await ask({
      title: 'Удалить запись?',
      message: 'Блюдо перестанет учитываться в дневном итоге КБЖУ.',
    })
    if (!confirmed) return
    setDeletingId(id)
    try {
      await api.deleteFoodLog({ id })
      setHistory((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section>
      <BackLink fallback="/profile" label="К профилю" />
      <h1 className="page-title">Сканер КБЖУ</h1>
      <p>Сфотографируйте еду — ИИ прикинет калории и БЖУ. Это грубая оценка на глаз, перед сохранением её можно поправить.</p>

      {error && <p className="error">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handlePickPhoto}
      />
      <button
        type="button"
        className="photo-picker"
        onClick={() => fileInputRef.current?.click()}
        disabled={scanning}
      >
        <span className="photo-picker__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
            <circle cx="12" cy="13.2" r="3.2" />
          </svg>
        </span>
        <strong>{scanning ? 'Распознаю…' : 'Сфотографировать еду'}</strong>
      </button>

      {cropping && preview && (
        <PhotoCrop
          src={preview}
          busy={scanning}
          onApply={handleScan}
          onCancel={() => {
            setCropping(false)
            setPreview(null)
          }}
        />
      )}

      {!cropping && preview && <img src={preview} alt="Фото еды" className="food-preview" />}

      {entry && (
        <form className="admin-form" onSubmit={handleSave}>
          <input
            type="text"
            placeholder="Название блюда"
            value={entry.name}
            onChange={(e) => setEntry({ ...entry, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="Калории, ккал"
            value={entry.calories}
            onChange={(e) => setEntry({ ...entry, calories: e.target.value })}
          />
          <input
            type="number"
            placeholder="Белки, г"
            value={entry.protein}
            onChange={(e) => setEntry({ ...entry, protein: e.target.value })}
          />
          <input
            type="number"
            placeholder="Жиры, г"
            value={entry.fat}
            onChange={(e) => setEntry({ ...entry, fat: e.target.value })}
          />
          <input
            type="number"
            placeholder="Углеводы, г"
            value={entry.carbs}
            onChange={(e) => setEntry({ ...entry, carbs: e.target.value })}
          />
          <div className="admin-form__actions">
            <button type="submit" disabled={saving || !entry.name}>Сохранить</button>
          </div>
        </form>
      )}

      <h3>Сегодня</h3>
      <DailyTargets targets={targets} progress={progress} />

      <div className="stat-cards">
        <div className="stat-card">
          <strong>{Math.round(todayTotals.calories)}</strong>
          ккал
        </div>
        <div className="stat-card">
          <strong>{Math.round(todayTotals.protein)} г</strong>
          белков
        </div>
        <div className="stat-card">
          <strong>{Math.round(todayTotals.fat)} г</strong>
          жиров
        </div>
        <div className="stat-card">
          <strong>{Math.round(todayTotals.carbs)} г</strong>
          углеводов
        </div>
      </div>

      {/* Норма отвечает на «много или мало», но не на «что с этим делать»:
          за разбором в свободной форме уводим в чат вместе с цифрами дня. */}
      {aiConfigured && todayTotals.calories > 0 && (
        <div className="coach__actions">
          <Link
            to={`/workouts/chat?q=${encodeURIComponent(
              `Сегодня я съел ${Math.round(todayTotals.calories)} ккал: белков ${Math.round(todayTotals.protein)} г, жиров ${Math.round(todayTotals.fat)} г, углеводов ${Math.round(todayTotals.carbs)} г. Мне этого хватает при силовых тренировках?`,
            )}`}
            className="coach__link"
          >
            Спросить тренера про эти цифры →
          </Link>
        </div>
      )}

      <h3>История</h3>
      {history.length === 0 && <p>Пока нет записей — сфотографируйте первое блюдо выше.</p>}
      {history.length > 0 && (
        <div className="history-list">
          {history.slice(0, 20).map((f) => (
            <div key={f.id} className="history-entry">
              <time>{new Date(f.date).toLocaleString('ru-RU')}</time>
              <div className="history-entry__row">
                <p>
                  {f.name} — {Math.round(f.calories)} ккал
                  <br />
                  <small>Б{f.protein} / Ж{f.fat} / У{f.carbs}</small>
                </p>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => handleDelete(f.id)}
                  disabled={deletingId === f.id}
                >
                  {deletingId === f.id ? 'Удаляем...' : 'Удалить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {hasMoreHistory && (
        <button type="button" className="picker__more" onClick={loadMoreHistory} disabled={loadingMoreHistory}>
          {loadingMoreHistory ? 'Загружаем...' : 'Показать ещё'}
        </button>
      )}

      <ConfirmDialog {...confirmProps} />
    </section>
  )
}
