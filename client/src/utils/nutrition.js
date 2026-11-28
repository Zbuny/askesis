// Дневные нормы КБЖУ из того, что человек уже указал в профиле.
//
// Сканер отвечает на вопрос «что я съел», но не на вопрос «много это или
// мало». Второе без нормы не имеет смысла: 2000 ккал — это дефицит для
// одного и профицит для другого.
//
// Все формулы — общепринятые оценки, а не медицинские предписания, и точность
// у них своя: разброс основного обмена между двумя людьми одного веса, роста
// и возраста доходит до 10-15%. Поэтому норма здесь — ориентир, от которого
// отталкиваются и который правят по факту (весу на весах), а не цель, которую
// нужно выполнить до килокалории.

const ACTIVITY_BASE = 1.2

// Прибавка к основному обмену за каждую тренировку в неделю. Три тренировки
// дают привычный коэффициент «умеренной активности» ≈ 1.55.
const ACTIVITY_PER_SESSION = 0.117

// Поправка под цель. Держим её умеренной: дефицит больше 20% съедает мышцы
// вместе с жиром, а профицит больше 15% — это лишний жир, а не масса.
export const NUTRITION_GOALS = {
  'Снизить вес': { key: 'cut', factor: 0.82, hint: 'Дефицит около 18% — вес уходит примерно на 0.5 кг в неделю.' },
  'Набрать мышечную массу': { key: 'bulk', factor: 1.12, hint: 'Профицит около 12% — быстрее растёт уже не мышца, а жир.' },
  'Увеличить силу': { key: 'strength', factor: 1.05, hint: 'Небольшой профицит: силе нужен ресурс на восстановление.' },
  'Развить выносливость': { key: 'endurance', factor: 1, hint: 'Поддерживающая калорийность с упором на углеводы.' },
  'Поддерживать форму': { key: 'maintain', factor: 1, hint: 'Поддерживающая калорийность.' },
}

// Белок на килограмм веса. 1.6 г/кг — точка, после которой прибавка почти не
// влияет на рост мышц; на дефиците берём выше, потому что там белок ещё и
// защищает мышцы от распада.
const PROTEIN_PER_KG = { cut: 2.2, bulk: 1.8, strength: 2, endurance: 1.6, maintain: 1.6 }

// Доля жиров от калорийности. Ниже 20% страдает гормональный фон, поэтому
// урезаем углеводы, а не жир.
const FAT_SHARE = 0.27

const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 }

// Средний коэффициент для тех, кто не указал пол. Формула Миффлина-Сан Жеора
// различает мужчин и женщин константой (+5 против −161), и без ответа честнее
// взять середину, чем молча посчитать человека мужчиной.
const SEX_OFFSET = { male: 5, female: -161, unknown: -78 }

export function basalMetabolicRate({ weight, height, age, sex }) {
  const kg = Number(weight)
  const cm = Number(height)
  const years = Number(age)
  if (!kg || !cm || !years) return null
  if (cm < 80 || cm > 260 || kg < 20 || kg > 400 || years < 5 || years > 120) return null

  const offset = SEX_OFFSET[sex] ?? SEX_OFFSET.unknown
  return Math.round(10 * kg + 6.25 * cm - 5 * years + offset)
}

export function activityFactor(daysPerWeek) {
  const days = Number(daysPerWeek)
  if (!Number.isFinite(days) || days <= 0) return ACTIVITY_BASE
  return Math.round((ACTIVITY_BASE + Math.min(days, 7) * ACTIVITY_PER_SESSION) * 100) / 100
}

// Норма считается только когда есть из чего: без веса, роста и возраста
// любое число здесь было бы выдумкой, и показывать его хуже, чем ничего.
export function dailyTargets({ weight, height, age, sex, goal, daysPerWeek } = {}) {
  const bmr = basalMetabolicRate({ weight, height, age, sex })
  if (!bmr) return null

  const goalRule = NUTRITION_GOALS[goal] || NUTRITION_GOALS['Поддерживать форму']
  const factor = activityFactor(daysPerWeek)
  const calories = Math.round((bmr * factor * goalRule.factor) / 10) * 10

  const protein = Math.round(Number(weight) * PROTEIN_PER_KG[goalRule.key])
  const fat = Math.round((calories * FAT_SHARE) / KCAL_PER_GRAM.fat)
  const carbsKcal = calories - protein * KCAL_PER_GRAM.protein - fat * KCAL_PER_GRAM.fat
  // На жёстком дефиците у высокого белка углеводов может не остаться вовсе —
  // отрицательное число здесь бессмысленно, показываем ноль.
  const carbs = Math.max(0, Math.round(carbsKcal / KCAL_PER_GRAM.carbs))

  return {
    bmr,
    factor,
    calories,
    protein,
    fat,
    carbs,
    goal: goalRule.key,
    hint: goalRule.hint,
    // Пол влияет на основной обмен примерно на 165 ккал — на дистанции это
    // заметно, поэтому о пропуске честно предупреждаем.
    approximate: !sex || sex === 'unknown',
  }
}

// Насколько день закрыт. Возвращаем и перебор: 140% по углеводам — такой же
// ответ на вопрос «как я поел», как и 60%.
export function dayProgress(targets, totals = {}) {
  if (!targets) return null

  const row = (key, unit) => {
    const target = Number(targets[key]) || 0
    const eaten = Math.round(Number(totals[key]) || 0)
    return {
      key,
      unit,
      target,
      eaten,
      left: Math.max(0, target - eaten),
      over: Math.max(0, eaten - target),
      percent: target > 0 ? Math.round((eaten / target) * 100) : 0,
    }
  }

  return {
    calories: row('calories', 'ккал'),
    protein: row('protein', 'г'),
    fat: row('fat', 'г'),
    carbs: row('carbs', 'г'),
  }
}

// Строки для тренера — тем же плоским списком, что и везде (см. coach.js).
export function nutritionFacts(targets, progress) {
  if (!targets || !progress) return []

  const facts = [
    `Дневная норма: ${targets.calories} ккал, белки ${targets.protein} г, жиры ${targets.fat} г, углеводы ${targets.carbs} г.`,
    `Основной обмен ${targets.bmr} ккал, коэффициент активности ${targets.factor}. ${targets.hint}`,
  ]

  Object.values(progress).forEach((row) => {
    facts.push(
      `${LABELS[row.key]}: съедено ${row.eaten} ${row.unit} из ${row.target} (${row.percent}%).`,
    )
  })

  if (targets.approximate) {
    facts.push('Пол не указан, поэтому основной обмен посчитан по усреднённой формуле — норма приблизительная.')
  }

  return facts
}

export const LABELS = {
  calories: 'Калории',
  protein: 'Белки',
  fat: 'Жиры',
  carbs: 'Углеводы',
}

export const SEX_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
]
