import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { askTrainer } from '../api/ai.js'
import BackLink from '../components/BackLink.jsx'

const SUGGESTIONS = [
  'Составь мне сплит на 4 дня',
  'Чем заменить становую тягу при больной пояснице?',
  'Сколько отдыхать между подходами на массу?',
  'Как совмещать силовые и бег?',
]

export default function TrainerChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const feedRef = useRef(null)

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function send(text) {
    const content = text.trim()
    if (!content || sending) return

    setError(null)
    setInput('')
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setSending(true)

    try {
      const reply = await askTrainer(next)
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
      <BackLink fallback="/workouts" label="К тренировкам" />
      <h2>Спросить тренера</h2>
      <p className="chat-page__lead">
        Задайте вопрос про тренировки, технику или восстановление. Нужна готовая программа целиком —{' '}
        <Link to="/workouts/ai">соберите её пошагово</Link>.
      </p>

      <div className="chat-feed" ref={feedRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>С чего начнём?</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
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

      {error && <p className="error">{error}</p>}

      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          rows={2}
          placeholder="Например: как построить неделю, если могу ходить только 3 раза?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          {sending ? '...' : 'Спросить'}
        </button>
      </form>
    </section>
  )
}
