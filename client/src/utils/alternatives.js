// Чем заменить упражнение.
//
// Нужно чаще, чем кажется: стойка занята, дома нет штанги, болит плечо
// именно на этом движении. Без замены человек либо пропускает упражнение
// целиком (и группа мышц теряет весь недельный объём), либо ставит наугад
// что-то из другой части тела.
//
// Правило одно и жёсткое: замена обязана нагружать ту же группу мышц. Всё
// остальное — инвентарь, уровень, тип движения — влияет только на порядок
// в списке, но никогда не позволяет подсунуть присед вместо жима.

import { exerciseName } from './translate.js'

export const MAX_ALTERNATIVES = 6

// Насколько похожи два упражнения по типу движения. Совпадение важнее
// инвентаря: жим гантелей ближе к жиму штанги, чем разводка с той же штангой.
function categoryScore(exercise, origin) {
  if (!exercise.category || !origin.category) return 1
  return exercise.category === origin.category ? 0 : 2
}

function equipmentScore(exercise, origin, available) {
  const equipment = exercise.equipment || ''
  // Есть список доступного инвентаря — он и решает: предлагать штангу тому,
  // у кого её нет, бессмысленно, каким бы похожим упражнение ни было.
  if (available?.length) return available.includes(equipment) ? 0 : 5
  return equipment === origin.equipment ? 1 : 0
}

const LEVEL_RANK = { beginner: 0, intermediate: 1, expert: 2 }

function levelScore(exercise, origin) {
  const a = LEVEL_RANK[String(exercise.level || '').toLowerCase()]
  const b = LEVEL_RANK[String(origin.level || '').toLowerCase()]
  if (a == null || b == null) return 1
  // Упражнение сложнее исходного хуже, чем проще: замена не должна
  // оказаться тем, к чему человек ещё не готов.
  return a > b ? (a - b) * 2 : b - a
}

// Совпадение по вспомогательным мышцам — слабый, но полезный сигнал: жим
// узким хватом и отжимания на брусьях делят и грудь, и трицепс.
function secondaryScore(exercise, origin) {
  const mine = new Set(exercise.secondaryMuscles || [])
  const theirs = origin.secondaryMuscles || []
  if (!mine.size || !theirs.length) return 1
  const shared = theirs.filter((muscle) => mine.has(muscle)).length
  return shared > 0 ? 0 : 1
}

export function findAlternatives(origin, catalogue = [], { equipment = [], limit = MAX_ALTERNATIVES } = {}) {
  if (!origin?.muscleGroup) return []

  return catalogue
    .filter((ex) => ex.id !== origin.id && ex.muscleGroup === origin.muscleGroup)
    .map((ex) => ({
      exercise: ex,
      score:
        equipmentScore(ex, origin, equipment) +
        categoryScore(ex, origin) +
        levelScore(ex, origin) +
        secondaryScore(ex, origin),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      // Имя как последний признак — чтобы список не прыгал между открытиями.
      return exerciseName(a.exercise).localeCompare(exerciseName(b.exercise), 'ru')
    })
    .slice(0, limit)
    .map((row) => ({
      ...row.exercise,
      // Человеку нужно не число, а причина: «то же самое, но с гантелями».
      reason: reasonFor(row.exercise, origin, equipment),
    }))
}

function reasonFor(exercise, origin, available) {
  if (exercise.equipment && exercise.equipment !== origin.equipment) {
    const fits = available?.length && available.includes(exercise.equipment)
    return fits ? 'Та же группа мышц, есть в вашем инвентаре' : 'Та же группа мышц, другой снаряд'
  }
  if (exercise.category && origin.category && exercise.category !== origin.category) {
    return 'Та же группа мышц, другой тип движения'
  }
  return 'Та же группа мышц и тот же снаряд'
}
