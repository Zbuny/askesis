// Модель, по которой сайт оценивает выбранный диапазон повторений.
//
// Ходовая схема «3-6 на силу, 8-12 на массу, 15-20 на рельеф» верна только
// наполовину. Мышцы растут, когда подход доведён близко к отказу — и в
// диапазоне примерно от 6 до 30 повторений рост при равном числе подходов
// сопоставим. Разница не в самом росте, а в двух вещах:
//   1) сколько стимула даёт ОДИН подход (на трёх повторениях — меньше);
//   2) насколько реально дойти до отказа (на тридцати — жжение и общая
//      усталость останавливают раньше, чем закончатся мышечные ресурсы).
// Обе поправки ниже и превращают «повторы» в сопоставимые числа.

export const GROWTH_MIN_REPS = 6
export const GROWTH_MAX_REPS = 30

// Подход близко к отказу даёт примерно пять «стимулирующих» повторений —
// последние перед отказом, когда в работу вовлечены все двигательные
// единицы. Подход на 3 повторения физически не может дать больше трёх.
export const STIMULATING_REPS_PER_SET = 5

// Сколько подходов на мышечную группу за неделю имеет смысл набирать.
export const WEEKLY_SETS_PER_MUSCLE = { min: 10, max: 20 }

// Рабочий диапазон по умолчанию. Раз рост в окне 6-30 одинаков, выбирать
// нужно по тому, что даётся сверху: на 6-8 повторениях вместе с мышцами
// растут силовые, а веса ещё не требуют подготовки, как на тройках.
// Новичку тот же диапазон достаётся дорого — техника разваливается раньше,
// чем наступает отказ, поэтому ему оставляем 8-15.
export const RECOMMENDED_REPS = { min: 6, max: 8 }
export const BEGINNER_REPS = { min: 8, max: 15 }

// Подписи уровня в одном месте: их показывает и профиль, и мастер ИИ.
export const TRAINING_LEVELS = ['Начинающий', 'Средний', 'Продвинутый']

const BEGINNER_LEVELS = ['начинающий', 'beginner', 'новичок']
const ADVANCED_LEVELS = ['продвинутый', 'advanced', 'expert']

// Уровень приходит и из профиля, и из мастера ИИ, и из библиотеки упражнений —
// названия везде разные, поэтому сводим их к трём ключам.
export function levelKey(level) {
  const value = String(level || '').trim().toLowerCase()
  if (BEGINNER_LEVELS.includes(value)) return 'beginner'
  if (ADVANCED_LEVELS.includes(value)) return 'advanced'
  return 'intermediate'
}

export function isExperienced(level) {
  return levelKey(level) !== 'beginner'
}

export function recommendedReps(level) {
  return isExperienced(level)
    ? {
        ...RECOMMENDED_REPS,
        why: 'Рост мышц тот же, что и на 8-12, но вместе с ним растут силовые, а до отказа дойти всё ещё просто.',
      }
    : {
        ...BEGINNER_REPS,
        why: 'Пока техника не автоматическая, до отказа безопаснее доходить на умеренных весах.',
      }
}

// Больше — уже не тренировка, а разминка нервной системы на выносливость:
// за одну сессию столько качественных подходов на группу не сделать.
export const MAX_SETS_PER_MUSCLE_PER_SESSION = 12

// ---------- запас до отказа (RIR) ----------
//
// Вся модель выше держится на одном условии: подход доведён БЛИЗКО к отказу.
// Само по себе число повторений об этом не говорит — 8 повторений с запасом
// в четыре и 8 на пределе это разные подходы, а в журнале они выглядят
// одинаково. RIR (reps in reserve) — сколько повторений человек мог бы
// сделать сверх выполненных — единственное, что их различает, и спросить
// это можно только у него самого.
//
// Шкалу держим короткой: между «остался один» и «осталось два» человек не
// ошибётся, а вот «RIR 4 или 5» — уже гадание, поэтому всё дальнее сведено
// в один пункт.
export const RIR_OPTIONS = [
  { value: 0, label: 'До отказа', hint: 'Ещё одно повторение не вышло бы' },
  { value: 1, label: 'Ещё 1', hint: 'Один в запасе — рабочая зона' },
  { value: 2, label: 'Ещё 2', hint: 'Два в запасе — тоже рабочая зона' },
  { value: 3, label: '3 и больше', hint: 'Далеко от отказа — вес слишком лёгкий' },
]

// Граница, за которой подход считается недоведённым. Внутри 0-2 рост
// практически одинаков, с трёх и дальше стимул заметно падает.
export const RIR_TOO_EASY = 3

export function isRir(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= RIR_TOO_EASY
}

export function rirLabel(value) {
  return RIR_OPTIONS.find((option) => option.value === Number(value))?.label || null
}

const ZONES = [
  {
    key: 'strength',
    maxReps: 5,
    label: 'Сила',
    tone: 'warn',
    hint: 'Лучший рост силовых, но на подход приходится меньше стимула для роста мышц — нужно больше подходов.',
  },
  {
    key: 'strength-size',
    maxReps: 8,
    label: 'Сила и масса',
    tone: 'ok',
    hint: 'Растим и силу, и мышцы. Дойти до отказа легко, но веса большие — нервная система устаёт.',
  },
  {
    key: 'hypertrophy',
    maxReps: 15,
    label: 'Масса',
    tone: 'ok',
    hint: 'Самый простой способ дойти до отказа: веса умеренные, жжение ещё не мешает.',
  },
  {
    key: 'endurance',
    maxReps: 30,
    label: 'Многоповторка',
    tone: 'warn',
    hint: 'Рост тот же, но до отказа дойти тяжело: молочная кислота останавливает раньше. Оправдана при ограничениях по весам.',
  },
  {
    key: 'out-of-range',
    maxReps: Infinity,
    label: 'Вне окна роста',
    tone: 'high',
    hint: 'Столько повторений почти никто не доводит до отказа — для мышц подход проходит впустую.',
  },
]

function toReps(value) {
  const reps = Number(value)
  return Number.isFinite(reps) && reps > 0 ? reps : 0
}

export function classifyReps(reps) {
  const value = toReps(reps)
  if (!value) return null
  return ZONES.find((zone) => value <= zone.maxReps)
}

// Насколько реально довести подход до отказа. До 15 повторений — вопрос
// только желания, дальше мешает жжение, а за 30 подход почти всегда
// заканчивается задолго до настоящего отказа.
export function failureReachability(reps) {
  const value = toReps(reps)
  if (!value) return 0
  if (value <= 15) return 1
  if (value <= GROWTH_MAX_REPS) return 1 - ((value - 15) / 15) * 0.2
  return 0.55
}

// Ценность одного подхода относительно эталонных 8-15 повторений: 1.0 —
// полноценный подход, 0.6 — подход на тройке.
export function setEffectiveness(reps) {
  const value = toReps(reps)
  if (!value) return 0
  const stimulus = Math.min(value, STIMULATING_REPS_PER_SET) / STIMULATING_REPS_PER_SET
  return stimulus * failureReachability(value)
}

// Приводим подходы к «эталонным»: 4 подхода по 3 повторения — это примерно
// 2.4 подхода в привычном понимании.
export function effectiveSets(sets, reps) {
  const count = Number(sets)
  if (!Number.isFinite(count) || count <= 0) return 0
  return Math.round(count * setEffectiveness(reps) * 100) / 100
}

// Сколько подходов нужно на выбранных повторениях, чтобы получить тот же
// эффект, что и base (по умолчанию 3×10). Это и есть приписка из ролика:
// чтобы догнать 3×10 на тройках, придётся сделать пять подходов.
export function setsForSameEffect(reps, baseSets = 3, baseReps = 10) {
  const target = setEffectiveness(reps)
  if (!target) return 0
  const needed = (baseSets * setEffectiveness(baseReps)) / target
  return Math.min(Math.ceil(needed - 0.001), 12)
}

// Формула Эпли. Честна примерно до 10-12 повторений — дальше расхождение
// растёт, поэтому оценку выше 12 повторений не строим.
const EPLEY_MAX_REPS = 12

export function estimateOneRepMax(weight, reps) {
  const kg = Number(weight)
  const value = toReps(reps)
  if (!Number.isFinite(kg) || kg <= 0 || !value || value > EPLEY_MAX_REPS) return null
  return Math.round(kg * (1 + value / 30) * 10) / 10
}

// Обратная задача: выбрали диапазон повторений — с каким весом заходить.
// Округляем до шага набора блинов, иначе число нельзя собрать на штанге.
export function weightForReps(oneRepMax, reps, step = 2.5) {
  const max = Number(oneRepMax)
  const value = toReps(reps)
  if (!Number.isFinite(max) || max <= 0 || !value || value > EPLEY_MAX_REPS) return null
  const raw = max / (1 + value / 30)
  return Math.round(raw / step) * step
}
