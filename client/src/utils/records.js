// Личные рекорды по упражнениям.
//
// Как и серия, рекорды не хранятся отдельной коллекцией, а выводятся из
// журнала тренировок. Причина та же: запись, которую обновляет клиент,
// разъезжается с журналом при любой ошибке сети или удалении тренировки —
// а производная величина всегда сходится с тем, что человек реально сделал.
// Побочный эффект: награда за рекорд не может начислиться дважды при
// перезагрузке страницы, потому что «начисления» как события не существует.

import { estimateOneRepMax } from './repRanges.js'
import { entrySets } from './workoutLog.js'

// Сравнивать подходы по одному весу нечестно: 100 кг × 1 и 100 кг × 8 —
// разные достижения. Приводим к оценке разового максимума, а если повторов
// слишком много для формулы (за 12 она врёт), опираемся на сам вес.
function setScore(set) {
  const weight = Number(set?.weight) || 0
  const reps = Number(set?.reps) || 0
  if (weight <= 0 || reps <= 0) return null
  return {
    weight,
    reps,
    oneRepMax: estimateOneRepMax(weight, reps),
    score: estimateOneRepMax(weight, reps) ?? weight,
  }
}

function bestSetOf(entry) {
  let best = null
  entrySets(entry).forEach((set) => {
    const scored = setScore(set)
    if (!scored) return
    if (!best || scored.score > best.score) best = scored
  })
  return best
}

// history приходит от api.listWorkoutHistory — от свежих к старым. Идём в
// обратном порядке, чтобы «предыдущий рекорд» получался естественно.
function chronological(history = []) {
  return [...history]
    .filter((session) => session?.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

export function personalRecords(history = []) {
  const records = new Map()

  chronological(history).forEach((session) => {
    ;(session.entries || []).forEach((entry) => {
      const best = bestSetOf(entry)
      if (!best || !entry?.exerciseId) return

      const current = records.get(entry.exerciseId)
      if (current && best.score <= current.score) return

      records.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        name: entry.exerciseName || entry.exerciseId,
        weight: best.weight,
        reps: best.reps,
        oneRepMax: best.oneRepMax,
        score: best.score,
        date: session.date,
        sessionId: session.id,
        previous: current ? { weight: current.weight, reps: current.reps, date: current.date } : null,
      })
    })
  })

  return records
}

export function recordList(history = []) {
  return [...personalRecords(history).values()].sort((a, b) => new Date(b.date) - new Date(a.date))
}

// Сколько рекордов принесла каждая тренировка. Нужно и для XP, и для
// разбора «что произошло сегодня» после сохранения.
export function recordsBySession(history = []) {
  const counts = new Map()
  personalRecords(history).forEach((record) => {
    if (!record.sessionId) return
    counts.set(record.sessionId, (counts.get(record.sessionId) || 0) + 1)
  })
  return counts
}

// Насколько выросли по сравнению с прошлым рекордом — для строки «+5 кг».
export function recordGain(record) {
  if (!record?.previous) return null
  const gain = Math.round((record.weight - record.previous.weight) * 10) / 10
  return gain > 0 ? gain : null
}
