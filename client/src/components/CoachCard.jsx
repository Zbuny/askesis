import { Link } from 'react-router-dom'
import { aiConfigured } from '../api/ai.js'
import { useCoachReply } from '../hooks/useCoachReply.js'

// Карточка тренера: сначала то, что посчитано на клиенте, и только потом —
// по нажатию — комментарий модели. Порядок принципиальный: наблюдения должны
// быть на экране и когда воркер не развёрнут, и когда Groq лежит.

export default function CoachCard({
  insights = [],
  facts = [],
  kind = 'dashboard',
  eyebrow = 'Тренер',
  limit = 3,
}) {
  const { reply, busy, error, explain } = useCoachReply(kind)

  if (insights.length === 0) return null

  const shown = insights.slice(0, limit)
  // Готовый вопрос берём у самого важного наблюдения, у которого он есть:
  // «спросить тренера» без темы открывает пустой чат, и человек начинает
  // формулировать заново то, что приложение уже сформулировало за него.
  const ask = shown.find((item) => item.ask)?.ask

  return (
    <div className="coach">
      <div className="coach__head">
        <span className="eyebrow">{eyebrow}</span>
        {insights.length > shown.length && (
          <span className="coach__more">и ещё {insights.length - shown.length}</span>
        )}
      </div>

      <ul className="coach__list">
        {shown.map((item) => (
          <li key={item.key} className={`coach__item coach__item--${item.tone}`}>
            <strong className="coach__title">{item.title}</strong>
            <p className="coach__text">{item.text}</p>
            {item.action && (
              <Link to={item.action.to} className="coach__action">
                {item.action.label} →
              </Link>
            )}
          </li>
        ))}
      </ul>

      {reply && (
        <div className="coach__reply">
          <span className="coach__reply-author">Тренер</span>
          <p>{reply}</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {aiConfigured && (
        <div className="coach__actions">
          {!reply && (
            <button type="button" onClick={() => explain(facts)} disabled={busy}>
              {busy && <span className="chat-spinner" aria-hidden="true" />}
              {busy ? 'Разбираем' : 'Что это значит'}
            </button>
          )}
          <Link
            to={ask ? `/workouts/chat?q=${encodeURIComponent(ask)}` : '/workouts/chat'}
            className="coach__link"
          >
            Спросить тренера →
          </Link>
        </div>
      )}
    </div>
  )
}
