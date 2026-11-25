import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { physique } from '../utils/physique.js'
import { gamificationSummary, weeklyGoalFrom } from '../utils/gamification.js'
import {
  BODY_TYPES,
  SKIN_TONES,
  SLOTS,
  avatarLook,
  isUnlocked,
  itemFits,
  nextUnlocks,
  normalizeAvatar,
  paletteFor,
  sameAvatar,
} from '../utils/wardrobe.js'
import { pluralRu } from '../utils/translate.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import AvatarStage from '../components/AvatarStage.jsx'

// Персонаж — тело, которое растёт из журнала тренировок, и гардероб,
// который открывается с уровнем. Ни рост, ни уровень не хранятся: всё
// пересчитывается из истории, как XP на дашборде. В профиль пишется
// только выбор одежды.

export default function Character() {
  const [history, setHistory] = useState([])
  const [exercises, setExercises] = useState([])
  const [foodLogs, setFoodLogs] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('muscles')
  const [draft, setDraft] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [saved, setSaved] = useState(false)
  const { busy, error: saveError, run } = useAsyncAction()

  useEffect(() => {
    // Тот же размер страницы, что на дашборде, — иначе уровень здесь и там
    // мог бы разойтись у тех, у кого записей больше.
    Promise.all([api.listWorkoutHistory({ pageSize: 200 }), api.getMyProfileData()])
      .then(([loadedHistory, loadedProfile]) => {
        setHistory(loadedHistory)
        setProfile(loadedProfile || {})
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    // Без каталога неизвестно, какую мышцу растить, — но фигура и гардероб
    // показываются и без него, а рост «наливается», когда каталог придёт.
    api.listExercises().then(setExercises).catch(() => {})
    api.listFoodHistory({ pageSize: 100 }).then(setFoodLogs).catch(() => {})
  }, [])

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])
  const body = useMemo(() => physique(history, exerciseById), [history, exerciseById])
  const summary = useMemo(
    () => gamificationSummary({ history, foodLogs, weeklyGoal: weeklyGoalFrom(profile) }),
    [history, foodLogs, profile],
  )
  const level = summary.level

  const stored = useMemo(
    () => (profile ? normalizeAvatar(profile.avatar, { level, sex: profile.sex }) : null),
    [profile, level],
  )
  const avatar = draft || stored
  const look = useMemo(() => (avatar ? avatarLook(avatar) : null), [avatar])
  const dirty = Boolean(draft && stored && !sameAvatar(draft, stored))
  const upcoming = useMemo(() => nextUnlocks(level, avatar?.body), [level, avatar?.body])
  const onHoverRegion = useCallback((region) => setHovered(region), [])

  function change(key, value) {
    setSaved(false)
    setDraft((prev) => {
      const next = { ...(prev || stored), [key]: value }
      // Смена фигуры может сделать текущую вещь недоступной (у мужской нет
      // топа, у женской — «без верха»): нормализация подставит подходящую.
      return normalizeAvatar(next, { level, sex: profile?.sex })
    })
  }

  async function handleSave() {
    try {
      await run(() => api.updateMyProfileData({ avatar: draft }))
    } catch {
      return // текст ошибки уже показан под кнопкой
    }
    setProfile((prev) => ({ ...prev, avatar: draft }))
    setDraft(null)
    setSaved(true)
  }

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
        <h1 className="page-title">Персонаж</h1>
        <p className="error">{error}</p>
      </section>
    )
  }

  const hoveredRegion = body.regions.find((region) => region.key === hovered)
  const pumped = body.regions.filter((region) => region.pump > 0)

  return (
    <section className="character">
      <div className="character__head">
        <div>
          <h1 className="page-title">Персонаж</h1>
          <p className="character__lead">
            Каждый записанный подход растит мышцы, которые в нём работали. Уровень открывает новую одежду.
          </p>
        </div>
        <div className="character__badges">
          <span className="character__badge">
            <small>Форма</small>
            <strong>{body.stage}</strong>
            <em>{body.percent}%</em>
          </span>
          <span className="character__badge">
            <small>Уровень</small>
            <strong>{level}</strong>
            <em>{summary.title}</em>
          </span>
        </div>
      </div>

      <div className="character__layout">
        <div className="character__stage avatar-panel">
          <AvatarStage
            look={look}
            growth={body.growth}
            pump={body.pump}
            highlight={hovered}
            onHoverRegion={onHoverRegion}
          />
          <div className="avatar-panel__tip" aria-live="polite">
            {hoveredRegion ? (
              <>
                <strong>{hoveredRegion.label}</strong>
                <span>
                  развитие {hoveredRegion.percent}% · {hoveredRegion.sets}{' '}
                  {pluralRu(hoveredRegion.sets, 'подход', 'подхода', 'подходов')}
                </span>
              </>
            ) : (
              <span>Тяните, чтобы повернуть. Наведите на мышцу — покажу её прогресс.</span>
            )}
          </div>
          {pumped.length > 0 && (
            <div className="avatar-panel__pump">
              Памп: {pumped.map((region) => region.label.toLowerCase()).join(', ')}
            </div>
          )}
        </div>

        <div className="character__panel">
          <div className="period-switch character__tabs" role="tablist" aria-label="Раздел">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'muscles'}
              className={tab === 'muscles' ? 'is-active' : ''}
              onClick={() => setTab('muscles')}
            >
              Мышцы
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'wardrobe'}
              className={tab === 'wardrobe' ? 'is-active' : ''}
              onClick={() => setTab('wardrobe')}
            >
              Гардероб
            </button>
          </div>

          {tab === 'muscles' ? (
            <MusclesTab body={body} history={history} hovered={hovered} onHover={setHovered} />
          ) : (
            <WardrobeTab
              avatar={avatar}
              level={level}
              upcoming={upcoming}
              onChange={change}
              dirty={dirty}
              busy={busy}
              saved={saved}
              error={saveError}
              onSave={handleSave}
              onReset={() => setDraft(null)}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function MusclesTab({ body, history, hovered, onHover }) {
  if (history.length === 0) {
    return (
      <div className="character__empty">
        <p>Персонаж пока на старте. Запишите первую тренировку — и мышцы, которые в ней работали, начнут расти.</p>
        <Link to="/workouts" className="button">Выбрать тренировку</Link>
      </div>
    )
  }

  return (
    <>
      <div className="muscle-bars character__bars">
        {body.regions.map((region) => (
          <div
            key={region.key}
            className={`muscle-bar${hovered === region.key ? ' is-hovered' : ''}`}
            onMouseEnter={() => onHover(region.key)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(region.key)}
            onBlur={() => onHover(null)}
            tabIndex={0}
          >
            <span className="muscle-bar__label">
              {region.label}
              {region.pump > 0 && <span className="character__pump-dot" title="Работала в последние двое суток" />}
            </span>
            <div className="muscle-bar__track">
              <span className="muscle-bar__fill" style={{ width: `${Math.max(region.percent, region.sets > 0 ? 2 : 0)}%` }} />
            </div>
            <span className="muscle-bar__value">{region.percent}%</span>
          </div>
        ))}
      </div>

      {body.lagging && (
        <p className="character__hint">
          Отстаёт: <strong>{body.lagging.label.toLowerCase()}</strong>. Добавьте ей пару подходов в неделю — и фигура
          станет ровнее.
        </p>
      )}

      <details className="character__how">
        <summary>Как считается рост</summary>
        <p>
          Засчитываются выполненные подходы: целиком — для основной мышцы упражнения, на треть — для помогающих.
          Первые месяцы рост заметен быстро, дальше медленнее, как у живого тела. Если группу долго не тренировать,
          она понемногу сдувается: вклад подхода за полгода уменьшается вдвое. Двое суток после тренировки мышца
          подсвечена — это памп.
        </p>
      </details>
    </>
  )
}

function WardrobeTab({ avatar, level, upcoming, onChange, dirty, busy, saved, error, onSave, onReset }) {
  return (
    <div className="wardrobe">
      <div className="wardrobe__group">
        <span className="wardrobe__label">Фигура</span>
        <div className="wardrobe__items">
          {BODY_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`wardrobe__item${avatar.body === type.id ? ' is-active' : ''}`}
              aria-pressed={avatar.body === type.id}
              onClick={() => onChange('body', type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wardrobe__group">
        <span className="wardrobe__label">Кожа</span>
        <div className="wardrobe__swatches">
          {SKIN_TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`wardrobe__swatch${avatar.skin === tone.id ? ' is-active' : ''}`}
              style={{ '--swatch': tone.hex }}
              aria-label={tone.label}
              aria-pressed={avatar.skin === tone.id}
              title={tone.label}
              onClick={() => onChange('skin', tone.id)}
            />
          ))}
        </div>
      </div>

      {SLOTS.map((slot) => {
        const current = slot.items.find((item) => item.id === avatar[slot.key])
        const showColors = current && current.id !== 'none' && !current.fixedColor
        return (
          <div key={slot.key} className="wardrobe__group">
            <span className="wardrobe__label">{slot.label}</span>
            <div className="wardrobe__items">
              {slot.items
                .filter((item) => itemFits(item, avatar.body))
                .map((item) => {
                  const open = isUnlocked(item, level)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`wardrobe__item${avatar[slot.key] === item.id ? ' is-active' : ''}${open ? '' : ' is-locked'}`}
                      aria-pressed={avatar[slot.key] === item.id}
                      disabled={!open}
                      title={open ? item.label : `Откроется на ${item.level} уровне`}
                      onClick={() => onChange(slot.key, item.id)}
                    >
                      {item.label}
                      {!open && <small>ур. {item.level}</small>}
                    </button>
                  )
                })}
            </div>
            {showColors && (
              <div className="wardrobe__swatches">
                {paletteFor(slot).map((color) => {
                  const open = isUnlocked(color, level)
                  const active = avatar[slot.colorKey] === color.id
                  return (
                    <button
                      key={color.id}
                      type="button"
                      className={`wardrobe__swatch${active ? ' is-active' : ''}${open ? '' : ' is-locked'}`}
                      style={{ '--swatch': color.hex }}
                      aria-label={open ? color.label : `${color.label}, откроется на ${color.level} уровне`}
                      aria-pressed={active}
                      title={open ? color.label : `${color.label} — с ${color.level} уровня`}
                      disabled={!open}
                      onClick={() => onChange(slot.colorKey, color.id)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {upcoming.length > 0 && (
        <div className="wardrobe__next">
          <span className="wardrobe__label">Скоро откроется</span>
          <ul>
            {upcoming.map((item) => (
              <li key={`${item.slot}-${item.id}`}>
                <span>{item.label}</span>
                <small>{item.level} уровень</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="wardrobe__actions">
        <button type="button" onClick={onSave} disabled={!dirty || busy}>
          {busy ? 'Сохраняю…' : 'Сохранить образ'}
        </button>
        {dirty && (
          <button type="button" className="button--ghost wardrobe__reset" onClick={onReset} disabled={busy}>
            Отменить
          </button>
        )}
        {saved && !dirty && <span className="wardrobe__saved">Сохранено</span>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
