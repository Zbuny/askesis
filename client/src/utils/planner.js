// Что предложить на сегодня.
//
// Расписания в приложении нет, и выдумывать его рано: человек сам решает,
// в какой день идёт в зал. Поэтому «тренировка на сегодня» — это та, до
// которой дольше всего не доходили. Такой порядок сам собой прокручивает
// цикл (день груди → день спины → день ног) и не требует ни календаря, ни
// настройки, а после долгого перерыва предлагает то, что реально отстало.

import { localDayKey } from './dates.js'

// Когда каждую тренировку выполняли в последний раз.
export function lastPerformed(history = []) {
  const map = new Map()
  history.forEach((session) => {
    if (!session?.workoutId || !session?.date) return
    const current = map.get(session.workoutId)
    if (!current || new Date(session.date) > new Date(current)) {
      map.set(session.workoutId, session.date)
    }
  })
  return map
}

export function suggestTodayWorkout(workouts = [], history = []) {
  if (workouts.length === 0) return null

  const performed = lastPerformed(history)

  // Ни разу не выполненная тренировка идёт первой: её ради этого и создали.
  // Дальше — по давности. Сортировка устойчивая: при равных датах порядок
  // задаёт название, иначе предложение прыгало бы между перезагрузками.
  const sorted = [...workouts].sort((a, b) => {
    const aDate = performed.get(a.id)
    const bDate = performed.get(b.id)
    if (!aDate && !bDate) return String(a.title || '').localeCompare(String(b.title || ''), 'ru')
    if (!aDate) return -1
    if (!bDate) return 1
    const diff = new Date(aDate) - new Date(bDate)
    return diff !== 0 ? diff : String(a.title || '').localeCompare(String(b.title || ''), 'ru')
  })

  const workout = sorted[0]
  const lastDate = performed.get(workout.id) || null
  return {
    workout,
    lastDate,
    // Уже сделанную сегодня тренировку не подаём как «сделайте сегодня».
    doneToday: Boolean(lastDate) && localDayKey(lastDate) === localDayKey(new Date()),
  }
}

// Следующая по очереди — чтобы на дашборде было видно, что будет дальше.
export function nextAfter(workouts = [], history = [], currentId) {
  const rest = workouts.filter((w) => w.id !== currentId)
  return suggestTodayWorkout(rest, history)?.workout || null
}

// Грубая оценка длительности: подход с отдыхом — около трёх минут.
const MINUTES_PER_SET = 3

export function estimateMinutes(workout) {
  const sets = (workout?.items || []).reduce((sum, item) => sum + (Number(item.targetSets) || 0), 0)
  return sets > 0 ? Math.round(sets * MINUTES_PER_SET) : 0
}

// Группы мышц тренировки — подпись под названием («Грудь · Плечи · Трицепс»).
export function workoutMuscles(workout, exerciseById, translate) {
  const seen = []
  ;(workout?.items || []).forEach((item) => {
    const group = exerciseById?.get?.(item.exerciseId)?.muscleGroup
    if (!group) return
    const label = translate ? translate(group) : group
    if (!seen.includes(label)) seen.push(label)
  })
  return seen.slice(0, 4)
}
