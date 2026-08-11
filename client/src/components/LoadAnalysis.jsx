import { useMemo } from 'react'
import { analyzeWorkout } from '../utils/workoutAnalysis.js'
import { WEEKLY_SETS_PER_MUSCLE, recommendedReps } from '../utils/repRanges.js'
import { pluralRu } from '../utils/translate.js'

// Живой разбор того, что человек набрал в конструкторе: во что складываются
// подходы по группам мышц и чего они стоят с поправкой на повторы.
export default function LoadAnalysis({ items, exerciseById, level }) {
  const analysis = useMemo(() => analyzeWorkout(items, exerciseById), [items, exerciseById])
  const advice = recommendedReps(level)

  if (!analysis.totalSets) return null

  const { totalSets, totalEffective, zones, muscles, notes } = analysis
  // Показываем «эталонные» подходы только когда они разошлись с обычными —
  // иначе два одинаковых числа рядом только путают.
  const showEffective = Math.abs(totalEffective - totalSets) >= 0.1

  return (
    <div className="load-analysis">
      <div className="load-analysis__head">
        <strong>{totalSets}</strong>
        <span>{pluralRu(totalSets, 'подход', 'подхода', 'подходов')} за тренировку</span>
        {showEffective && (
          <span className="load-analysis__effective">
            эффективных — {totalEffective}
          </span>
        )}
      </div>

      <p className="load-analysis__advice">
        Рекомендуем <strong>{advice.min}–{advice.max} повторений</strong>. {advice.why}
      </p>

      <div className="load-analysis__zones" role="img" aria-label="Распределение подходов по диапазонам">
        {zones.map((zone) => (
          <span
            key={zone.key}
            className={`load-analysis__zone load-analysis__zone--${zone.tone}`}
            style={{ width: `${zone.percent}%` }}
            title={`${zone.label}: ${zone.sets} из ${totalSets}`}
          />
        ))}
      </div>
      <ul className="load-analysis__legend">
        {zones.map((zone) => (
          <li key={zone.key}>
            <span className={`load-analysis__dot load-analysis__dot--${zone.tone}`} />
            {zone.label} — {zone.percent}%
          </li>
        ))}
      </ul>

      <ul className="load-analysis__muscles">
        {muscles.map((muscle) => (
          <li key={muscle.key} className={muscle.overloaded ? 'is-overloaded' : ''}>
            <span>{muscle.label}</span>
            <span>
              {muscle.sets}
              {Math.abs(muscle.effective - muscle.sets) >= 0.1 && ` → ${muscle.effective}`}
            </span>
          </li>
        ))}
      </ul>

      <ul className="load-analysis__notes">
        {notes.map((note, i) => (
          <li key={i} className={`load-analysis__note load-analysis__note--${note.tone}`}>
            {note.text}
          </li>
        ))}
      </ul>

      <p className="load-analysis__hint">
        Рост мышц одинаков в окне 6–30 повторений, если подход доведён близко до отказа: диапазон
        меняет не результат, а цену подхода. За неделю на группу мышц набирайте{' '}
        {WEEKLY_SETS_PER_MUSCLE.min}–{WEEKLY_SETS_PER_MUSCLE.max} подходов.
      </p>
    </div>
  )
}
