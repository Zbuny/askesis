// Индекс массы тела считается из веса и роста, которые пользователь уже
// вводит в профиле — отдельных полей не нужно.
const CATEGORIES = [
  { max: 18.5, label: 'Недостаток веса', tone: 'low' },
  { max: 25, label: 'Норма', tone: 'ok' },
  { max: 30, label: 'Избыточный вес', tone: 'warn' },
  { max: Infinity, label: 'Ожирение', tone: 'high' },
]

export function calcBmi(weightKg, heightCm) {
  const weight = Number(weightKg)
  const height = Number(heightCm)
  if (!weight || !height) return null
  // Отсекаем явную ерунду вроде роста в метрах или опечаток.
  if (height < 80 || height > 260 || weight < 20 || weight > 400) return null

  const meters = height / 100
  const value = weight / (meters * meters)
  const category = CATEGORIES.find((c) => value < c.max)

  return {
    value: Math.round(value * 10) / 10,
    label: category.label,
    tone: category.tone,
    // Положение на шкале 15–40 для полоски-индикатора.
    percent: Math.min(100, Math.max(0, ((value - 15) / 25) * 100)),
  }
}
