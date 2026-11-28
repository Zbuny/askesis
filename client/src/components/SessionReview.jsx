import { Link } from 'react-router-dom'
import { aiConfigured } from '../api/ai.js'
import { useCoachReply } from '../hooks/useCoachReply.js'
import { useCountUp } from '../hooks/useCountUp.js'
import { reviewFacts } from '../utils/sessionReview.js'
import { RIR_TOO_EASY } from '../utils/repRanges.js'
import { pluralRu } from '../utils/translate.js'

// Разбор сразу после того, как тренировка записана. Главное здесь — колонка
// «в следующий раз»: без неё человек уходит со страницы и на следующей
// тренировке заново вспоминает, с какого веса заходил.

// Прочерк вместо «раньше не делали»: в колонке рядом с результатом длинная
// фраза только мешает, а сам факт виден по пустому месту.
function deltaLabel(change) {
  if (!change) return null
  if (change.value > 0) return { text: `+${change.value} ${change.unit}`, tone: 'up' }
  if (change.value < 0) return { text: `${change.value} ${change.unit}`, tone: 'down' }
  return { text: change.unit === 'кг' ? 'тот же вес' : 'столько же', tone: 'same' }
}

export default function SessionReview({ review, onClose }) {
  const { reply, busy, error, explain } = useCoachReply('session')
  const xp = useCountUp(review?.xp || 0)

  if (!review) return null

  const done = review.exercises.map((row) => `${row.name} — ${row.done}`).join('; ')
  const ask = `Сегодня я сделал: ${done}. Что стоит поменять в следующий раз?`

  return (
    <div className={`review review--${review.tone}`}>
      <div className="review__head">
        <div>
          <span className="eyebrow">Разбор тренировки</span>
          <h3>{review.headline}</h3>
        </div>
        <button type="button" className="review__close" onClick={onClose} aria-label="Закрыть разбор">
          ×
        </button>
      </div>

      <div className="review__stats">
        <div className="review__stat">
          <strong>+{xp}</strong>
          <span>XP</span>
        </div>
        <div className="review__stat">
          <strong>{review.sets}</strong>
          <span>{pluralRu(review.sets, 'подход', 'подхода', 'подходов')}</span>
        </div>
        <div className="review__stat">
          <strong>{review.volume.toLocaleString('ru-RU')}</strong>
          <span>
            кг объёма
            {review.compare && (
              <em className={`review__delta review__delta--${review.compare.delta >= 0 ? 'up' : 'down'}`}>
                {review.compare.delta >= 0 ? '+' : ''}{review.compare.percent}%
              </em>
            )}
          </span>
        </div>
        <div className="review__stat">
          <strong>{review.minutes || '—'}</strong>
          <span>{review.minutes ? 'минут в зале' : 'время не засечено'}</span>
        </div>
      </div>

      {review.levelUp && (
        <div className="review__levelup">
          <span className="review__levelup-mark" aria-hidden="true" />
          <div>
            <strong>Уровень {review.levelUp.level}</strong>
            <span>{review.levelUp.title} — взят этой тренировкой</span>
          </div>
        </div>
      )}

      {review.records.length > 0 && (
        <div className="review__records">
          {review.records.map((record) => (
            <span key={record.exerciseId} className="review__record">
              <strong>{record.name}</strong> {record.weight} кг × {record.reps}
              {record.gain ? <em>+{record.gain} кг</em> : <em>первый рекорд</em>}
            </span>
          ))}
        </div>
      )}

      <table className="review__table">
        <thead>
          <tr>
            <th>Упражнение</th>
            <th>Сегодня</th>
            <th>В следующий раз</th>
          </tr>
        </thead>
        <tbody>
          {review.exercises.map((row) => {
            const delta = deltaLabel(row.change)
            return (
              <tr key={row.exerciseId}>
                <td>{row.name}</td>
                <td>
                  {row.done}
                  {delta && <em className={`review__delta review__delta--${delta.tone}`}>{delta.text}</em>}
                  {row.rirLabel && (
                    <small className={row.rir >= RIR_TOO_EASY ? 'review__rir review__rir--easy' : 'review__rir'}>
                      запас: {row.rirLabel.toLowerCase()}
                    </small>
                  )}
                </td>
                <td>
                  <span className={`review__next review__next--${row.nextAction}`}>{row.next}</span>
                  <small>{row.nextHint}</small>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {review.notes.length > 0 && (
        <ul className="review__notes">
          {review.notes.map((note, i) => (
            <li key={i} className={`review__note review__note--${note.tone}`}>{note.text}</li>
          ))}
        </ul>
      )}

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
            <button type="button" onClick={() => explain(reviewFacts(review))} disabled={busy}>
              {busy && <span className="chat-spinner" aria-hidden="true" />}
              {busy ? 'Разбираем' : 'Что скажет тренер'}
            </button>
          )}
          <Link to={`/workouts/chat?q=${encodeURIComponent(ask)}`} className="coach__link">
            Обсудить с тренером →
          </Link>
        </div>
      )}
    </div>
  )
}
