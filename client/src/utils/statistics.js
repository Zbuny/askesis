// Сводка по журналу тренировок: то, из чего собирается экран статистики.
//
// Всё считается из уже загруженной истории — отдельных запросов и
// счётчиков в базе нет по той же причине, что и у XP: производная величина
// не расходится с журналом и не требует миграций при смене формулы.

import { entrySets, entryTopWeight, entryVolume, sessionVolume } from './workoutLog.js'
import { localDayKey, startOfLocalDay } from './dates.js'
import { translateMuscle } from './translate.js'
import { estimateOneRepMax } from './repRanges.js'

export const PERIODS = [
  { key: 'month', label: 'Месяц', days: 30 },
  { key: 'year', label: 'Год', days: 365 },
  { key: 'all', label: 'Всё время', days: null },
]

export function filterByPeriod(history = [], periodKey = 'month', now = new Date()) {
  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[0]
  if (!period.days) return [...history]

  const from = startOfLocalDay(now)
  from.setDate(from.getDate() - period.days)
  return history.filter((session) => new Date(session.date) >= from)
}

export function kpis(history = []) {
  const sessions = history.length
  const sets = history.reduce(
    (sum, session) =>
      sum +
      (session.entries || []).reduce(
        (count, entry) => count + entrySets(entry).filter((set) => (Number(set.reps) || 0) > 0).length,
        0,
      ),
    0,
  )
  const volume = history.reduce((sum, session) => sum + sessionVolume(session), 0)
  const minutes = history.reduce((sum, session) => sum + (Number(session.durationMinutes) || 0), 0)

  return {
    sessions,
    sets,
    volume: Math.round(volume),
    minutes,
    hours: Math.round((minutes / 60) * 10) / 10,
    // Средняя длительность считается только по тренировкам с включённым
    // таймером: иначе пропуски занижали бы её до бессмыслицы.
    avgMinutes: (() => {
      const timed = history.filter((session) => Number(session.durationMinutes) > 0)
      return timed.length ? Math.round(timed.reduce((s, x) => s + x.durationMinutes, 0) / timed.length) : 0
    })(),
  }
}

// Объём по группам мышц. Группа берётся из каталога упражнений: в самом
// журнале её нет, поэтому без каталога честнее показать «Без группы», чем
// подсовывать выдуманную привязку.
export function muscleVolume(history = [], exerciseById = new Map()) {
  const totals = new Map()

  history.forEach((session) => {
    ;(session.entries || []).forEach((entry) => {
      const group = exerciseById.get?.(entry.exerciseId)?.muscleGroup || null
      const key = group || 'other'
      const current = totals.get(key) || {
        key,
        label: group ? translateMuscle(group) : 'Без группы',
        volume: 0,
        sets: 0,
      }
      current.volume += entryVolume(entry)
      current.sets += entrySets(entry).filter((set) => (Number(set.reps) || 0) > 0).length
      totals.set(key, current)
    })
  })

  const rows = [...totals.values()].sort((a, b) => b.volume - a.volume || b.sets - a.sets)
  const max = rows[0]?.volume || 0
  return rows.map((row) => ({
    ...row,
    volume: Math.round(row.volume),
    percent: max > 0 ? Math.round((row.volume / max) * 100) : 0,
  }))
}

// Прогресс силы по упражнению: лучший подход каждой тренировки.
export function strengthSeries(history = [], exerciseId) {
  if (!exerciseId) return []
  return history
    .filter((session) => (session.entries || []).some((entry) => entry.exerciseId === exerciseId))
    .map((session) => {
      const entry = session.entries.find((e) => e.exerciseId === exerciseId)
      const top = entryTopWeight(entry)
      const best = entrySets(entry)
        .map((set) => ({ ...set, e1rm: estimateOneRepMax(set.weight, set.reps) }))
        .filter((set) => set.e1rm)
        .sort((a, b) => b.e1rm - a.e1rm)[0]
      return { date: session.date, weight: top, oneRepMax: best?.e1rm || null }
    })
    .filter((point) => point.weight > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

// Какие упражнения вообще встречались — для выпадающего списка.
export function trainedExercises(history = []) {
  const map = new Map()
  history.forEach((session) => {
    ;(session.entries || []).forEach((entry) => {
      if (!entry?.exerciseId) return
      const current = map.get(entry.exerciseId) || { exerciseId: entry.exerciseId, name: entry.exerciseName || entry.exerciseId, count: 0 }
      current.count += 1
      map.set(entry.exerciseId, current)
    })
  })
  return [...map.values()].sort((a, b) => b.count - a.count)
}

// Сводка по одному дню — её показывает календарь по нажатию на дату.
export function daySummary(history = [], dayKey) {
  const sessions = history.filter((session) => localDayKey(session.date) === dayKey)
  if (sessions.length === 0) return null

  const sets = sessions.reduce(
    (sum, session) =>
      sum +
      (session.entries || []).reduce(
        (count, entry) => count + entrySets(entry).filter((set) => (Number(set.reps) || 0) > 0).length,
        0,
      ),
    0,
  )

  return {
    dayKey,
    sessions,
    titles: sessions.map((session) => session.workoutTitle).filter(Boolean),
    exercises: sessions.reduce((sum, session) => sum + (session.entries?.length || 0), 0),
    sets,
    volume: Math.round(sessions.reduce((sum, session) => sum + sessionVolume(session), 0)),
    minutes: sessions.reduce((sum, session) => sum + (Number(session.durationMinutes) || 0), 0),
  }
}
