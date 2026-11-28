// Тренер: что делать дальше и почему.
//
// Вывод считается здесь, детерминированно, из журнала — модель его не
// принимает, а только пересказывает (см. api/ai.js → askCoach). Причины две.
//
// Первая: все нужные числа уже посчитаны соседними модулями — серия
// (streak.js), рекорды (records.js), прогрессия (progression.js), объём по
// группам (statistics.js). Модель, которой их пересказали словами, начинает
// их искажать, и совет на дашборде расходится с цифрами на том же экране.
//
// Вторая: воркер с ИИ может быть не развёрнут или упереться в квоту Groq, а
// «что делать сегодня» — не та вещь, которая имеет право пропасть с экрана.
// Поэтому без воркера тренер работает целиком, просто молча.

import { STALE_AFTER_DAYS, nextSessionTarget } from './progression.js'
import { RIR_TOO_EASY, WEEKLY_SETS_PER_MUSCLE, estimateOneRepMax, isRir } from './repRanges.js'
import { WEEKLY_WORKOUT_GOAL } from './gamification.js'
import { recordGain, recordList } from './records.js'
import { streakSummary } from './streak.js'
import { suggestTodayWorkout } from './planner.js'
import { goalList } from './goals.js'
import { averageReadiness, readinessScore, todayCheckin } from './readiness.js'
import { entrySets, entryTopWeight } from './workoutLog.js'
import { startOfLocalDay, startOfLocalWeek, uniqueDayKeys, weekKey } from './dates.js'
import { pluralRu, translateMuscle } from './translate.js'

// Окно, по которому судим о недельном объёме: четыре недели сглаживают
// случайную неделю с отпуском или болезнью, а WEEKLY_SETS_PER_MUSCLE задан
// как раз на неделю — поэтому делим набранное на четыре.
export const VOLUME_WINDOW_DAYS = 28
const VOLUME_WINDOW_WEEKS = VOLUME_WINDOW_DAYS / 7

// Застой ищем в этом окне: то, что было три месяца назад, о сегодняшнем
// плато уже ничего не говорит.
const PLATEAU_WINDOW_DAYS = 60

// Сколько тренировок подряд без прибавки считаем застоем. Одна неудачная
// тренировка — обычный день, две подряд после лучшего результата — уже
// повод менять подход.
const PLATEAU_SESSIONS = 2

const daysWord = (n) => pluralRu(n, 'день', 'дня', 'дней')
const setsWord = (n) => pluralRu(n, 'подход', 'подхода', 'подходов')
const workoutsWord = (n) => pluralRu(n, 'тренировка', 'тренировки', 'тренировок')

function daysSince(date, now) {
  const from = startOfLocalDay(date)
  const to = startOfLocalDay(now)
  if (!from || !to) return null
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function withinDays(history, days, now) {
  return history.filter((session) => {
    const passed = daysSince(session?.date, now)
    return passed != null && passed >= 0 && passed <= days
  })
}

// Лучший подход тренировки в пересчёте на разовый максимум: сравнивать
// упражнения по одному весу нечестно (100×1 и 100×8 — разные вещи), а
// формула Эпли за 12 повторений врёт, поэтому там опираемся на сам вес.
function entryScore(entry) {
  let best = 0
  entrySets(entry).forEach((set) => {
    const weight = Number(set?.weight) || 0
    const reps = Number(set?.reps) || 0
    if (weight <= 0 || reps <= 0) return
    best = Math.max(best, estimateOneRepMax(weight, reps) ?? weight)
  })
  return best
}

function countedSets(entry) {
  return entrySets(entry).filter((set) => (Number(set?.reps) || 0) > 0).length
}

// ---------- объём по группам мышц ----------

// Группа мышц живёт в каталоге, а не в журнале: без загруженного каталога
// честнее не считать ничего, чем приписывать подходы «прочему».
export function weeklyMuscleSets(history = [], exerciseById = new Map(), now = new Date()) {
  const totals = new Map()

  withinDays(history, VOLUME_WINDOW_DAYS, now).forEach((session) => {
    ;(session.entries || []).forEach((entry) => {
      const group = exerciseById.get?.(entry.exerciseId)?.muscleGroup
      if (!group) return
      const sets = countedSets(entry)
      if (sets === 0) return
      const current = totals.get(group) || { key: group, label: translateMuscle(group), sets: 0 }
      current.sets += sets
      totals.set(group, current)
    })
  })

  return [...totals.values()]
    .map((row) => ({ ...row, perWeek: Math.round((row.sets / VOLUME_WINDOW_WEEKS) * 10) / 10 }))
    .sort((a, b) => b.perWeek - a.perWeek)
}

// ---------- близость к отказу ----------

// Сколько отмеченных подходов за окно оказались далеко от отказа. Смотрим
// только на те, где запас вообще отмечен: неотмеченные ничего не говорят ни
// в одну сторону, и считать их «доведёнными» было бы выдумкой.
export function effortSummary(history = [], now = new Date(), days = VOLUME_WINDOW_DAYS) {
  let marked = 0
  let tooEasy = 0

  withinDays(history, days, now).forEach((session) => {
    ;(session.entries || []).forEach((entry) => {
      if (!isRir(entry?.rir)) return
      marked += 1
      if (Number(entry.rir) >= RIR_TOO_EASY) tooEasy += 1
    })
  })

  return { marked, tooEasy, share: marked ? tooEasy / marked : 0 }
}

// ---------- застой ----------

// Упражнение в застое: лучший результат остался позади, и с тех пор прошло
// уже несколько тренировок. Считаем по лучшему подходу каждой тренировки —
// именно он и растёт, когда прогрессия работает.
export function plateaus(history = [], now = new Date()) {
  const byExercise = new Map()

  withinDays(history, PLATEAU_WINDOW_DAYS, now)
    .filter((session) => session?.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((session) => {
      ;(session.entries || []).forEach((entry) => {
        const score = entryScore(entry)
        if (!entry?.exerciseId || score <= 0) return
        const points = byExercise.get(entry.exerciseId) || {
          exerciseId: entry.exerciseId,
          name: entry.exerciseName || entry.exerciseId,
          points: [],
        }
        points.points.push({ date: session.date, score, weight: entryTopWeight(entry) })
        byExercise.set(entry.exerciseId, points)
      })
    })

  return [...byExercise.values()]
    .map((exercise) => {
      const { points } = exercise
      let bestIndex = 0
      points.forEach((point, i) => {
        if (point.score > points[bestIndex].score) bestIndex = i
      })
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        sessions: points.length,
        // Сколько тренировок прошло после лучшей.
        stalled: points.length - 1 - bestIndex,
        best: points[bestIndex],
        last: points[points.length - 1],
      }
    })
    .filter((row) => row.sessions >= PLATEAU_SESSIONS + 1 && row.stalled >= PLATEAU_SESSIONS)
    .sort((a, b) => b.stalled - a.stalled || b.sessions - a.sessions)
}

// ---------- готовность к прибавке ----------

// Что из сегодняшней тренировки уже доросло до прибавки веса. Правило то же
// самое, что на странице тренировки: одна логика прогрессии на всё приложение.
export function readyToAdd({ workout, history = [], exerciseById = new Map(), level, now = new Date() }) {
  if (!workout?.items?.length) return []

  // Порядок истории здесь не закладываем: api отдаёт свежие первыми, но
  // прогрессия обязана считаться от последней тренировки при любом порядке.
  const last = history
    .filter((session) => session?.workoutId === workout.id && session?.date)
    .reduce((latest, session) => (!latest || new Date(session.date) > new Date(latest.date) ? session : latest), null)
  const lastEntries = new Map((last?.entries || []).map((entry) => [entry.exerciseId, entry]))

  return workout.items
    .map((item) => {
      const target = nextSessionTarget({
        item,
        lastEntry: lastEntries.get(item.exerciseId),
        lastDate: last?.date,
        exercise: exerciseById.get?.(item.exerciseId),
        level,
        now,
      })
      return { item, target, name: item.exerciseName || item.exerciseId }
    })
    .filter((row) => row.target.action === 'add-weight')
}

// ---------- сами наблюдения ----------

// insight — одна законченная мысль: заголовок, объяснение, что нажать и что
// спросить у тренера. Порядок в массиве и есть приоритет: выше стоит то, что
// требует решения сегодня, ниже — то, что просто полезно знать.
function insight(key, tone, title, text, extra = {}) {
  return { key, tone, title, text, action: null, ask: null, ...extra }
}

export function coachInsights({
  history = [],
  workouts = [],
  exerciseById = new Map(),
  foodLogs = [],
  goals = [],
  checkins = [],
  level = '',
  weeklyGoal = WEEKLY_WORKOUT_GOAL,
  now = new Date(),
} = {}) {
  const out = []
  const dates = history.map((session) => session?.date)
  const streak = streakSummary(dates, now)
  const today = suggestTodayWorkout(workouts, history)
  const todayAction = today
    ? { label: today.doneToday ? 'Открыть тренировку' : 'Начать тренировку', to: `/workouts/${today.workout.id}` }
    : { label: 'Собрать тренировку', to: '/workouts/new' }

  const lastDate = history.reduce(
    (latest, session) => (session?.date && (!latest || new Date(session.date) > new Date(latest)) ? session.date : latest),
    null,
  )
  const idle = lastDate ? daysSince(lastDate, now) : null

  // 1. Ещё ни одной записи. Всё остальное ниже считается из журнала, а его нет.
  if (history.length === 0) {
    out.push(
      insight(
        'first-session',
        'info',
        'Начнём с первой записи',
        'Пока журнал пуст, советовать нечего: прогрессия, серия и рекорды считаются из того, что вы реально сделали. Запишите первую тренировку — со второй появятся конкретные веса.',
        { action: todayAction, ask: 'Я только начинаю. С чего начать в зале и как часто ходить?' },
      ),
    )
    return out
  }

  // 2. Долгий перерыв. Разбирается первым: пока не вернулись, остальные советы
  //    рассуждают о прогрессии, которой сейчас не будет.
  if (idle != null && idle > STALE_AFTER_DAYS) {
    out.push(
      insight(
        'comeback',
        'warn',
        `Перерыв ${idle} ${daysWord(idle)}`,
        `Больше ${STALE_AFTER_DAYS} дней без зала — часть формы теряется, и прибавлять сейчас не с чего. Вернитесь на прошлых весах, а прибавите со следующей тренировки: приложение само предложит это на странице тренировки.`,
        { action: todayAction, ask: `Я не тренировался ${idle} ${daysWord(idle)}. Как вернуться, чтобы не сорваться и не получить травму?` },
      ),
    )
  }

  // 3. Серия под угрозой — единственное, что сгорает именно сегодня.
  if (streak.current >= 2 && !streak.trainedToday) {
    out.push(
      insight(
        'streak-risk',
        'warn',
        `Серия ${streak.current} ${daysWord(streak.current)} под угрозой`,
        'Сегодняшней записи ещё нет. Пропуск целых суток обнуляет серию — вчерашняя тренировка её пока держит.',
        { action: todayAction, ask: null },
      ),
    )
  }

  // 4. Сегодняшняя готовность. Стоит высоко, потому что меняет план именно
  //    на сегодня — в отличие от объёма и застоя, которые терпят до завтра.
  const readiness = readinessScore(todayCheckin(checkins, now))
  if (readiness && readiness.loadFactor < 1) {
    out.push(
      insight(
        'readiness-low',
        readiness.tone,
        `Готовность ${readiness.percent}% — ${readiness.label.toLowerCase()}`,
        readiness.advice,
        { action: todayAction, ask: 'Стоит ли тренироваться, если плохо спал и мышцы ещё болят после прошлой тренировки?' },
      ),
    )
  }

  // Просевшее восстановление на дистанции — это уже не про один день, а про
  // объём: недельная нагрузка выше того, что организм успевает переварить.
  const week = averageReadiness(checkins, 7, now)
  if (!readiness && week && week.count >= 3 && week.percent < 45) {
    out.push(
      insight(
        'recovery-debt',
        'warn',
        `Восстановление ниже нормы: ${week.percent}% за неделю`,
        'Так выглядит не усталость одного дня, а перебор с объёмом. Самое надёжное — неделя с половиной обычных подходов: силовые от этого не падают, а сон и суставы возвращаются.',
        { action: { label: 'Посмотреть объём', to: '/statistics' } },
      ),
    )
  }

  // 5. Недельная цель — но только если её ещё реально успеть закрыть.
  const thisWeek = weekKey(now)
  const doneThisWeek = uniqueDayKeys(
    history.filter((session) => weekKey(session?.date) === thisWeek).map((session) => session.date),
  ).length
  const sunday = startOfLocalWeek(now)
  sunday?.setDate(sunday.getDate() + 6)
  const daysLeft = sunday ? daysSince(now, sunday) + 1 : 0
  const needed = weeklyGoal - doneThisWeek

  if (needed > 0 && daysLeft >= needed && idle != null && idle <= STALE_AFTER_DAYS) {
    out.push(
      insight(
        'weekly-goal',
        'info',
        `До недельной цели ${needed} ${workoutsWord(needed)}`,
        `На этой неделе ${doneThisWeek} из ${weeklyGoal}, впереди ещё ${daysLeft} ${daysWord(daysLeft)}. Успеваете.`,
        { action: todayAction },
      ),
    )
  }

  // 6. Что готово к прибавке прямо сегодня — самый предметный совет из всех.
  const ready = today ? readyToAdd({ workout: today.workout, history, exerciseById, level, now }) : []
  if (ready.length > 0 && !today.doneToday) {
    const names = ready.slice(0, 3).map((row) => row.name).join(', ')
    out.push(
      insight(
        'ready-to-add',
        'ok',
        `${ready.length} ${pluralRu(ready.length, 'упражнение готово', 'упражнения готовы', 'упражнений готовы')} к прибавке`,
        `Верх диапазона взят во всех рабочих подходах: ${names}. Сегодня можно прибавить вес — на странице тренировки цифры уже подставлены кнопкой «Взять».`,
        { action: todayAction },
      ),
    )
  }

  // 7. Систематический недобор до отказа. Стоит выше застоя намеренно: это
  //    его самая частая причина, и разбираться с плато, не закрыв её,
  //    бессмысленно. Порог в пять отметок — чтобы вывод не строился на
  //    одной неудачной тренировке.
  const effort = effortSummary(history, now)
  if (effort.marked >= 5 && effort.share >= 0.5) {
    const percent = Math.round(effort.share * 100)
    out.push(
      insight(
        'too-easy',
        'warn',
        `Половина подходов далеко от отказа`,
        `В ${percent}% отмеченных подходов оставалось ${RIR_TOO_EASY}+ повторений в запасе. Рост дают не сами повторения, а близость к пределу — иначе тренировка проходит впустую, сколько её ни делай. Приложение уже поднимает вес по таким упражнениям сильнее обычного.`,
        { ask: 'Как понять, что я довёл подход близко к отказу, и не опасно ли так тренироваться?' },
      ),
    )
  }

  // 8. Застой. Ищем по всей истории, а не только по сегодняшней тренировке:
  //    упражнение может стоять в нескольких.
  const stalled = plateaus(history, now)[0]
  if (stalled) {
    out.push(
      insight(
        'plateau',
        'warn',
        `${stalled.name}: ${stalled.stalled} ${workoutsWord(stalled.stalled)} без прибавки`,
        `Лучший подход был ${new Date(stalled.best.date).toLocaleDateString('ru-RU')} — ${stalled.best.weight} кг, с тех пор выше не поднимались. Обычно помогает одно из трёх: снять 10% веса и набрать повторы заново, добавить подход или дать группе лишний день отдыха.`,
        {
          ask: `У меня застой в упражнении «${stalled.name}»: ${stalled.stalled} ${workoutsWord(stalled.stalled)} подряд не могу прибавить с ${stalled.best.weight} кг. Что делать?`,
        },
      ),
    )
  }

  // 9. Перебор по группе мышц.
  const volume = weeklyMuscleSets(history, exerciseById, now)
  const overloaded = volume.find((row) => row.perWeek > WEEKLY_SETS_PER_MUSCLE.max)
  if (overloaded) {
    out.push(
      insight(
        'overloaded-muscle',
        'warn',
        `${overloaded.label}: ${overloaded.perWeek} ${setsWord(Math.round(overloaded.perWeek))} в неделю`,
        `Выше ${WEEKLY_SETS_PER_MUSCLE.max} подходов в неделю прибавки уже почти нет, а восстановление страдает. Лишние подходы полезнее отдать отстающей группе.`,
        { action: { label: 'Посмотреть объём', to: '/statistics' } },
      ),
    )
  }

  // 10. Отстающая группа. Только среди тех, что человек вообще тренирует, и
  //    только когда хотя бы одна другая группа набирает норму: иначе это не
  //    перекос, а просто мало тренировок — про это говорит пункт 4.
  const hasNormalGroup = volume.some((row) => row.perWeek >= WEEKLY_SETS_PER_MUSCLE.min)
  const lagging = hasNormalGroup
    ? [...volume].reverse().find((row) => row.perWeek < WEEKLY_SETS_PER_MUSCLE.min)
    : null
  if (lagging) {
    out.push(
      insight(
        'lagging-muscle',
        'info',
        `${lagging.label} отстаёт`,
        `За четыре недели вышло ${lagging.perWeek} ${setsWord(Math.round(lagging.perWeek))} в неделю при норме ${WEEKLY_SETS_PER_MUSCLE.min}-${WEEKLY_SETS_PER_MUSCLE.max}. Добавьте одно-два упражнения на эту группу в любую из тренировок.`,
        {
          action: { label: 'Собрать тренировку', to: '/workouts/new' },
          ask: `Какие упражнения добавить на группу «${lagging.label}», если сейчас на неё выходит всего ${lagging.perWeek} подходов в неделю?`,
        },
      ),
    )
  }

  // 11. Цели. Взятую показываем один раз — на той же неделе, когда её взяли:
  //     дальше это уже не новость, а строка в списке целей.
  const goalRows = goalList(goals, history)
  const takenGoal = goalRows.find((row) => {
    if (!row.achieved || !row.record?.date) return false
    const passed = daysSince(row.record.date, now)
    return passed != null && passed <= 7
  })
  if (takenGoal) {
    out.push(
      insight(
        'goal-reached',
        'ok',
        `Цель взята: ${takenGoal.goal.exerciseName}`,
        `${takenGoal.current} ${takenGoal.unit} — то, ради чего всё и затевалось. Самое время поставить следующую: без неё прогрессия быстро превращается в поддержание формы.`,
        { action: { label: 'Поставить новую', to: '/statistics' } },
      ),
    )
  }

  // Ближайшая цель — только когда до неё уже рукой подать. «Осталось 40 кг»
  // не помогает, а мозолит глаза каждый день.
  const closeGoal = goalRows.find((row) => !row.achieved && row.percent >= 75 && row.record)
  if (closeGoal) {
    out.push(
      insight(
        'goal-close',
        'ok',
        `До цели «${closeGoal.goal.exerciseName}» осталось ${closeGoal.remaining} ${closeGoal.unit}`,
        `Пройдено ${closeGoal.percent}% пути от того, с чего начинали. На таком остатке важнее не форсировать вес, а доводить подходы до отказа — прибавка придёт сама.`,
        { action: { label: 'Все цели', to: '/statistics' } },
      ),
    )
  }

  // 12. Свежий рекорд — единственный повод похвалить, и он должен быть честным.
  const fresh = recordList(history).find((record) => {
    const passed = daysSince(record.date, now)
    return passed != null && passed <= 7
  })
  if (fresh) {
    const gain = recordGain(fresh)
    out.push(
      insight(
        'fresh-record',
        'ok',
        `Рекорд: ${fresh.name}`,
        gain
          ? `${fresh.weight} кг × ${fresh.reps} — на ${gain} кг больше прошлого лучшего. Прогрессия работает, менять ничего не нужно.`
          : `${fresh.weight} кг × ${fresh.reps} — первый рекорд в этом упражнении. Дальше от него и считаем прибавку.`,
        { action: { label: 'Все рекорды', to: '/statistics' } },
      ),
    )
  }

  // 13. Уровень влияет на шаг прибавки веса — без него считаем по среднему.
  if (!level) {
    out.push(
      insight(
        'no-level',
        'info',
        'Уровень подготовки не указан',
        'От него зависят и рекомендованный диапазон повторений, и шаг прибавки веса: новичку 5% за неделю, продвинутому 1.5%. Пока не указан — считаем по среднему.',
        { action: { label: 'Указать в профиле', to: '/profile' } },
      ),
    )
  }

  // 14. Питание. Советуем только тем, кто уже ходит регулярно: человеку с
  //     одной тренировкой в месяц считать белок рано.
  const trainedRecently = withinDays(history, 7, now).length
  const loggedFood = withinDays(foodLogs, 7, now).length
  if (trainedRecently >= 2 && loggedFood === 0) {
    out.push(
      insight(
        'nutrition-gap',
        'info',
        'Питание не записано',
        `За неделю ${trainedRecently} ${workoutsWord(trainedRecently)}, а еды в дневнике нет. Мышцы растут из того, что вы едите, — хотя бы пара дней замеров покажет, хватает ли белка.`,
        { action: { label: 'Открыть сканер', to: '/nutrition' }, ask: 'Сколько белка мне нужно в день при силовых тренировках три раза в неделю?' },
      ),
    )
  }

  return out
}

// ---------- то, что уходит модели ----------

// Модели отдаём уже готовые формулировки, а не сырые данные: пересказывать
// ей нечего, задача — связать наблюдения в один совет. Плоский список строк
// вместо JSON выбран нарочно — его легко проверить на стороне воркера и
// невозможно подсунуть как инструкцию.
export function coachFacts({ insights = [], summary = null, streak = null, week = null } = {}) {
  const facts = []

  if (summary) facts.push(`Уровень ${summary.level} («${summary.title}»), ${summary.xp} XP всего.`)
  if (streak) {
    facts.push(
      `Серия: ${streak.current} ${daysWord(streak.current)} подряд, лучшая за всё время — ${streak.best}.`,
    )
  }
  if (week) facts.push(`На этой неделе ${week.done} ${workoutsWord(week.done)} из ${week.goal} по цели.`)

  insights.forEach((item) => facts.push(`${item.title}. ${item.text}`))

  return facts
}
