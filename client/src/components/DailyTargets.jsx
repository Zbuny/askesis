import { Link } from 'react-router-dom'
import { aiConfigured } from '../api/ai.js'
import { useCoachReply } from '../hooks/useCoachReply.js'
import { LABELS, nutritionFacts } from '../utils/nutrition.js'

// Норма без факта — таблица, факт без нормы — набор цифр. Смысл появляется
// только когда они рядом, поэтому этот блок и стоит над историей приёмов.

export default function DailyTargets({ targets, progress }) {
  const { reply, busy, error, explain } = useCoachReply('nutrition')

  if (!targets) {
    return (
      <p className="targets__empty">
        Чтобы посчитать дневную норму, нужны рост, вес и возраст.{' '}
        <Link to="/profile">Заполните их в профиле</Link> — норма появится здесь сама.
      </p>
    )
  }

  const rows = Object.values(progress)

  return (
    <div className="targets">
      <div className="targets__head">
        <span className="eyebrow">Дневная норма</span>
        <span className="targets__basis">
          обмен {targets.bmr} ккал × активность {targets.factor}
        </span>
      </div>

      <div className="targets__grid">
        {rows.map((row) => (
          <div key={row.key} className={`targets__row${row.over > 0 ? ' is-over' : ''}`}>
            <div className="targets__label">
              <span>{LABELS[row.key]}</span>
              <strong>
                {row.eaten} <em>/ {row.target} {row.unit}</em>
              </strong>
            </div>
            <div className="targets__bar">
              {/* Полоса не растёт дальше 100%: перебор показываем цветом и
                  подписью, иначе на 300% она вылезает за карточку. */}
              <span className="targets__fill" style={{ width: `${Math.min(100, row.percent)}%` }} />
            </div>
            <span className="targets__note">
              {row.over > 0 ? `перебор ${row.over} ${row.unit}` : `осталось ${row.left} ${row.unit}`}
            </span>
          </div>
        ))}
      </div>

      <p className="targets__hint">
        {targets.hint}
        {targets.approximate && (
          <> Пол не указан — норма посчитана по усреднённой формуле и может отличаться примерно на 165 ккал. <Link to="/profile">Уточнить</Link>.</>
        )}
      </p>

      {reply && (
        <div className="coach__reply">
          <span className="coach__reply-author">Тренер</span>
          <p>{reply}</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {aiConfigured && !reply && (
        <div className="coach__actions">
          <button type="button" onClick={() => explain(nutritionFacts(targets, progress))} disabled={busy}>
            {busy && <span className="chat-spinner" aria-hidden="true" />}
            {busy ? 'Разбираем' : 'Совет по сегодняшнему дню'}
          </button>
        </div>
      )}
    </div>
  )
}
