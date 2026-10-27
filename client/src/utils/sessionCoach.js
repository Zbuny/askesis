import { formatReps } from './programItems.js'
import { formatTarget } from './progression.js'
import { RIR_OPTIONS } from './repRanges.js'

// Тренер во время тренировки. В общем чате человек сам прикладывает свои
// данные, а здесь вопрос задают на весу, между подходами, — и «какой вес
// взять дальше?» без знания того, что сейчас в форме, превращается в лекцию.
// Поэтому текущая тренировка уходит с каждым вопросом сама.

function formatSets(sets) {
  return (sets || [])
    .filter((set) => String(set.weight ?? '').trim() || String(set.reps ?? '').trim())
    .map((set) => {
      const weight = Number(set.weight) || 0
      const reps = String(set.reps ?? '').trim() || '?'
      return weight ? `${weight}×${reps}` : `${reps} повт.`
    })
    .join(', ')
}

function rirLabel(value) {
  return RIR_OPTIONS.find((option) => option.value === value)?.label || ''
}

// Сжатый снимок тренировки для воркера. Значения подходов — то, что сейчас
// в форме: часть из них подставлена из прошлого раза, и воркер об этом
// предупреждён, иначе прошлые цифры читались бы как сегодняшние.
export function buildSessionContext({
  workout,
  results = {},
  rir = {},
  targets = new Map(),
  exerciseNames = {},
  readiness = null,
  elapsedSeconds = 0,
  focusExerciseId = null,
}) {
  if (!workout) return null
  const items = workout.items || []

  const exercises = items.slice(0, 20).map((item) => {
    const target = targets.get(item.exerciseId)
    return {
      name: exerciseNames[item.exerciseId] || item.exerciseName || '',
      plan: `${item.targetSets || 0}×${formatReps(item)}`,
      today: target ? formatTarget(target) : '',
      sets: formatSets(results[item.exerciseId]),
      rir: rirLabel(rir[item.exerciseId]),
    }
  })

  const focusItem = focusExerciseId ? items.find((item) => item.exerciseId === focusExerciseId) : null

  return {
    title: workout.title || '',
    minutes: elapsedSeconds > 0 ? Math.floor(elapsedSeconds / 60) : null,
    readiness: readiness ? `${readiness.percent}%` : null,
    focus: focusItem ? exerciseNames[focusItem.exerciseId] || focusItem.exerciseName || '' : null,
    exercises,
  }
}

// Готовые вопросы. Про конкретное упражнение — то, о чём спрашивают у
// тренера в зале; общие — про ход всей тренировки.
export function quickQuestions(focusName) {
  if (focusName) {
    return [
      `Какой вес взять в «${focusName}» в следующем подходе?`,
      `Чем заменить «${focusName}», если снаряд занят?`,
      `На что смотреть в технике «${focusName}»?`,
      `Неприятно в суставе на «${focusName}» — что делать?`,
    ]
  }
  return [
    'Сколько отдыхать между подходами?',
    'Мало времени — что можно сократить?',
    'Сил не осталось — доделать или закончить?',
    'Что съесть после тренировки?',
  ]
}
