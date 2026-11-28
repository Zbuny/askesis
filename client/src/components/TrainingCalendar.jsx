import { useMemo, useState } from 'react'
import { pluralRu } from '../utils/translate.js'

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function isSameDay(a, b) {
  return dayKey(a) === dayKey(b)
}

// onSelectDay необязателен: в профиле календарь остаётся просто картой
// активности, а на статистике по дню раскрывается разбор тренировки.
// Без обработчика ячейки не становятся кнопками — иначе скринридер обещал
// бы действие, которого нет.
export default function TrainingCalendar({ sessions, onSelectDay, selectedKey }) {
  const [offset, setOffset] = useState(0) // 0 — текущий месяц, -1 — предыдущий

  const byDay = useMemo(() => {
    const map = new Map()
    sessions.forEach((session) => {
      const date = new Date(session.date)
      const key = dayKey(date)
      const entry = map.get(key) || { count: 0, minutes: 0 }
      entry.count += 1
      entry.minutes += session.durationMinutes || 0
      map.set(key, entry)
    })
    return map
  }, [sessions])

  const today = new Date()
  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1)

  const monthName = shown.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  const cells = useMemo(() => {
    const firstDay = new Date(shown.getFullYear(), shown.getMonth(), 1)
    const daysInMonth = new Date(shown.getFullYear(), shown.getMonth() + 1, 0).getDate()
    // Пн — первый столбец, поэтому воскресенье (0) уезжает в конец недели.
    const leading = (firstDay.getDay() + 6) % 7

    const list = []
    for (let i = 0; i < leading; i += 1) list.push(null)
    for (let d = 1; d <= daysInMonth; d += 1) {
      list.push(new Date(shown.getFullYear(), shown.getMonth(), d))
    }
    return list
  }, [shown.getFullYear(), shown.getMonth()])

  const monthStats = useMemo(() => {
    let days = 0
    let count = 0
    let minutes = 0
    cells.forEach((date) => {
      if (!date) return
      const entry = byDay.get(dayKey(date))
      if (entry) {
        days += 1
        count += entry.count
        minutes += entry.minutes
      }
    })
    return { days, count, minutes }
  }, [cells, byDay])

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Предыдущий месяц">←</button>
        <span className="calendar__month">{monthName}</span>
        <button
          type="button"
          onClick={() => setOffset(offset + 1)}
          disabled={offset >= 0}
          aria-label="Следующий месяц"
        >
          →
        </button>
      </div>

      <div className="calendar__weekdays">
        {DAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar__grid">
        {cells.map((date, i) => {
          if (!date) return <span key={`empty-${i}`} className="calendar__cell is-empty" />

          const entry = byDay.get(dayKey(date))
          const future = date > today && !isSameDay(date, today)
          const classes = [
            'calendar__cell',
            entry ? 'is-active' : '',
            isSameDay(date, today) ? 'is-today' : '',
            future ? 'is-future' : '',
            selectedKey && selectedKey === dayKey(date) ? 'is-selected' : '',
          ].filter(Boolean).join(' ')

          const label = entry
            ? `${date.toLocaleDateString('ru-RU')} — тренировок: ${entry.count}${entry.minutes ? `, ${entry.minutes} мин` : ''}`
            : date.toLocaleDateString('ru-RU')

          // Кнопкой делаем только дни с записями: пустой день раскрывать нечем.
          if (onSelectDay && entry) {
            return (
              <button
                key={dayKey(date)}
                type="button"
                className={classes}
                title={label}
                aria-label={label}
                aria-pressed={selectedKey === dayKey(date)}
                onClick={() => onSelectDay(date, dayKey(date))}
              >
                <span className="calendar__num">{date.getDate()}</span>
                {entry.count > 1 && <span className="calendar__badge">{entry.count}</span>}
              </button>
            )
          }

          return (
            <span key={dayKey(date)} className={classes} title={label}>
              <span className="calendar__num">{date.getDate()}</span>
              {entry && entry.count > 1 && <span className="calendar__badge">{entry.count}</span>}
            </span>
          )
        })}
      </div>

      <p className="calendar__summary">
        {monthStats.days > 0
          ? `Записей: ${monthStats.count} за ${monthStats.days} ${pluralRu(monthStats.days, 'день', 'дня', 'дней')}${monthStats.minutes ? ` · ${monthStats.minutes} мин в зале` : ''}`
          : 'В этом месяце записей пока нет'}
      </p>
    </div>
  )
}
