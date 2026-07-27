const WEEKS = 26
const DAY_LABELS = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс']

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// Понедельник той недели, в которую попадает переданная дата.
function startOfWeek(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  const weekday = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - weekday)
  return result
}

export default function TrainingHeatmap({ sessions }) {
  const countByDay = new Map()
  sessions.forEach((session) => {
    const key = dayKey(new Date(session.date))
    countByDay.set(key, (countByDay.get(key) || 0) + 1)
  })

  const firstWeek = startOfWeek(new Date())
  firstWeek.setDate(firstWeek.getDate() - (WEEKS - 1) * 7)

  const weeks = []
  for (let week = 0; week < WEEKS; week += 1) {
    const days = []
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(firstWeek)
      date.setDate(firstWeek.getDate() + week * 7 + day)
      days.push({ date, count: countByDay.get(dayKey(date)) || 0, future: date > new Date() })
    }
    weeks.push(days)
  }

  return (
    <div className="heatmap">
      <div className="heatmap__days">
        {DAY_LABELS.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="heatmap__grid">
        {weeks.map((days, weekIndex) => (
          <div className="heatmap__week" key={weekIndex}>
            {days.map(({ date, count, future }) => (
              <span
                key={date.toISOString()}
                className={`heatmap__cell${count > 0 ? ' is-active' : ''}${future ? ' is-future' : ''}`}
                style={count > 1 ? { opacity: Math.min(1, 0.55 + count * 0.22) } : undefined}
                title={`${date.toLocaleDateString('ru-RU')}${count ? ` — тренировок: ${count}` : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
