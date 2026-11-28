// Готовность к тренировке: сон, энергия, забитость мышц.
//
// Зачем это в приложении, которое считает веса. Прогрессия в progression.js
// смотрит только на цифры прошлой тренировки и предлагает прибавку так,
// будто человек каждый раз приходит одинаковым. Но после четырёх часов сна
// та же прибавка — не прогресс, а способ поймать травму или сорвать неделю.
//
// Числа ниже — не медицина, а грубая шкала «сегодня хуже или лучше обычного».
// Она и не должна быть точной: её задача — поймать те дни, когда планировать
// рекорд не стоит, и не мешать в остальные.

import { localDayKey } from './dates.js'

// Шкалы держим одинаковыми (1-5) и подписываем словами: «сон 3» человек
// оценит одинаково сегодня и через месяц, а «сон 6.5 часов» — нет.
export const SLEEP_OPTIONS = [
  { value: 1, label: 'Почти не спал' },
  { value: 2, label: 'Мало' },
  { value: 3, label: 'Нормально' },
  { value: 4, label: 'Хорошо' },
  { value: 5, label: 'Отлично' },
]

export const ENERGY_OPTIONS = [
  { value: 1, label: 'Выжат' },
  { value: 2, label: 'Вяло' },
  { value: 3, label: 'Обычно' },
  { value: 4, label: 'Бодро' },
  { value: 5, label: 'Полон сил' },
]

// Забитость идёт в обратную сторону: чем больше болит, тем хуже готовность.
export const SORENESS_OPTIONS = [
  { value: 1, label: 'Ничего не болит' },
  { value: 2, label: 'Слегка' },
  { value: 3, label: 'Заметно' },
  { value: 4, label: 'Сильно' },
  { value: 5, label: 'Больно двигаться' },
]

// Веса подобраны по влиянию на силовые: недосып бьёт сильнее всего, боль в
// мышцах — заметно, но она чаще мешает технике, чем самой силе.
const WEIGHTS = { sleep: 0.45, energy: 0.35, soreness: 0.2 }

// Пороги смещены к нижнему краю нарочно. «Не выспался и мышцы побаливают» —
// это обычный рабочий день, а не повод остаться дома: приложение, которое на
// каждое недомогание советует отдых, быстро приучает не отвечать честно.
// Красная зона оставлена для случаев, где плохо действительно всё.
const ZONES = [
  { min: 75, key: 'high', label: 'Готов', tone: 'ok', advice: 'Обычный план. Если сегодня выходит прибавка — берите её.' },
  { min: 50, key: 'normal', label: 'Рабочее состояние', tone: 'ok', advice: 'Работайте по плану, но рекорд сегодня не самоцель.' },
  { min: 28, key: 'low', label: 'Ниже обычного', tone: 'warn', advice: 'Оставьте прошлый вес и уберите последний подход в тяжёлых упражнениях. Прибавку отложите до следующего раза.' },
  { min: 0, key: 'poor', label: 'Плохо', tone: 'high', advice: 'Сегодня лучше лёгкая работа или отдых: на таком фоне тренировка отнимает больше, чем даёт.' },
]

const clamp = (value) => Math.min(5, Math.max(1, Math.round(Number(value) || 0)))

// Принимает и null: todayCheckin() возвращает его, когда отметки за сегодня
// нет, и это самый частый случай — деструктуризация с дефолтом здесь не
// спасает, дефолт параметра срабатывает только на undefined.
export function readinessScore(checkin) {
  const { sleep, energy, soreness } = checkin || {}
  if (!sleep && !energy && !soreness) return null

  const s = clamp(sleep || 3)
  const e = clamp(energy || 3)
  // Инвертируем: 1 «ничего не болит» должно давать максимум.
  const so = 6 - clamp(soreness || 1)

  const raw = s * WEIGHTS.sleep + e * WEIGHTS.energy + so * WEIGHTS.soreness
  // raw лежит в 1..5 — переводим в проценты.
  const percent = Math.round(((raw - 1) / 4) * 100)
  const zone = ZONES.find((z) => percent >= z.min) || ZONES[ZONES.length - 1]

  return {
    percent,
    key: zone.key,
    label: zone.label,
    tone: zone.tone,
    advice: zone.advice,
    // Насколько урезать нагрузку. Прогрессия сама этого не знает, поэтому
    // множитель отдаём наружу явным числом.
    loadFactor: zone.key === 'poor' ? 0.7 : zone.key === 'low' ? 0.85 : 1,
    sleep: s,
    energy: e,
    soreness: clamp(soreness || 1),
  }
}

export function todayCheckin(checkins = [], now = new Date()) {
  const key = localDayKey(now)
  return checkins.find((entry) => localDayKey(entry?.date) === key) || null
}

// Средняя готовность за последние дни — по ней тренер и замечает, что дело
// не в одном плохом дне.
export function averageReadiness(checkins = [], days = 7, now = new Date()) {
  const from = new Date(now)
  from.setDate(from.getDate() - days)

  const recent = checkins.filter((entry) => entry?.date && new Date(entry.date) >= from)
  if (recent.length === 0) return null

  const scores = recent.map((entry) => readinessScore(entry)).filter(Boolean)
  if (scores.length === 0) return null

  return {
    count: scores.length,
    percent: Math.round(scores.reduce((sum, s) => sum + s.percent, 0) / scores.length),
  }
}
