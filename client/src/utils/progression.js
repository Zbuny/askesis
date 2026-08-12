// Прогрессия нагрузки: что ставить сегодня, зная прошлую тренировку.
//
// Схема — двойная прогрессия. Человек работает в диапазоне повторений
// (например 6-8) и с одним весом набирает повторы до верхней границы. Как
// только все рабочие подходы сделаны на верхней границе — вес растёт, а
// повторы падают к нижней. Так «прибавка каждую неделю» получается из
// фактических цифр человека, а не из календаря: неделя без прогресса в
// повторах просто не даёт прибавки веса.

import { RECOMMENDED_REPS, RIR_TOO_EASY, isRir, levelKey } from './repRanges.js'
import { entrySets } from './workoutLog.js'

// Пропуск дольше двух недель — форма частично теряется, прибавлять нечего.
export const STALE_AFTER_DAYS = 14

// Крупные группы тянут больший абсолютный шаг: 2.5 кг в приседе почти
// незаметны, а в подъёме на бицепс это заметная прибавка.
const BIG_MUSCLE_GROUPS = ['quadriceps', 'hamstrings', 'glutes', 'lower back']

// Недельная прибавка в процентах от рабочего веса. Новичок растёт быстро,
// продвинутому за ту же неделю достаётся минимум.
const LEVEL_STEP_PERCENT = { beginner: 0.05, intermediate: 0.025, advanced: 0.015 }

// Меньше этого шага веса не набрать: гантельный ряд идёт через 2 кг,
// блины — через 2.5 кг на сторону.
export function minWeightStep(exercise) {
  const equipment = String(exercise?.equipment || '').toLowerCase()
  if (equipment === 'dumbbell' || equipment === 'kettlebells') return 2
  if (BIG_MUSCLE_GROUPS.includes(String(exercise?.muscleGroup || '').toLowerCase())) return 5
  return 2.5
}

export function weightStep(weight, exercise, level) {
  const step = minWeightStep(exercise)
  const current = Number(weight) || 0
  if (current <= 0) return step
  const percent = LEVEL_STEP_PERCENT[levelKey(level)]
  return Math.max(step, Math.round((current * percent) / step) * step)
}

// Диапазон, в котором человек работает. Одно число в цели превращаем в
// «от него и ещё два повторения сверху» — иначе прогрессировать некуда.
export function targetRange(item) {
  const min = Number(item?.targetReps) || 0
  const max = Number(item?.targetRepsMax) || 0
  if (!min) return { ...RECOMMENDED_REPS }
  return { min, max: max > min ? max : min + 2 }
}

function daysBetween(from, to) {
  if (!from) return 0
  const days = (to.getTime() - new Date(from).getTime()) / 86_400_000
  return Number.isFinite(days) ? days : 0
}

export function nextSessionTarget({ item, lastEntry, lastDate, exercise, level, now = new Date() }) {
  const range = targetRange(item)
  const sets = entrySets(lastEntry).filter((set) => Number(set.reps) > 0)

  if (sets.length === 0) {
    return {
      action: 'start',
      weight: null,
      reps: range.min,
      range,
      rir: null,
      hint: `Первый раз: подберите вес, с которым ${range.min}-${range.max} повторений даются близко к отказу.`,
    }
  }

  const weight = Math.max(...sets.map((set) => Number(set.weight) || 0))
  // Разминочные подходы с меньшим весом в расчёт не идут — прогрессию
  // определяют только рабочие.
  const working = sets.filter((set) => (Number(set.weight) || 0) >= weight)
  const worstReps = Math.min(...working.map((set) => Number(set.reps) || 0))
  const plannedSets = Number(item?.targetSets) || working.length
  const step = weightStep(weight, exercise, level)

  // Запас до отказа, если человек его отметил. Старые записи его не знают —
  // тогда rir null и всё считается ровно как раньше.
  const rir = isRir(lastEntry?.rir) ? Number(lastEntry.rir) : null
  const tooEasy = rir != null && rir >= RIR_TOO_EASY
  // Шаг рассчитан на подход, доведённый до предела. Если запас оставался,
  // обычная прибавка съестся этим же запасом и ничего не изменит.
  const boldStep = rir != null && rir >= 2 ? step * 2 : step

  if (daysBetween(lastDate, now) > STALE_AFTER_DAYS) {
    return {
      action: 'repeat',
      weight,
      reps: range.min,
      range,
      rir,
      hint: `Перерыв больше ${STALE_AFTER_DAYS} дней — повторите прошлый вес, прибавите со следующей тренировки.`,
    }
  }

  // Свой вес и резинки: вес прибавлять нечего, растут только повторы.
  //
  // Верхнюю границу диапазона здесь НЕ применяем как потолок. Со штангой она
  // означает «пора добавить вес», а без веса добавлять нечего — и цель,
  // прижатая к range.max, превращается в требование сделать меньше, чем в
  // прошлый раз: сделал 20 отжиманий при плане 6-8, приложение предлагает 8.
  // Поэтому растём от факта, а границу используем только как нижнюю.
  if (weight <= 0) {
    const grown = tooEasy ? Math.max(range.max, worstReps + 2) : worstReps + 1
    return {
      action: 'add-reps',
      weight: 0,
      reps: Math.max(range.min, grown),
      range,
      rir,
      hint:
        worstReps >= range.max
          ? 'Диапазон уже перерос — дальше растить повторения можно, но быстрее сработает более сложный вариант упражнения или внешний вес.'
          : tooEasy
            ? `С таким запасом подход не рабочий — идите сразу к ${range.max} повторениям, а дальше усложняйте само упражнение.`
            : 'Без внешнего веса прогрессия идёт повторениями — добавьте по одному в каждом подходе.',
    }
  }

  if (worstReps >= range.max && working.length >= plannedSets) {
    return {
      action: 'add-weight',
      weight: weight + boldStep,
      reps: range.min,
      range,
      rir,
      hint:
        boldStep > step
          ? `Верх диапазона взят, и запас ещё оставался: +${boldStep} кг вместо обычных ${step}, повторы падают к ${range.min}.`
          : `Верх диапазона взят во всех подходах: +${step} кг, повторы падают к ${range.min}.`,
    }
  }

  // Просадка разбирается раньше запаса намеренно. «Повторов мало, но запас
  // был» — противоречивый ввод: до отказа человек не дошёл по причине, не
  // связанной с весом (техника, боль, спешка). Прибавлять на этом нельзя.
  if (worstReps < range.min - 2) {
    return {
      action: 'deload',
      weight: Math.max(step, weight - step),
      reps: range.min,
      range,
      rir,
      hint: `До ${range.min} повторений не хватило двух и больше — снимите ${step} кг и наберите повторы заново.`,
    }
  }

  if (tooEasy) {
    return {
      action: 'add-weight',
      weight: weight + boldStep,
      reps: range.min,
      range,
      rir,
      hint: `Осталось ${RIR_TOO_EASY}+ повторений в запасе — ограничивают не повторы, а слишком лёгкий вес. Берём +${boldStep} кг, повторы к ${range.min}.`,
    }
  }

  return {
    action: 'add-reps',
    weight,
    reps: Math.min(Math.max(worstReps + 1, range.min), range.max),
    range,
    rir,
    hint: `Вес тот же, цель — добрать до ${range.max} повторений во всех подходах. Тогда вес вырастет на ${step} кг.`,
  }
}

export function formatTarget(target) {
  if (!target) return ''
  // Диапазон показываем, только пока цель внутри него. Со своим весом она
  // может перерасти верхнюю границу (см. ветку weight <= 0 выше), и тогда
  // «22-8 повт.» читалось бы как опечатка — потому что ею и является.
  const reps =
    target.reps < target.range.max ? `${target.reps}-${target.range.max}` : `${target.reps}`
  if (!target.weight) return `${reps} повт.`
  return `${target.weight} кг × ${reps}`
}
