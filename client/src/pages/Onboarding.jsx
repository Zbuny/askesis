import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/firestore.js'
import { aiConfigured, generateWorkoutPlan } from '../api/ai.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { uniqueValues } from '../utils/exerciseFilters.js'
import { TRAINING_LEVELS } from '../utils/repRanges.js'
import { buildStarterPlan } from '../utils/starterPlan.js'
import GeneratedPlan from '../components/GeneratedPlan.jsx'
import EquipmentPicker from '../components/EquipmentPicker.jsx'

// Первый экран после регистрации. Отвечает не на вопрос «расскажите о себе»,
// а на вопрос «что мне делать»: анкета нужна ровно затем, чтобы в конце
// появилась готовая программа, а не пустой раздел «Мои тренировки».
//
// Ответы сохраняются в профиль, а не остаются в памяти шага: от них потом
// зависят недельная цель на дашборде, шаг прибавки веса и подсказки тренера.

export const ONBOARDING_GOALS = [
  'Набрать мышечную массу',
  'Снизить вес',
  'Увеличить силу',
  'Поддерживать форму',
  'Развить выносливость',
]

const STEPS = ['Цель', 'Опыт', 'Частота', 'Инвентарь']

export default function Onboarding() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({ goal: '', level: '', daysPerWeek: 3, equipment: [] })
  const [plan, setPlan] = useState(null)
  const { busy, error, setError, run } = useAsyncAction()
  const [usedAi, setUsedAi] = useState(false)

  useEffect(() => {
    api.listExercises().then(setExercises).catch((e) => setError(e.message))
  }, [setError])

  const equipmentOptions = useMemo(() => uniqueValues(exercises, 'equipment'), [exercises])
  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])

  const canAdvance =
    (step === 0 && answers.goal) ||
    (step === 1 && answers.level) ||
    step === 2 ||
    (step === 3 && answers.equipment.length > 0)

  async function handleFinish() {
    try {
      await run(async () => {
        await api.updateMyProfileData({
          goal: answers.goal,
          level: answers.level,
          daysPerWeek: answers.daysPerWeek,
          equipment: answers.equipment,
          onboardedAt: new Date().toISOString(),
        })

        // Сначала детерминированный сплит — он есть всегда. ИИ пробуем
        // следом и только заменяем им готовое: программа, которой человек
        // лишился из-за упавшей квоты Groq, хуже простой программы.
        const starter = buildStarterPlan({ exercises, ...answers })
        setPlan(starter)

        if (!aiConfigured) return
        try {
          const better = await generateWorkoutPlan({ profile: answers, exercises })
          if (better?.workouts?.length) {
            setPlan(better)
            setUsedAi(true)
          }
        } catch {
          // Молча остаёмся на своей программе: показывать новичку ошибку
          // внешнего сервиса, когда результат уже готов, незачем.
        }
      })
    } catch {
      // ошибка уже показана через error
    }
  }

  async function handleSkip() {
    try {
      await run(() => api.updateMyProfileData({ onboardedAt: new Date().toISOString() }))
    } catch {
      // даже если запись не прошла, задерживать человека здесь нельзя
    }
    navigate('/dashboard')
  }

  if (plan) {
    return (
      <section className="onboarding">
        <span className="eyebrow">Askesis · Готово</span>
        <h1>Ваша первая программа</h1>
        <p>
          {usedAi
            ? 'Собрана ИИ-тренером под ваши ответы. Сохраните дни — дальше приложение будет само поднимать веса по вашим цифрам.'
            : 'Собрана из вашей библиотеки по ответам анкеты. Сохраните дни — дальше приложение будет само поднимать веса по вашим цифрам.'}
        </p>

        <GeneratedPlan plan={plan} exerciseById={exerciseById} heading="Программа на неделю" />

        <p className="onboarding__skip">
          <Link to="/dashboard">Пропустить и собрать тренировку самому</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="onboarding">
      <span className="eyebrow">Askesis · Знакомство</span>
      <h1>Четыре вопроса — и программа готова</h1>
      <p>
        Ответы сохранятся в профиль: от них зависят недельная цель, шаг прибавки
        веса и подсказки тренера. Поменять их можно в любой момент.
      </p>

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
            <h3>Зачем вы идёте в зал?</h3>
            <div className="choice-grid">
              {ONBOARDING_GOALS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  className={answers.goal === goal ? 'choice is-selected' : 'choice'}
                  onClick={() => setAnswers({ ...answers, goal })}
                >
                  {goal}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3>Сколько вы уже тренируетесь?</h3>
            <div className="choice-grid">
              {TRAINING_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={answers.level === level ? 'choice is-selected' : 'choice'}
                  onClick={() => setAnswers({ ...answers, level })}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="wizard-hint">
              От уровня зависит и диапазон повторений, и насколько быстро растёт вес:
              новичку 5% в неделю, продвинутому — 1.5%.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <h3>Сколько раз в неделю сможете ходить?</h3>
            <div className="choice-grid">
              {[2, 3, 4, 5, 6].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={answers.daysPerWeek === days ? 'choice is-selected' : 'choice'}
                  onClick={() => setAnswers({ ...answers, daysPerWeek: days })}
                >
                  {days}
                </button>
              ))}
            </div>
            <p className="wizard-hint">
              Честное число лучше желаемого: по нему считается недельная цель, и
              невыполнимая цель демотивирует вернее, чем её отсутствие.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <h3>Где и чем будете тренироваться?</h3>
            <EquipmentPicker
              available={equipmentOptions}
              selected={answers.equipment}
              onChange={(equipment) => setAnswers({ ...answers, equipment })}
            />
          </>
        )}

        <div className="wizard-actions">
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Назад</button>}
          {step < STEPS.length - 1 && (
            <button type="button" disabled={!canAdvance} onClick={() => setStep(step + 1)}>Дальше</button>
          )}
          {step === STEPS.length - 1 && (
            <button type="button" className="button" disabled={!canAdvance || busy} onClick={handleFinish}>
              {busy ? 'Собираем программу...' : 'Собрать программу'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <p className="onboarding__skip">
        <button type="button" onClick={handleSkip}>Пропустить — разберусь сам</button>
      </p>
    </section>
  )
}
