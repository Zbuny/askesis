import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/firestore.js'
import { aiConfigured, generateWorkoutPlan } from '../api/ai.js'
import { buildStarterPlan } from '../utils/starterPlan.js'
import { uniqueValues } from '../utils/exerciseFilters.js'
import BackLink from '../components/BackLink.jsx'
import GeneratedPlan from '../components/GeneratedPlan.jsx'
import EquipmentPicker from '../components/EquipmentPicker.jsx'
import { calcBmi } from '../utils/bmi.js'
import { TRAINING_LEVELS } from '../utils/repRanges.js'

const GOALS = [
  'Набрать мышечную массу',
  'Снизить вес',
  'Увеличить силу',
  'Поддерживать форму',
  'Развить выносливость',
]

const STEPS = ['Цель', 'Уровень', 'График', 'Инвентарь', 'Ограничения']

export default function AiWorkoutBuilder() {
  const [exercises, setExercises] = useState([])
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState({
    goal: '',
    level: '',
    daysPerWeek: 3,
    equipment: [],
    limits: '',
  })
  const [plan, setPlan] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [usedAi, setUsedAi] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listExercises().then(setExercises).catch((e) => setError(e.message))
    api.getMyProfileData().then((data) => {
      // ИМТ передаём готовым числом: модель хуже считает его сама, а от
      // него зависит и объём, и доля кардио в программе.
      const bmi = calcBmi(data.weight, data.height)
      setProfile((prev) => ({
        ...prev,
        // Уровень уже указан в профиле — не спрашиваем его второй раз,
        // просто подставляем в мастер как выбранный.
        level: prev.level || data.level || '',
        // То же и с инвентарём с ограничениями: оба поля правятся в профиле
        // и нужны не только здесь, поэтому мастер начинает с них, а не с
        // чистого листа. Ответ остаётся исправимым — это те же шаги 4 и 5.
        equipment: prev.equipment.length ? prev.equipment : data.equipment || [],
        limits: prev.limits || data.limits || '',
        age: data.age,
        weight: data.weight,
        height: data.height,
        bmi: bmi ? `${bmi.value} (${bmi.label})` : '',
      }))
    }).catch(() => {})
  }, [])

  const equipmentOptions = useMemo(() => uniqueValues(exercises, 'equipment'), [exercises])
  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])

  const canAdvance =
    (step === 0 && profile.goal) ||
    (step === 1 && profile.level) ||
    step === 2 ||
    (step === 3 && profile.equipment.length > 0) ||
    step === 4

  // Ответы собраны — человек обязан уйти отсюда с программой. Модель может
  // быть не развёрнута или упереться в квоту Groq, и «помощник не настроен»
  // вместо результата после пяти вопросов — худший из возможных ответов.
  // Тот же запасной сплит, что и в онбординге (см. utils/starterPlan.js).
  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    setPlan(null)
    // Ответы про инвентарь и ограничения больше не одноразовые: по ним
    // подбирается замена упражнения в тренировке и отвечает тренер в чате.
    // Пишем их в профиль до генерации и молча — программа важнее, и ронять
    // её из-за неудачной записи в Firestore незачем.
    api
      .updateMyProfileData({ equipment: profile.equipment, limits: profile.limits.trim() || null })
      .catch(() => {})
    try {
      if (!aiConfigured) {
        setPlan(buildStarterPlan({ exercises, ...profile }))
        setUsedAi(false)
        return
      }
      setPlan(await generateWorkoutPlan({ profile, exercises }))
      setUsedAi(true)
    } catch (err) {
      setError(`${err.message}. Ниже — программа, собранная по вашим ответам без ИИ.`)
      setPlan(buildStarterPlan({ exercises, ...profile }))
      setUsedAi(false)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section>
      <BackLink fallback="/workouts" label="К тренировкам" />
      <h2>ИИ-тренер</h2>
      <p>Ответьте на пять вопросов — и получите программу, собранную из упражнений вашей библиотеки.</p>

      <ol className="wizard-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'is-active' : i < step ? 'is-done' : ''}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="wizard-panel">
        {step === 0 && (
          <>
            <h3>Какая у вас цель?</h3>
            <div className="choice-grid">
              {GOALS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  className={profile.goal === goal ? 'choice is-selected' : 'choice'}
                  onClick={() => setProfile({ ...profile, goal })}
                >
                  {goal}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3>Ваш уровень подготовки?</h3>
            <div className="choice-grid">
              {TRAINING_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={profile.level === level ? 'choice is-selected' : 'choice'}
                  onClick={() => setProfile({ ...profile, level })}
                >
                  {level}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3>Сколько тренировок в неделю?</h3>
            <div className="choice-grid">
              {[2, 3, 4, 5, 6].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={profile.daysPerWeek === days ? 'choice is-selected' : 'choice'}
                  onClick={() => setProfile({ ...profile, daysPerWeek: days })}
                >
                  {days}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3>Где и чем будете тренироваться?</h3>
            <EquipmentPicker
              available={equipmentOptions}
              selected={profile.equipment}
              onChange={(equipment) => setProfile({ ...profile, equipment })}
            />
          </>
        )}

        {step === 4 && (
          <>
            <h3>Травмы или ограничения?</h3>
            <textarea
              className="wizard-textarea"
              rows={4}
              maxLength={400}
              placeholder="Например: болит поясница, не делаю становую. Можно оставить пустым."
              value={profile.limits}
              onChange={(e) => setProfile({ ...profile, limits: e.target.value })}
            />
            <p className="wizard-hint">
              Сохраним в профиль: по этому же тексту подбирается замена
              упражнения в тренировке и отвечает тренер в чате.
            </p>
          </>
        )}

        <div className="wizard-actions">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)}>Назад</button>
          )}
          {step < STEPS.length - 1 && (
            <button type="button" disabled={!canAdvance} onClick={() => setStep(step + 1)}>Дальше</button>
          )}
          {step === STEPS.length - 1 && (
            <button type="button" className="button" disabled={generating} onClick={handleGenerate}>
              {generating ? 'Собираем программу...' : 'Собрать программу'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {plan && (
        <GeneratedPlan
          plan={plan}
          exerciseById={exerciseById}
          heading={usedAi ? 'Ваша программа' : 'Программа по вашим ответам'}
        />
      )}
    </section>
  )
}
