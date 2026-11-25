// Телосложение персонажа: насколько «выросла» каждая группа мышц.
//
// Как и XP, рост не хранится, а пересчитывается из журнала тренировок.
// Счётчику с клиента верить нельзя, а производная величина не накручивается
// и не удваивается при повторном сохранении — одна и та же история всегда
// даёт одного и того же персонажа.
//
// Мера стимула — рабочие подходы, а не килограммы. Объём в кг несравним между
// группами (присед и сгибания на бицепс отличаются на порядок) и обнуляется
// у упражнений с собственным весом, а подход есть подход в любом из них.
//
// Три свойства, ради которых формула именно такая:
// 1. Насыщение. Рост идёт по 1 − e^(−x/S): первые месяцы заметны сразу,
//    дальше всё медленнее — как у живого тела, и модель не раздувается
//    в шар у того, кто тренируется годами.
// 2. Детренированность. Каждый подход «стареет» с периодом полураспада
//    в полгода. Бросил — персонаж медленно сдувается; вернулся — растёт
//    снова. Полгода выбраны нарочно длинными: неделя отпуска не должна
//    ощущаться наказанием.
// 3. Пампинг. Подходы последних двух суток временно надувают мышцу и
//    подсвечивают её — сразу после тренировки видно, что именно работало.

import { entrySets } from './workoutLog.js'

export const REGIONS = [
  { key: 'chest', label: 'Грудь' },
  { key: 'shoulders', label: 'Плечи' },
  { key: 'biceps', label: 'Бицепс' },
  { key: 'triceps', label: 'Трицепс' },
  { key: 'forearms', label: 'Предплечья' },
  { key: 'back', label: 'Спина' },
  { key: 'traps', label: 'Трапеции' },
  { key: 'abs', label: 'Пресс' },
  { key: 'glutes', label: 'Ягодицы' },
  { key: 'quads', label: 'Квадрицепсы' },
  { key: 'hamstrings', label: 'Бицепс бедра' },
  { key: 'calves', label: 'Икры' },
]

// Группы каталога (17 штук) → части модели. Доли меньше единицы — там, где
// мышца каталога лишь отчасти совпадает с видимой частью тела.
const MUSCLE_TO_REGIONS = {
  chest: { chest: 1 },
  shoulders: { shoulders: 1 },
  biceps: { biceps: 1 },
  triceps: { triceps: 1 },
  forearms: { forearms: 1 },
  lats: { back: 1 },
  'middle back': { back: 1 },
  'lower back': { back: 0.5, abs: 0.25 },
  traps: { traps: 1 },
  neck: { traps: 0.5 },
  abdominals: { abs: 1 },
  glutes: { glutes: 1 },
  quadriceps: { quads: 1 },
  hamstrings: { hamstrings: 1 },
  calves: { calves: 1 },
  adductors: { quads: 0.5 },
  abductors: { glutes: 0.5 },
}

// Синергисты получают треть стимула: жим растит и трицепс, но меньше, чем
// французский жим.
export const SECONDARY_SHARE = 0.35
export const HALF_LIFE_DAYS = 180
// Эффективных подходов, при которых группа проходит ~63% пути. Для группы,
// которой дают 10 подходов в неделю, это около четырёх месяцев.
export const SATURATION_SETS = 160
export const PUMP_HOURS = 48
// Столько подходов за раз — полный памп.
const PUMP_FULL_SETS = 12

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export const STAGES = [
  { from: 0.85, title: 'Монумент' },
  { from: 0.7, title: 'Мощный' },
  { from: 0.5, title: 'Атлетичный' },
  { from: 0.3, title: 'Подтянутый' },
  { from: 0.12, title: 'Втягивается' },
  { from: 0, title: 'Старт' },
]

export function stageTitle(overall) {
  return STAGES.find((stage) => overall >= stage.from)?.title || 'Старт'
}

function addShares(target, muscleGroup, factor) {
  const shares = MUSCLE_TO_REGIONS[muscleGroup]
  if (!shares) return
  Object.entries(shares).forEach(([region, share]) => {
    target[region] = (target[region] || 0) + share * factor
  })
}

// Куда засчитать подходы упражнения. Без каталога (не догрузился) — никуда:
// лучше персонаж на секунду «худее», чем рост не той мышцы.
export function exerciseRegions(exercise) {
  const result = {}
  if (!exercise?.muscleGroup) return result
  addShares(result, exercise.muscleGroup, 1)
  ;(exercise.secondaryMuscles || []).forEach((muscle) => {
    if (muscle !== exercise.muscleGroup) addShares(result, muscle, SECONDARY_SHARE)
  })
  return result
}

export function growthFromSets(effectiveSets) {
  const x = Math.max(0, Number(effectiveSets) || 0)
  return 1 - Math.exp(-x / SATURATION_SETS)
}

export function physique(history = [], exerciseById = new Map(), now = new Date()) {
  const nowMs = new Date(now).getTime()
  const effective = {}
  const total = {}
  const recent = {}
  const pumpAge = {}

  history.forEach((session) => {
    const dateMs = new Date(session?.date).getTime()
    if (!Number.isFinite(dateMs)) return
    // Запись «из будущего» (сбитые часы) считаем сегодняшней, а не бонусом.
    const ageMs = Math.max(0, nowMs - dateMs)
    const decay = Math.pow(0.5, ageMs / DAY_MS / HALF_LIFE_DAYS)
    const fresh = ageMs < PUMP_HOURS * HOUR_MS

    ;(session.entries || []).forEach((entry) => {
      const done = entrySets(entry).filter((set) => (Number(set.reps) || 0) > 0).length
      if (done === 0) return
      const shares = exerciseRegions(exerciseById.get?.(entry.exerciseId))
      Object.entries(shares).forEach(([region, share]) => {
        effective[region] = (effective[region] || 0) + done * share * decay
        total[region] = (total[region] || 0) + done * share
        if (fresh) {
          recent[region] = (recent[region] || 0) + done * share
          pumpAge[region] = Math.min(pumpAge[region] ?? Infinity, ageMs)
        }
      })
    })
  })

  const regions = REGIONS.map((region) => {
    const growth = growthFromSets(effective[region.key])
    const recentSets = recent[region.key] || 0
    // Памп спадает линейно за двое суток после последней тренировки группы.
    const fade = recentSets > 0 ? 1 - pumpAge[region.key] / (PUMP_HOURS * HOUR_MS) : 0
    const pump = Math.min(1, recentSets / PUMP_FULL_SETS) * Math.max(0, fade)
    return {
      ...region,
      growth,
      percent: Math.round(growth * 100),
      sets: Math.round(total[region.key] || 0),
      pump: Math.round(pump * 100) / 100,
    }
  })

  const overall = regions.reduce((sum, region) => sum + region.growth, 0) / regions.length
  // Отстающая — та, что развита меньше всего. Подсказываем её только когда
  // есть с чем сравнивать, иначе «отстаёт» всё тело сразу.
  const sorted = [...regions].sort((a, b) => a.growth - b.growth)
  const lagging = overall >= 0.05 ? sorted[0] : null

  return {
    regions,
    overall,
    percent: Math.round(overall * 100),
    stage: stageTitle(overall),
    lagging,
    growth: Object.fromEntries(regions.map((region) => [region.key, region.growth])),
    pump: Object.fromEntries(regions.map((region) => [region.key, region.pump])),
  }
}
