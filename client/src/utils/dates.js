// Работа с «днями» в местном времени.
//
// Всё, что считает серии и дневные итоги, обязано мерить дни так же, как их
// видит человек на своих часах. toISOString() для этого не годится: он
// переводит в UTC, и тренировка в 23:30 по Москве уезжает на следующий день,
// а в Лос-Анджелесе в 17:00 — на текущий. Серия из-за этого рвётся или
// склеивается на ровном месте.
//
// Поэтому ключ дня собираем из местных геттеров, а шагаем по дням через
// полдень: в дни перевода часов сутки длятся 23 или 25 часов, и прибавление
// ровно 24 часов рано или поздно перепрыгнуло бы день или вернулось в тот же.

export function localDayKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Полдень выбранного дня — безопасная точка отсчёта для сдвигов.
export function startOfLocalDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(12, 0, 0, 0)
  return date
}

export function addDays(value, amount) {
  const date = startOfLocalDay(value)
  if (!date) return null
  date.setDate(date.getDate() + amount)
  return date
}

// Понедельник той недели, в которую попал день. Неделя начинается с
// понедельника: у getDay() воскресенье — 0, поэтому сдвигаем на (day+6)%7.
export function startOfLocalWeek(value) {
  const date = startOfLocalDay(value)
  if (!date) return null
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

export function weekKey(value) {
  return localDayKey(startOfLocalWeek(value))
}

// Уникальные дни, в которые что-то происходило, по возрастанию.
export function uniqueDayKeys(values = []) {
  const keys = new Set()
  values.forEach((value) => {
    const key = localDayKey(value)
    if (key) keys.add(key)
  })
  return [...keys].sort()
}
