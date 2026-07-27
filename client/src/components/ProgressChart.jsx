import { useEffect, useRef } from 'react'

const WIDTH = 640
const HEIGHT = 220
const PADDING_X = 34
const PADDING_Y = 30

export default function ProgressChart({ points, unit = 'кг' }) {
  const pathRef = useRef(null)

  const values = points.map((p) => p.value)
  const minValue = points.length ? Math.min(...values) : 0
  const maxValue = points.length ? Math.max(...values) : 0
  const valueRange = maxValue - minValue || 1

  const stepX = points.length > 1 ? (WIDTH - PADDING_X * 2) / (points.length - 1) : 0
  const coords = points.map((p, i) => ({
    ...p,
    x: PADDING_X + i * stepX,
    y: HEIGHT - PADDING_Y - ((p.value - minValue) / valueRange) * (HEIGHT - PADDING_Y * 2),
  }))

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const areaPath = coords.length
    ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${HEIGHT - PADDING_Y} L ${coords[0].x.toFixed(1)} ${HEIGHT - PADDING_Y} Z`
    : ''

  // Перезапускаем отрисовку линии каждый раз, когда меняется набор точек.
  useEffect(() => {
    const path = pathRef.current
    if (!path) return
    const length = path.getTotalLength()
    path.style.transition = 'none'
    path.style.strokeDasharray = String(length)
    path.style.strokeDashoffset = String(length)
    void path.getBoundingClientRect()
    path.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1)'
    path.style.strokeDashoffset = '0'
  }, [linePath])

  if (points.length === 0) return null

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="progress-chart" role="img">
      <defs>
        <linearGradient id="progress-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line
        x1={PADDING_X}
        y1={HEIGHT - PADDING_Y}
        x2={WIDTH - PADDING_X}
        y2={HEIGHT - PADDING_Y}
        className="progress-chart__axis"
      />

      {coords.length > 1 && <path d={areaPath} fill="url(#progress-chart-fill)" className="progress-chart__area" />}
      {coords.length > 1 && <path ref={pathRef} d={linePath} className="progress-chart__line" fill="none" />}

      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="4.5" className="progress-chart__dot" style={{ animationDelay: `${i * 90 + 300}ms` }}>
          <title>{`${c.label}: ${c.value} ${unit}`}</title>
        </circle>
      ))}

      <text x={PADDING_X} y={PADDING_Y - 10} className="progress-chart__value">{maxValue} {unit}</text>
      <text x={PADDING_X} y={HEIGHT - PADDING_Y + 20} className="progress-chart__value">{minValue} {unit}</text>
    </svg>
  )
}
