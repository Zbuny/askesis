import { useState } from 'react'
import {
  ENERGY_OPTIONS,
  SLEEP_OPTIONS,
  SORENESS_OPTIONS,
  readinessScore,
} from '../utils/readiness.js'

// Чек-ин перед тренировкой. Три вопроса и ни одним больше: анкету на пять
// экранов перед залом не заполняет никто, а без ответов готовность посчитать
// не из чего — в журнале сна и усталости нет.

const SCALES = [
  { key: 'sleep', title: 'Как спали?', options: SLEEP_OPTIONS },
  { key: 'energy', title: 'Как самочувствие?', options: ENERGY_OPTIONS },
  { key: 'soreness', title: 'Мышцы после прошлой?', options: SORENESS_OPTIONS },
]

export default function ReadinessCheckin({ checkin, onSave, busy }) {
  const [open, setOpen] = useState(!checkin)
  const [draft, setDraft] = useState({
    sleep: checkin?.sleep ?? 3,
    energy: checkin?.energy ?? 3,
    soreness: checkin?.soreness ?? 1,
  })

  const saved = checkin ? readinessScore(checkin) : null
  const preview = readinessScore(draft)

  if (!open && saved) {
    return (
      <div className={`readiness readiness--${saved.tone}`}>
        <div className="readiness__head">
          <div>
            <span className="eyebrow">Готовность сегодня</span>
            <strong>{saved.percent}% · {saved.label}</strong>
          </div>
          <button type="button" onClick={() => setOpen(true)}>Изменить</button>
        </div>
        <p className="readiness__advice">{saved.advice}</p>
      </div>
    )
  }

  return (
    <div className={`readiness readiness--${preview.tone}`}>
      <div className="readiness__head">
        <div>
          <span className="eyebrow">Как вы сегодня?</span>
          <strong>{preview.percent}% · {preview.label}</strong>
        </div>
        {saved && (
          <button type="button" onClick={() => setOpen(false)}>Свернуть</button>
        )}
      </div>

      {SCALES.map((scale) => (
        <div className="readiness__scale" key={scale.key}>
          <span className="readiness__label">{scale.title}</span>
          <div className="readiness__options">
            {scale.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={draft[scale.key] === option.value ? 'is-selected' : undefined}
                aria-pressed={draft[scale.key] === option.value}
                onClick={() => setDraft({ ...draft, [scale.key]: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="readiness__advice">{preview.advice}</p>

      <div className="readiness__actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          // Сворачиваем только после удачной записи: свёрнутая карточка
          // означает «отметка сохранена», и показывать её при ошибке нельзя.
          onClick={async () => {
            if (await onSave(draft)) setOpen(false)
          }}
        >
          {busy ? 'Сохраняем...' : checkin ? 'Обновить' : 'Отметить'}
        </button>
      </div>
    </div>
  )
}
