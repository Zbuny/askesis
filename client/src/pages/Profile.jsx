import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/firestore.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { friendlyErrorMessage } from '../utils/errors.js'
import ProgressChart from '../components/ProgressChart.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import EquipmentPicker from '../components/EquipmentPicker.jsx'
import { useConfirm } from '../hooks/useConfirm.js'
import { calcBmi } from '../utils/bmi.js'
import { uniqueValues } from '../utils/exerciseFilters.js'
import { translateEquipment } from '../utils/translate.js'
import { TRAINING_LEVELS } from '../utils/repRanges.js'
import { SEX_OPTIONS } from '../utils/nutrition.js'

// Профиль — это данные о себе, и только они: кто я, какие у меня рост,
// возраст, уровень и режим, сколько я вешу. Всё, что считается из журнала
// тренировок, живёт на «Статистике» — там для этого есть и период, и разбор
// дня, и рекорды.
//
// Инвентарь и ограничения тоже живут здесь, а не только в анкетах. Оба
// ответа даются один раз — в онбординге и в мастере ИИ — и оба нужны потом
// постоянно: по инвентарю подбирается замена упражнения, ограничения уходят
// тренеру в чат. Пока их некуда было исправить, менялись они единственным
// способом — пройти анкету заново.
//
// Побочный, но важный эффект разделения: журнал здесь больше не читается.
// Раньше страница тянула listWorkoutHistory({}) целиком — без пагинации, всю
// историю до первого дня — ради четырёх чисел в шапке. На Spark-плане это
// был самый дорогой экран приложения при том, что открывают его чаще других.

const emptyProfileData = {
  height: '',
  age: '',
  level: '',
  daysPerWeek: '',
  sex: '',
  equipment: [],
  limits: '',
}
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Profile() {
  const { user, isAdmin, resetPassword, verifyEmail, refreshEmailVerified } = useAuth()
  const [uidCopied, setUidCopied] = useState(false)

  const [profileData, setProfileData] = useState(emptyProfileData)
  // Форма живёт до того, как приедут данные из Firestore: человек может
  // начать печатать раньше, чем вернётся запрос, и ответ не имеет права
  // затирать введённое. На быстром соединении это незаметно, на медленном —
  // выглядит как «поле само очистилось».
  //
  // Помним при этом не факт правки, а список правленых полей. Отбросить
  // ответ целиком уже нельзя: в нём приезжают инвентарь и ограничения,
  // которых в форме не видно, — а сохранение после этого записало бы поверх
  // них пустоту.
  const editedRef = useRef(new Set())
  // Пока профиль не приехал, форма пуста — и сохранение из неё затёрло бы
  // инвентарь с ограничениями пустыми значениями. Раньше цена такой гонки
  // была невелика (рост и возраст видно тут же, что они стёрлись), теперь
  // это молчаливая потеря настроек, поэтому до загрузки не сохраняем.
  const [loaded, setLoaded] = useState(false)
  const { busy: profileSaving, error, setError, run } = useAsyncAction()
  // Форм на странице две, а профиль один: пишутся они одинаково, но «Сохранено»
  // обязано появиться в той карточке, где нажали, а не в обеих сразу.
  const [savedSection, setSavedSection] = useState(null)

  // Библиотека упражнений нужна ровно за одним — списком снарядов, которые
  // вообще встречаются в базе. Тянем её только когда человек открыл выбор
  // инвентаря: без этого страница снова стала бы читать 800+ документов
  // ради экрана, который открывают чаще всех (см. шапку файла).
  const [equipmentOptions, setEquipmentOptions] = useState(null)
  const [equipmentOpen, setEquipmentOpen] = useState(false)

  // Почта подтверждается вне приложения, поэтому флаг в объекте пользователя
  // может отстать — держим его отдельно и обновляем по кнопке.
  const [emailVerified, setEmailVerified] = useState(Boolean(user?.emailVerified))
  const [accountNotice, setAccountNotice] = useState(null)
  const [accountBusy, setAccountBusy] = useState(false)

  const [weightHistory, setWeightHistory] = useState([])
  const [weightEntry, setWeightEntry] = useState({ weight: '', date: todayStr() })
  const [deletingWeightId, setDeletingWeightId] = useState(null)
  const { ask, confirmProps } = useConfirm()

  useEffect(() => {
    api.listWeightHistory().then(setWeightHistory).catch((e) => setError(e.message))
    api
      .getMyProfileData()
      .then((data) => {
        const loadedData = {
          height: data.height ?? '',
          age: data.age ?? '',
          level: data.level ?? '',
          daysPerWeek: data.daysPerWeek ?? '',
          sex: data.sex ?? '',
          equipment: data.equipment ?? [],
          limits: data.limits ?? '',
        }
        setProfileData((prev) => {
          const merged = { ...loadedData }
          editedRef.current.forEach((field) => {
            merged[field] = prev[field]
          })
          return merged
        })
        setLoaded(true)
      })
      // Флаг намеренно остаётся снятым: не прочитав профиль, мы не знаем,
      // что в нём было, и запись из пустой формы стёрла бы настройки.
      // Текст ошибки при этом виден выше.
      .catch((e) => setError(e.message))
  }, [setError])

  const latestWeight = weightHistory[0]?.weight

  const bmi = useMemo(
    () => calcBmi(latestWeight, profileData.height),
    [latestWeight, profileData.height],
  )

  // Пароль есть только у тех, кто регистрировался по почте: пришедшему через
  // Google менять в приложении нечего — учётка живёт на стороне Google.
  const hasPassword = useMemo(
    () => (user?.providerData || []).some((provider) => provider.providerId === 'password'),
    [user],
  )

  const weightSeries = useMemo(
    () =>
      [...weightHistory]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((w) => ({ value: w.weight, label: new Date(w.date).toLocaleDateString('ru-RU') })),
    [weightHistory],
  )

  // Каждое правленое поле попадает в editedRef — см. выше, зачем именно
  // список полей, а не один флаг.
  function edit(patch) {
    Object.keys(patch).forEach((field) => editedRef.current.add(field))
    setSavedSection(null)
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

  async function handleSaveProfileData(e, section) {
    e.preventDefault()
    setSavedSection(null)
    try {
      await run(() =>
        api.updateMyProfileData({
          height: profileData.height === '' ? null : Number(profileData.height),
          age: profileData.age === '' ? null : Number(profileData.age),
          level: profileData.level || null,
          daysPerWeek: profileData.daysPerWeek === '' ? null : Number(profileData.daysPerWeek),
          sex: profileData.sex || null,
          equipment: profileData.equipment,
          // Пустую строку кладём как null, а не как '': так поле читается
          // одинаково и у тех, кто ограничения стёр, и у тех, кто их
          // никогда не заполнял.
          limits: profileData.limits.trim() || null,
        }),
      )
      setSavedSection(section)
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleOpenEquipment() {
    setEquipmentOpen(true)
    if (equipmentOptions) return
    try {
      const exercises = await api.listExercises()
      setEquipmentOptions(uniqueValues(exercises, 'equipment'))
    } catch (err) {
      setError(friendlyErrorMessage(err))
      setEquipmentOpen(false)
    }
  }

  // Оба действия с аккаунтом — это письмо на свой же адрес: пароль меняется
  // по ссылке из письма, а не в форме. Так не нужно ни спрашивать текущий
  // пароль, ни держать его в поле ввода.
  async function runAccountAction(action, notice) {
    setAccountNotice(null)
    setAccountBusy(true)
    try {
      await action()
      setAccountNotice(notice)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setAccountBusy(false)
    }
  }

  function handleSendVerification() {
    return runAccountAction(
      verifyEmail,
      `Письмо отправлено на ${user?.email}. Перейдите по ссылке из письма и вернитесь сюда.`,
    )
  }

  function handleChangePassword() {
    return runAccountAction(
      () => resetPassword(user.email),
      `Письмо со ссылкой для смены пароля отправлено на ${user?.email}.`,
    )
  }

  async function handleRecheckEmail() {
    setAccountNotice(null)
    setAccountBusy(true)
    try {
      const verified = await refreshEmailVerified()
      setEmailVerified(verified)
      if (!verified) setAccountNotice('Пока не подтверждено — перейдите по ссылке из письма.')
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setAccountBusy(false)
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
            прибавки веса, недельная цель, норма калорий и подбор замены
            упражнения.{' '}
            <Link to="/statistics">Прогресс и графики — на «Статистике»</Link>.
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="profile-layout">
        <div className="profile-sidebar">
          <h3>Мои данные</h3>
          <form className="admin-form" onSubmit={(e) => handleSaveProfileData(e, 'data')}>
            {/* Подпись над полем, а не в плейсхолдере: заполненное «182»
                без подписи уже не скажет, рост это или вес. */}
            <label className="field">
              <span>Рост, см</span>
              <input
                type="number"
                inputMode="numeric"
                min="100"
                max="250"
                placeholder="180"
                value={profileData.height}
                onChange={(e) => edit({ height: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Возраст, лет</span>
              <input
                type="number"
                inputMode="numeric"
                min="10"
                max="100"
                placeholder="25"
                value={profileData.age}
                onChange={(e) => edit({ age: e.target.value })}
              />
            </label>
            {/* От уровня зависят и рекомендованный диапазон повторений,
                и шаг прибавки веса — поэтому спрашиваем его один раз здесь. */}
            <label className="field">
              <span>Уровень подготовки</span>
              <select
                className={profileData.level ? undefined : 'is-placeholder'}
                value={profileData.level}
                onChange={(e) => edit({ level: e.target.value })}
              >
                <option value="">Не выбран</option>
                {TRAINING_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            {/* Частота — это и есть недельная цель на дашборде. Держим её
                рядом с уровнем: оба ответа даются в онбординге, и оба должны
                оставаться исправимыми, когда режим изменился. */}
            <label className="field">
              <span>Тренировок в неделю</span>
              <select
                className={profileData.daysPerWeek ? undefined : 'is-placeholder'}
                value={profileData.daysPerWeek}
                onChange={(e) => edit({ daysPerWeek: e.target.value })}
              >
                <option value="">Не выбрано</option>
                {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                  <option key={days} value={days}>{days} в неделю</option>
                ))}
              </select>
            </label>
            {/* Пол нужен ровно для одного — основного обмена в дневных нормах
                КБЖУ. Формула различает только два значения, поэтому их и два;
                без ответа норма считается по середине и честно помечается
                приблизительной. */}
            <label className="field">
              <span>Пол · для нормы калорий</span>
              <select
                className={profileData.sex ? undefined : 'is-placeholder'}
                value={profileData.sex}
                onChange={(e) => edit({ sex: e.target.value })}
              >
                <option value="">Не указан</option>
                {SEX_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="admin-form__actions">
              <button type="submit" disabled={profileSaving || !loaded}>Сохранить</button>
              {savedSection === 'data' && <span className="eyebrow">Сохранено</span>}
            </div>
          </form>

          <h3>Аккаунт</h3>
          <div className="account">
            <p className="account__email">
              <span>{user?.email || 'Почта не указана'}</span>
              <span className={emailVerified ? 'account__badge is-ok' : 'account__badge'}>
                {emailVerified ? 'Почта подтверждена' : 'Почта не подтверждена'}
              </span>
            </p>
            <div className="account__actions">
              {!emailVerified && user?.email && (
                <>
                  <button type="button" onClick={handleSendVerification} disabled={accountBusy}>
                    Подтвердить почту
                  </button>
                  <button type="button" onClick={handleRecheckEmail} disabled={accountBusy}>
                    Уже подтвердил
                  </button>
                </>
              )}
              {hasPassword && user?.email && (
                <button type="button" onClick={handleChangePassword} disabled={accountBusy}>
                  Сменить пароль
                </button>
              )}
            </div>
            {!hasPassword && (
              <p className="uid-block__hint">Вход через Google — пароль меняется в аккаунте Google.</p>
            )}
            {accountNotice && <p className="uid-block__hint">{accountNotice}</p>}
          </div>

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
          <h3>Инвентарь и ограничения</h3>
          <p className="uid-block__hint">
            Отсюда берутся замена упражнения прямо в тренировке, программа
            ИИ-тренера и подсказки в чате.
          </p>
          <form className="admin-form" onSubmit={(e) => handleSaveProfileData(e, 'gear')}>
            <div className="profile-field">
              <span className="profile-field__label">Инвентарь</span>
              {equipmentOpen ? (
                <EquipmentPicker
                  available={equipmentOptions || []}
                  selected={profileData.equipment}
                  onChange={(equipment) => edit({ equipment })}
                />
              ) : (
                <div className="profile-field__summary">
                  <p>
                    {profileData.equipment.length > 0
                      ? profileData.equipment.map(translateEquipment).join(', ')
                      : 'Не указан — замены подбираются без оглядки на снаряды'}
                  </p>
                  <button type="button" onClick={handleOpenEquipment}>Изменить</button>
                </div>
              )}
            </div>

            <div className="profile-field">
              <span className="profile-field__label">Травмы и ограничения</span>
              {/* Ровно тот же потолок, что и в правилах Firestore: лучше не
                  дать дописать, чем отклонить сохранение уже написанного. */}
              <textarea
                rows={3}
                maxLength={400}
                placeholder="Например: болит поясница, не делаю становую"
                value={profileData.limits}
                onChange={(e) => edit({ limits: e.target.value })}
              />
            </div>

            <div className="admin-form__actions">
              <button type="submit" disabled={profileSaving || !loaded}>Сохранить</button>
              {savedSection === 'gear' && <span className="eyebrow">Сохранено</span>}
            </div>
          </form>

          <h3>Вес</h3>
          <form className="admin-form" onSubmit={handleLogWeight}>
            <label className="field">
              <span>Вес, кг</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="20"
                max="400"
                placeholder="75.5"
                value={weightEntry.weight}
                onChange={(e) => setWeightEntry({ ...weightEntry, weight: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Дата</span>
              <input
                type="date"
                value={weightEntry.date}
                max={todayStr()}
                onChange={(e) => setWeightEntry({ ...weightEntry, date: e.target.value })}
              />
            </label>
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
            <p className="bmi__hint">Запишите вес и укажите рост в «Моих данных» — посчитаем индекс массы тела.</p>
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
