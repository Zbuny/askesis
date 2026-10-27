import { useId } from 'react'

// Кольцо прогресса: недельная цель на «Обзоре». Полоса читается как «загрузка»,
// а кольцо — как цель, которую закрываешь, и даёт экрану одну яркую точку,
// за которую цепляется глаз.
export default function ProgressRing({ value = 0, max = 1, size = 88, stroke = 7, label, caption }) {
  const gradientId = useId()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
  const done = ratio >= 1

  // Размер на экране задаёт CSS (.ring), size — только система координат
  // SVG: так кольцо можно ужать на телефоне без второго набора пропсов.
  return (
    <div
      className={`ring${done ? ' is-done' : ''}`}
      role="img"
      aria-label={`${label}: ${value} из ${max}`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-bright)" />
            <stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring__value" aria-hidden="true">
        <strong>{value}<small>/{max}</small></strong>
        {caption && <span>{caption}</span>}
      </span>
    </div>
  )
}
