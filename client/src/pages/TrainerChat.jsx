import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { askTrainer, planFromChat } from '../api/ai.js'
import { api } from '../api/firestore.js'
import { useAutoResize } from '../hooks/useAutoResize.js'
import BackLink from '../components/BackLink.jsx'
import GeneratedPlan from '../components/GeneratedPlan.jsx'
import ChatAttachments, { buildContext } from '../components/ChatAttachments.jsx'

const SUGGESTIONS = [
  { label: 'Сплит на 4 дня', prompt: 'Составь мне сплит на 4 дня' },
  { label: 'Замена упражнения', prompt: 'Чем заменить становую тягу при больной пояснице?' },
  { label: 'Отдых между подходами', prompt: 'Сколько отдыхать между подходами на массу?' },
  { label: 'Силовые и бег', prompt: 'Как совмещать силовые тренировки и бег?' },
  {
    label: 'Разобрать мой план',
    prompt: 'Вот моя тренировка, разбери её и оформи списком «упражнение — подходы×повторы»:\n',
    fill: true, // не отправляем сразу — человек дописывает свой план
  },
]

export default function TrainerChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [exercises, setExercises] = useState([])
  const [plan, setPlan] = useState(null)
  const [building, setBuilding] = useState(false)
  const [focused, setFocused] = useState(false)
  const [myWorkouts, setMyWorkouts] = useState([])
  const [history, setHistory] = useState([])
  const [attachments, setAttachments] = useState({ workoutIds: [], includeHistory: false })
  const feedRef = useRef(null)
  const { ref: textareaRef, adjust } = useAutoResize({ minHeight: 60, maxHeight: 200 })

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Библиотека нужна, только если пользователь решит сохранить план —
  // тянем заранее, чтобы кнопка срабатывала без паузы. Тренировки и лог
  // нужны для панели «приложить свои данные».
  useEffect(() => {
    api.listExercises().then(setExercises).catch(() => {})
    api.listMyWorkouts().then(setMyWorkouts).catch(() => {})
    api.listWorkoutHistory({}).then(setHistory).catch(() => {})
  }, [])

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])
  const hasTrainerReply = messages.some((m) => m.role === 'assistant')

  async function send(text) {
    const content = text.trim()
    if (!content || sending) return

    setError(null)
    setInput('')
    adjust(true)
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setSending(true)

    try {
      const reply = await askTrainer(next, buildContext(attachments, myWorkouts, history))
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message)
      // Вопрос возвращаем в поле, чтобы его не пришлось набирать заново.
      setMessages(messages)
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  async function handleBuildPlan() {
    setError(null)
    setBuilding(true)
    setPlan(null)
    try {
      const result = await planFromChat({ messages, exercises })
      setPlan(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBuilding(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    send(input)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <section className="chat-page">
      <div className="chat-ambient" aria-hidden="true">
        <span className="chat-ambient__blob chat-ambient__blob--1" />
        <span className="chat-ambient__blob chat-ambient__blob--2" />
        <span className="chat-ambient__blob chat-ambient__blob--3" />
      </div>

      <BackLink fallback="/workouts" label="К тренировкам" />

      <header className="chat-head">
        <h2>Чем помочь сегодня?</h2>
        <span className="chat-head__rule" />
        <p>
          Спросите про технику, объём или восстановление. Нужна программа целиком —{' '}
          <Link to="/workouts/ai">соберите её пошагово</Link>.
        </p>
      </header>

      <div className="chat-feed" ref={feedRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>С чего начнём?</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.role}`}>
            <span className="chat-msg__author">{m.role === 'user' ? 'Вы' : 'Тренер'}</span>
            <div className="chat-msg__body">{m.content}</div>
          </div>
        ))}

        {sending && (
          <div className="chat-msg chat-msg--assistant">
            <span className="chat-msg__author">Тренер</span>
            <div className="chat-msg__body chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      <ChatAttachments
        value={attachments}
        onChange={setAttachments}
        workouts={myWorkouts}
        history={history}
      />

      <form className={`chat-composer ${focused ? 'is-focused' : ''}`} onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Например: как построить неделю, если могу ходить только 3 раза?"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            adjust()
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <div className="chat-composer__bar">
          <span className="chat-composer__hint">Enter — отправить, Shift+Enter — перенос строки</span>
          <button type="submit" disabled={sending || !input.trim()}>
            {sending ? <span className="chat-spinner" aria-hidden="true" /> : <span aria-hidden="true">↑</span>}
            {sending ? 'Думает' : 'Спросить'}
          </button>
        </div>
      </form>

      <div className="chat-pills">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s.prompt}
            type="button"
            style={{ animationDelay: `${i * 80}ms` }}
            onClick={() => {
              if (s.fill) {
                setInput(s.prompt)
                textareaRef.current?.focus()
                requestAnimationFrame(adjust)
              } else {
                send(s.prompt)
              }
            }}
            disabled={sending}
          >
            {s.label}
          </button>
        ))}
      </div>

      {hasTrainerReply && (
        <div className="chat-actions">
          <button type="button" onClick={handleBuildPlan} disabled={building || exercises.length === 0}>
            {building ? 'Собираем программу...' : 'Сохранить этот план в тренировки'}
          </button>
          <span className="chat-actions__hint">
            Соберём программу из упражнений библиотеки по тому, что обсудили выше
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {plan && (
        <GeneratedPlan
          plan={plan}
          exerciseById={exerciseById}
          heading="Программа из диалога"
          autoSave
        />
      )}
    </section>
  )
}
