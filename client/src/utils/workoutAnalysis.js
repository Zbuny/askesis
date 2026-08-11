// Разбор собранной тренировки: сколько подходов набралось на каждую группу
// мышц и чего они стоят с поправкой на диапазон повторений (см. repRanges.js).
// Считаем на лету в конструкторе, поэтому всё — чистые функции без запросов.

import {
  GROWTH_MAX_REPS,
  GROWTH_MIN_REPS,
  MAX_SETS_PER_MUSCLE_PER_SESSION,
  classifyReps,
  effectiveSets,
  setsForSameEffect,
} from './repRanges.js'
import { pluralRu, translateMuscle } from './translate.js'

const UNKNOWN_MUSCLE = { key: 'other', label: 'Без группы' }

const setsWord = (count) => pluralRu(count, 'подход', 'подхода', 'подходов')

// В программах повторы задаются диапазоном («8-10»), в тренировках — числом.
// Для расчётов берём середину диапазона: именно на ней человек и работает.
export function itemReps(item) {
  const min = Number(item?.targetReps) || 0
  const max = Number(item?.targetRepsMax) || 0
  if (max > min) return Math.round((min + max) / 2)
  return min
}

function muscleOf(item, exerciseById) {
  const group = exerciseById?.get?.(item.exerciseId)?.muscleGroup
  if (!group) return UNKNOWN_MUSCLE
  return { key: group, label: translateMuscle(group) }
}

function itemName(item, exerciseById) {
  const ex = exerciseById?.get?.(item.exerciseId)
  return ex?.nameRu || ex?.name || item.exerciseName || item.exerciseId
}

export function analyzeWorkout(items = [], exerciseById = new Map()) {
  const rows = items
    .map((item) => {
      const reps = itemReps(item)
      const sets = Number(item.targetSets) || 0
      return {
        item,
        name: itemName(item, exerciseById),
        muscle: muscleOf(item, exerciseById),
        reps,
        sets,
        zone: classifyReps(reps),
        effective: effectiveSets(sets, reps),
      }
    })
    .filter((row) => row.sets > 0 && row.reps > 0)

  const totalSets = rows.reduce((sum, row) => sum + row.sets, 0)
  const totalEffective = Math.round(rows.reduce((sum, row) => sum + row.effective, 0) * 10) / 10

  const byMuscle = new Map()
  rows.forEach((row) => {
    const current = byMuscle.get(row.muscle.key) || { ...row.muscle, sets: 0, effective: 0 }
    current.sets += row.sets
    current.effective += row.effective
    byMuscle.set(row.muscle.key, current)
  })
  const muscles = [...byMuscle.values()]
    .map((muscle) => ({
      ...muscle,
      effective: Math.round(muscle.effective * 10) / 10,
      overloaded: muscle.sets > MAX_SETS_PER_MUSCLE_PER_SESSION,
    }))
    .sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label, 'ru'))

  const byZone = new Map()
  rows.forEach((row) => {
    const current = byZone.get(row.zone.key) || {
      key: row.zone.key,
      label: row.zone.label,
      tone: row.zone.tone,
      sets: 0,
    }
    current.sets += row.sets
    byZone.set(row.zone.key, current)
  })
  const zones = [...byZone.values()]
    .map((zone) => ({ ...zone, percent: totalSets ? Math.round((zone.sets / totalSets) * 100) : 0 }))
    .sort((a, b) => b.sets - a.sets)

  return { rows, totalSets, totalEffective, muscles, zones, notes: buildNotes(rows, muscles) }
}

function buildNotes(rows, muscles) {
  const notes = []

  rows.forEach((row) => {
    if (row.reps > GROWTH_MAX_REPS) {
      notes.push({
        tone: 'high',
        text: `${row.name}: ${row.reps} повторений — до отказа так почти не доходят, усталость останавливает раньше. Для роста хватит ${GROWTH_MIN_REPS}–${GROWTH_MAX_REPS}.`,
      })
      return
    }
    if (row.reps < GROWTH_MIN_REPS) {
      const needed = setsForSameEffect(row.reps)
      if (needed > row.sets) {
        notes.push({
          tone: 'warn',
          text: `${row.name}: на ${row.reps} повторениях один подход даёт меньше стимула. Чтобы сравняться с 3×10, нужно ${needed} ${setsWord(needed)} вместо ${row.sets}.`,
        })
      }
    }
  })

  muscles
    .filter((muscle) => muscle.overloaded)
    .forEach((muscle) => {
      notes.push({
        tone: 'warn',
        text: `${muscle.label}: ${muscle.sets} ${setsWord(muscle.sets)} за тренировку. Больше ${MAX_SETS_PER_MUSCLE_PER_SESSION} качественных за раз не сделать — часть лучше перенести в другой день.`,
      })
    })

  // Хвалим только полностью «чистую» тренировку, иначе подсказка теряет вес.
  if (notes.length === 0 && rows.length > 0) {
    notes.push({
      tone: 'ok',
      text: 'Все упражнения в рабочем окне повторений. Главное — доводить подходы близко до отказа: без этого диапазон не имеет значения.',
    })
  }

  return notes
}
