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
//
// По умолчанию свёрнут в одну строку. Развёрнутые шкалы занимали целый экран
// над первым упражнением, и в зале их приходилось пролистывать каждый раз.
// Раньше решение «развернуть» принималось при первой отрисовке, когда
// сегодняшняя отметка ещё не загрузилась, — и форма оставалась открытой
// даже у того, кто уже ответил.

const SCALES = [
  { key: 'sleep', title: 'Как спали?', options: SLEEP_OPTIONS },
  { key: 'energy', title: 'Как самочувствие?', options: ENERGY_OPTIONS },
  { key: 'soreness', title: 'Мышцы после прошлой?', options: SORENESS_OPTIONS },
]

function draftFrom(checkin) {
  return {
    sleep: checkin?.sleep ?? 3,
    energy: checkin?.energy ?? 3,
    soreness: checkin?.soreness ?? 1,
  }
}

export default function ReadinessCheckin({ checkin, onSave, busy }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => draftFrom(checkin))

  const saved = checkin ? readinessScore(checkin) : null
  const preview = readinessScore(draft)

  // Черновик берём из отметки в момент открытия, а не при монтировании:
  // к этому времени она уже загружена, и «Изменить» показывает свои ответы,
  // а не значения по умолчанию.
  function openEditor() {
    setDraft(draftFrom(checkin))
    setOpen(true)
  }

  if (!open && saved) {
    return (
      <div className={`readiness readiness--compact readiness--${saved.tone}`}>
        <div className="readiness__head">
          <div>
            <span className="eyebrow">Готовность сегодня</span>
            <strong>{saved.percent}% · {saved.label}</strong>
          </div>
          <button type="button" onClick={openEditor}>Изменить</button>
        </div>
        <p className="readiness__advice">{saved.advice}</p>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="readiness readiness--compact">
        <div className="readiness__head">
          <div>
            <span className="eyebrow">Как вы сегодня?</span>
            <strong>Три вопроса — подскажем, брать ли прибавку</strong>
          </div>
          <button type="button" onClick={openEditor}>Ответить</button>
        </div>
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
        <button type="button" onClick={() => setOpen(false)}>Свернуть</button>
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
