import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/firestore.js'
import { generateWorkoutPlan } from '../api/ai.js'
import { translateEquipment } from '../utils/translate.js'
import { uniqueValues } from '../utils/exerciseFilters.js'
import BackLink from '../components/BackLink.jsx'
import GeneratedPlan from '../components/GeneratedPlan.jsx'

const GOALS = [
  'Набрать мышечную массу',
  'Снизить вес',
  'Увеличить силу',
  'Поддерживать форму',
  'Развить выносливость',
]

const LEVELS = ['Начинающий', 'Средний', 'Продвинутый']

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
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listExercises().then(setExercises).catch((e) => setError(e.message))
    api.getMyProfileData().then((data) => {
      setProfile((prev) => ({ ...prev, age: data.age, weight: data.weight, height: data.height }))
    }).catch(() => {})
  }, [])

  const equipmentOptions = useMemo(() => uniqueValues(exercises, 'equipment'), [exercises])
  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])

  function toggleEquipment(value) {
    setProfile((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(value)
        ? prev.equipment.filter((item) => item !== value)
        : [...prev.equipment, value],
    }))
  }

  const canAdvance =
    (step === 0 && profile.goal) ||
    (step === 1 && profile.level) ||
    step === 2 ||
    (step === 3 && profile.equipment.length > 0) ||
    step === 4

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    setPlan(null)
    setSavedTitles([])
    try {
      const result = await generateWorkoutPlan({ profile, exercises })
      setPlan(result)
    } catch (err) {
      setError(err.message)
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
              {LEVELS.map((level) => (
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
            <h3>Что у вас есть из инвентаря?</h3>
            <div className="choice-grid">
              {equipmentOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={profile.equipment.includes(value) ? 'choice is-selected' : 'choice'}
                  onClick={() => toggleEquipment(value)}
                >
                  {translateEquipment(value)}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3>Травмы или ограничения?</h3>
            <textarea
              className="wizard-textarea"
              rows={4}
              placeholder="Например: болит поясница, не делаю становую. Можно оставить пустым."
              value={profile.limits}
              onChange={(e) => setProfile({ ...profile, limits: e.target.value })}
            />
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

      {plan && <GeneratedPlan plan={plan} exerciseById={exerciseById} />}
    </section>
  )
}
