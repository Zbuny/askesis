import { useEffect, useRef, useState } from 'react'
import { askTrainer } from '../api/ai.js'
import { quickQuestions } from '../utils/sessionCoach.js'

// Тренер прямо на странице тренировки. Раньше спросить можно было только в
// отдельном чате: уйти туда посреди подхода, объяснить, что за тренировка и
// какие веса, а потом искать дорогу обратно. Здесь окно открывается поверх
// формы, введённые подходы остаются на месте, а сама тренировка уходит с
// каждым вопросом автоматически (см. utils/sessionCoach.js).
//
// Компонент смонтирован всё время, пока открыта тренировка: переписка
// переживает закрытие окна, и между подходами можно вернуться к ответу.

// То же, что в общем чате: инвентарь и ограничения меняют сам набор
// допустимых советов, поэтому идут с каждым вопросом.
function withProfile(context, profile) {
  const limits = profile?.limits?.trim()
  const equipment = profile?.equipment
  if (!limits && !equipment?.length) return context
  return { ...context, profile: { limits: limits || '', equipment: equipment || [] } }
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      <path d="M9 11h6M9 15h4" />
    </svg>
  )
}

export function SessionCoachButton({ onClick, hasReplies }) {
  return (
    <button type="button" className="session-coach-fab" onClick={onClick} aria-label="Спросить тренера">
      <ChatIcon />
      <span>Тренер</span>
      {hasReplies && <span className="session-coach-fab__dot" aria-hidden="true" />}
    </button>
  )
}

export default function SessionCoach({ open, onClose, focusName, getContext, profile, onRepliesChange }) {
  const dialogRef = useRef(null)
  const feedRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Esc закрывает <dialog> мимо React — сообщаем наружу, чтобы состояние
  // кнопки и окна не разошлось.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, open])

  useEffect(() => {
    onRepliesChange?.(messages.some((m) => m.role === 'assistant'))
  }, [messages, onRepliesChange])

  async function send(text) {
    const content = text.trim()
    if (!content || sending) return
    setError(null)
    setInput('')
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setSending(true)
    try {
      // Контекст берём в момент отправки, а не при открытии окна: между
      // вопросами человек успевает дописать подход.
      const reply = await askTrainer(next, withProfile({ session: getContext() }, profile))
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message)
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

  // Клик по затемнению вокруг окна — тот же «закрыть», что и Esc.
  function handleBackdrop(e) {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="session-coach"
      aria-labelledby="session-coach-title"
      onClick={handleBackdrop}
    >
      <div className="session-coach__inner">
        <header className="session-coach__head">
          <div>
            <h3 id="session-coach-title">Тренер</h3>
            <p>{focusName ? `Про «${focusName}» и всю тренировку` : 'Видит вашу тренировку и цифры в форме'}</p>
          </div>
          <button type="button" className="session-coach__close" onClick={onClose} aria-label="Закрыть тренера">
            ×
          </button>
        </header>

        <div className="session-coach__feed" ref={feedRef} aria-live="polite">
          {messages.length === 0 && !sending && (
            <p className="session-coach__empty">
              Спросите между подходами — про вес, отдых, технику или замену. Ответ будет коротким и по вашим цифрам.
            </p>
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
              <div className="chat-msg__body chat-typing" aria-label="Тренер печатает">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        <div className="session-coach__quick">
          {quickQuestions(focusName).map((question) => (
            <button key={question} type="button" onClick={() => send(question)} disabled={sending}>
              {question}
            </button>
          ))}
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <form className="session-coach__composer" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="session-coach-input">Вопрос тренеру</label>
          <textarea
            id="session-coach-input"
            rows={1}
            placeholder="Свой вопрос…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" disabled={sending || !input.trim()}>
            {sending ? 'Думает' : 'Спросить'}
          </button>
        </form>
      </div>
    </dialog>
  )
}
