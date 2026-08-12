// Разбор сразу после того, как тренировка записана.
//
// Отвечает на три вопроса подряд: что сейчас произошло, лучше это или хуже
// прошлого раза, и что ставить в следующий. Третий — главный: без него
// человек уходит со страницы, а на следующей тренировке заново вспоминает,
// с какого веса заходил.
//
// Считается из тех же модулей, что и всё остальное: рекорд — records.js,
// XP — gamification.js, цель на следующий раз — progression.js. Своей
// арифметики здесь нет нарочно, иначе разбор начал бы расходиться с
// дашбордом и страницей тренировки.

import { personalRecords, recordGain } from './records.js'
import { levelFromXp, sessionXp, totalXp } from './gamification.js'
import { formatTarget, nextSessionTarget } from './progression.js'
import { entrySets, entryTopWeight, formatEntry, sessionVolume } from './workoutLog.js'
import { RIR_TOO_EASY, isRir, rirLabel } from './repRanges.js'
import { pluralRu } from './translate.js'

const setsWord = (n) => pluralRu(n, 'подход', 'подхода', 'подходов')

function countedSets(entry) {
  return entrySets(entry).filter((set) => (Number(set?.reps) || 0) > 0).length
}

function entryTopReps(entry) {
  const reps = entrySets(entry).map((set) => Number(set?.reps) || 0)
  return reps.length ? Math.max(...reps) : 0
}

// Насколько выросли по сравнению с прошлым разом. У подтягиваний и отжиманий
// вес всегда ноль, и по нему разницы не будет никогда — там прогрессия идёт
// повторениями, поэтому и сравнивать надо их, иначе разбор честно, но
// бесполезно сообщает «раньше не делали» после каждой тренировки.
function changeSince(entry, before) {
  if (!before) return null

  const top = entryTopWeight(entry)
  const beforeTop = entryTopWeight(before)
  if (top > 0 && beforeTop > 0) {
    return { unit: 'кг', value: Math.round((top - beforeTop) * 10) / 10 }
  }

  const reps = entryTopReps(entry)
  const beforeReps = entryTopReps(before)
  if (reps > 0 && beforeReps > 0) return { unit: 'повт.', value: reps - beforeReps }

  return null
}

// Предыдущая тренировка по той же программе. Именно по той же: сравнивать
// день ног с днём груди по объёму бессмысленно.
function previousSession(history, session) {
  return history
    .filter(
      (other) =>
        other?.id !== session.id &&
        other?.workoutId === session.workoutId &&
        other?.date &&
        new Date(other.date) < new Date(session.date),
    )
    .reduce((latest, other) => (!latest || new Date(other.date) > new Date(latest.date) ? other : latest), null)
}

// Новый уровень — единственный момент, когда XP перестаёт быть числом сбоку
// и что-то значит. Считаем его сравнением «с этой тренировкой» и «без неё»:
// хранимого счётчика нет, а разница двух пересчётов даёт ровно тот же ответ.
// foodLogs нужны не для красоты: питание тоже приносит XP, и без него порог
// уровня сместился бы, а событие — потерялось или выдумалось.
function levelUpFrom({ session, history, foodLogs, weeklyGoal }) {
  const without = history.filter((other) => other?.id !== session.id)
  if (without.length === history.length) return null

  const before = levelFromXp(totalXp({ history: without, foodLogs, weeklyGoal }))
  const after = levelFromXp(totalXp({ history, foodLogs, weeklyGoal }))
  return after.level > before.level ? after : null
}

export function reviewSession({
  session,
  history = [],
  workout = null,
  exerciseById = new Map(),
  foodLogs = [],
  weeklyGoal,
  level = '',
} = {}) {
  if (!session) return null

  const entries = session.entries || []
  const records = [...personalRecords(history).values()]
    .filter((record) => record.sessionId === session.id)
    .map((record) => ({ ...record, gain: recordGain(record) }))
    .sort((a, b) => b.score - a.score)

  const xp = sessionXp(session, records.length)
  const volume = Math.round(sessionVolume(session))
  const sets = entries.reduce((sum, entry) => sum + countedSets(entry), 0)
  const minutes = Number(session.durationMinutes) || 0

  const previous = previousSession(history, session)
  const previousVolume = previous ? Math.round(sessionVolume(previous)) : null
  const compare =
    previousVolume && previousVolume > 0
      ? {
          date: previous.date,
          volume: previousVolume,
          delta: volume - previousVolume,
          percent: Math.round(((volume - previousVolume) / previousVolume) * 100),
        }
      : null

  const previousEntries = new Map((previous?.entries || []).map((entry) => [entry.exerciseId, entry]))
  // Цель на следующий раз считаем «изнутри сегодняшнего дня»: now равен дате
  // тренировки, иначе разбор, открытый через месяц, объявил бы перерыв.
  const now = new Date(session.date)
  const planned = new Map((workout?.items || []).map((item) => [item.exerciseId, item]))

  const exercises = entries.map((entry) => {
    const item = planned.get(entry.exerciseId) || {}
    const top = entryTopWeight(entry)
    const target = nextSessionTarget({
      item,
      lastEntry: entry,
      lastDate: session.date,
      exercise: exerciseById.get?.(entry.exerciseId),
      level,
      now,
    })

    return {
      exerciseId: entry.exerciseId,
      name: entry.exerciseName || entry.exerciseId,
      done: formatEntry(entry),
      sets: countedSets(entry),
      top,
      // Разница с прошлым разом: null — если раньше это упражнение не делали,
      // { value: 0 } — если результат тот же. Это не одно и то же.
      change: changeSince(entry, previousEntries.get(entry.exerciseId)),
      rir: isRir(entry.rir) ? Number(entry.rir) : null,
      rirLabel: rirLabel(entry.rir),
      record: records.find((record) => record.exerciseId === entry.exerciseId) || null,
      next: formatTarget(target),
      nextAction: target.action,
      nextHint: target.hint,
    }
  })

  const notes = []

  // Пропущенные упражнения видны только если известен состав тренировки:
  // журнал сам по себе не знает, что планировалось.
  const skipped = (workout?.items || []).filter(
    (item) => !entries.some((entry) => entry.exerciseId === item.exerciseId),
  )
  if (skipped.length > 0) {
    notes.push({
      tone: 'warn',
      text: `Не записано: ${skipped.map((item) => item.exerciseName || item.exerciseId).join(', ')}. Если упражнение просто пропущено — это нормально, но объём по его группе за неделю просядет.`,
    })
  }

  const shortOfPlan = exercises.filter((row) => {
    const item = planned.get(row.exerciseId)
    const target = Number(item?.targetSets) || 0
    return target > 0 && row.sets < target
  })
  if (shortOfPlan.length > 0) {
    notes.push({
      tone: 'info',
      text: `Меньше плана по подходам: ${shortOfPlan.map((row) => `${row.name} (${row.sets} из ${planned.get(row.exerciseId).targetSets})`).join(', ')}. Вес не вырастет, пока не сделаны все запланированные подходы.`,
    })
  }

  if (minutes === 0) {
    notes.push({
      tone: 'info',
      text: 'Время не засечено — эта тренировка не попадёт в среднюю длительность. Кнопка «Начать тренировку» вверху включает таймер.',
    })
  }

  // Недоведённые подходы — не мелочь: вся модель диапазонов повторений в
  // repRanges.js держится на близости к отказу, и без неё «сделал 3×8»
  // означает только потраченное время.
  const tooEasy = exercises.filter((row) => row.rir != null && row.rir >= RIR_TOO_EASY)
  if (tooEasy.length > 0) {
    notes.push({
      tone: 'warn',
      text: `Далеко от отказа: ${tooEasy.map((row) => row.name).join(', ')}. Рост даёт не число повторений, а близость к пределу — в следующий раз вес по этим упражнениям поднимется сильнее обычного.`,
    })
  }

  const growing = exercises.filter((row) => row.nextAction === 'add-weight').length
  if (growing > 0) {
    notes.push({
      tone: 'ok',
      text: `${growing} ${pluralRu(growing, 'упражнение выходит', 'упражнения выходят', 'упражнений выходят')} на прибавку веса в следующий раз — цифры уже подставятся кнопкой «Взять».`,
    })
  }

  const deloading = exercises.filter((row) => row.nextAction === 'deload')
  if (deloading.length > 0) {
    notes.push({
      tone: 'warn',
      text: `Просадка: ${deloading.map((row) => row.name).join(', ')}. В следующий раз вес снимется — это не откат, а разгон под новый подход к тому же весу.`,
    })
  }

  return {
    sessionId: session.id,
    date: session.date,
    headline: headlineFor({ records, compare, sets }),
    tone: records.length > 0 ? 'ok' : 'info',
    xp,
    levelUp: levelUpFrom({ session, history, foodLogs, weeklyGoal }),
    volume,
    sets,
    minutes,
    records,
    compare,
    exercises,
    notes,
  }
}

// Одна формулировка на разбор и на факты для модели — расходиться им незачем.
export function describeChange(change) {
  if (!change) return 'раньше не делали'
  if (change.value === 0) return change.unit === 'кг' ? 'вес как в прошлый раз' : 'столько же повторений'
  return `${change.value > 0 ? '+' : ''}${change.value} ${change.unit} к прошлому разу`
}

function headlineFor({ records, compare, sets }) {
  if (records.length > 1) return `${records.length} личных рекорда за тренировку`
  if (records.length === 1) return `Личный рекорд: ${records[0].name}`
  if (compare && compare.percent >= 5) return `Объём выше прошлого раза на ${compare.percent}%`
  if (compare && compare.percent <= -15) return 'Объём ниже прошлого раза'
  return `Тренировка записана: ${sets} ${setsWord(sets)}`
}

// Факты для тренера — тем же плоским списком строк, что и на дашборде
// (см. coach.js → coachFacts). Модель их только связывает, не пересчитывает.
export function reviewFacts(review) {
  if (!review) return []

  const facts = [
    `Записана тренировка: ${review.sets} ${setsWord(review.sets)}, объём ${review.volume} кг${review.minutes ? `, ${review.minutes} мин в зале` : ''}.`,
  ]

  if (review.levelUp) {
    facts.push(`Этой тренировкой взят ${review.levelUp.level}-й уровень («${review.levelUp.title}»).`)
  }

  if (review.compare) {
    facts.push(
      `Прошлый раз по этой же тренировке (${new Date(review.compare.date).toLocaleDateString('ru-RU')}) объём был ${review.compare.volume} кг, разница ${review.compare.delta > 0 ? '+' : ''}${review.compare.delta} кг.`,
    )
  }

  review.records.forEach((record) => {
    facts.push(
      `Личный рекорд: ${record.name} — ${record.weight} кг × ${record.reps}${record.gain ? `, на ${record.gain} кг больше прошлого` : ' (первый в этом упражнении)'}.`,
    )
  })

  review.exercises.forEach((row) => {
    const change = describeChange(row.change)
    const effort = row.rirLabel ? `, запас до отказа: ${row.rirLabel.toLowerCase()}` : ''
    // formatTarget для своего веса заканчивается на «повт.» — вторая точка
    // подряд в промпте выглядит как опечатка, а модель её ещё и повторит.
    const next = row.next.endsWith('.') ? row.next : `${row.next}.`
    facts.push(`${row.name}: ${row.done} (${change}${effort}). В следующий раз запланировано ${next}`)
  })

  review.notes.forEach((note) => facts.push(note.text))

  return facts
}
