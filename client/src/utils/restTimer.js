// Отдых между подходами. Чистые функции: сколько отдыхать по умолчанию,
// сколько осталось и как запомнить, что человек поправил время руками.
//
// Время считается от момента окончания (endsAt), а не тикающим счётчиком:
// телефон в зале то и дело гасит экран и замораживает вкладку, и счётчик
// в стейте отставал бы ровно на время сна. Метка времени переживает и это,
// и перезагрузку страницы.

export const REST_MIN = 15
export const REST_MAX = 600
export const REST_STEP = 15

const HEAVY_CATEGORIES = new Set(['powerlifting', 'olympic weightlifting', 'strongman'])
const LIGHT_CATEGORIES = new Set(['stretching', 'cardio'])

// Ориентир — обычные рекомендации для силового тренинга: чем тяжелее и
// короче подход, тем дольше восстанавливается то, что даёт силу. Это
// стартовое значение, а не правило: человек поправит его кнопками ±15,
// и поправка запомнится для этого упражнения.
export function defaultRestSeconds(exercise, item) {
  const reps = Number(item?.targetReps) || 0
  const category = exercise?.category
  if (LIGHT_CATEGORIES.has(category)) return 45
  if (HEAVY_CATEGORIES.has(category) || (reps > 0 && reps <= 5)) return 180
  if (exercise?.equipment === 'barbell' || (reps > 0 && reps <= 8)) return 120
  if (reps >= 12) return 75
  return 90
}

export function clampRest(seconds) {
  const value = Math.round(Number(seconds) || 0)
  return Math.min(REST_MAX, Math.max(REST_MIN, value))
}

export function restSecondsFor({ exercise, item, preferences }) {
  const saved = preferences?.[item?.exerciseId]
  if (saved) return clampRest(saved)
  return defaultRestSeconds(exercise, item)
}

export function remainingSeconds(endsAt, now = Date.now()) {
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

// Доля прошедшего отдыха — для полосы прогресса, от 0 до 1.
export function restProgress({ endsAt, duration }, now = Date.now()) {
  if (!endsAt || !duration) return 0
  const left = remainingSeconds(endsAt, now)
  return Math.min(1, Math.max(0, 1 - left / duration))
}

export function formatRest(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Отметки «подход сделан» меняют то, что попадает в журнал. Пока ни одной
// отметки нет, пишем все заполненные подходы — так страница работала всегда,
// и привычка заполнять поля в конце тренировки не ломается. Как только
// человек начал отмечать, неотмеченные подходы — это подставленные цифры
// прошлого раза, а не сделанная работа, и в журнал они не идут.
export function setsToLog(sets, sessionUsesChecks) {
  return (sets || [])
    .filter((set) => set.weight !== '' || set.reps !== '')
    .filter((set) => !sessionUsesChecks || set.done)
    .map((set) => ({ weight: Number(set.weight) || 0, reps: Number(set.reps) || 0 }))
}

export function countSets(results) {
  let total = 0
  let done = 0
  Object.values(results || {}).forEach((sets) => {
    ;(sets || []).forEach((set) => {
      total += 1
      if (set.done) done += 1
    })
  })
  return { total, done }
}
