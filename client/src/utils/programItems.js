// Программы, созданные до появления подходов/повторов, хранят только
// exerciseIds — расширяем их значениями по умолчанию, пока админ не
// отредактирует и не сохранит программу в новом формате.
// «4 × 8-10» и «2 × до отказа» — в плане у человека диапазоны, а не одно
// число. targetReps хранит нижнюю границу, targetRepsMax — верхнюю;
// 0 повторов означает «до отказа».
export function formatReps(item) {
  if (!item.targetReps) return 'до отказа'
  if (item.targetRepsMax && item.targetRepsMax !== item.targetReps) {
    return `${item.targetReps}-${item.targetRepsMax}`
  }
  return String(item.targetReps)
}

export function programItems(program) {
  if (program.items && program.items.length) return program.items
  return (program.exerciseIds || []).map((exerciseId) => ({
    exerciseId,
    targetSets: 3,
    targetReps: 10,
  }))
}

// ---------- Редактирование подходов и повторов ----------
//
// Пока человек правит поле, в нём может быть пусто: стёр «10», чтобы
// вписать «12». Раньше значение сразу приводилось через Number(), а
// Number('') === 0 — ноль тут же возвращался в поле, и стереть его было
// нельзя. Поэтому во время правки пустое поле хранится как '', а в число
// превращается и проверяется только перед сохранением (normalizePlanItems).
//
// Пределы совпадают с firestore.rules (validWorkoutItem): база отклонит
// всё, что выходит за них, и лучше сказать об этом понятным текстом.
export const MIN_SETS = 1
export const MAX_SETS = 20
export const MAX_REPS = 200

// Значение поля ввода -> значение в стейте: '' остаётся '', остальное — число.
export function countFromInput(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return ''
  const value = Number(text)
  return Number.isFinite(value) ? value : ''
}

// Меняет одно поле пункта. При смене targetReps старая верхняя граница
// диапазона больше ничего не значит («8-10» -> человек вписал 12): если её
// оставить, план показал бы «12-10». Убираем её целиком.
export function editItemField(item, field, raw) {
  const next = { ...item, [field]: countFromInput(raw) }
  if (field === 'targetReps') delete next.targetRepsMax
  return next
}

function fallbackName(item, index) {
  return item.exerciseName || `упражнение №${index + 1}`
}

// Приводит пункты к числам перед сохранением. Возвращает либо { items },
// либо { error } с первой найденной ошибкой — её показываем человеку.
// 0 повторов допустим: это «до отказа». Подходов — не меньше одного.
export function normalizePlanItems(items, nameOf = fallbackName) {
  const result = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const name = nameOf(item, i)
    const sets = item.targetSets === '' || item.targetSets == null ? NaN : Number(item.targetSets)
    const reps = item.targetReps === '' || item.targetReps == null ? NaN : Number(item.targetReps)

    if (!Number.isInteger(sets) || sets < MIN_SETS || sets > MAX_SETS) {
      return { error: `${name}: подходов должно быть от ${MIN_SETS} до ${MAX_SETS}` }
    }
    if (!Number.isInteger(reps) || reps < 0 || reps > MAX_REPS) {
      return { error: `${name}: повторов должно быть от 0 до ${MAX_REPS} (0 — до отказа)` }
    }

    const next = { ...item, targetSets: sets, targetReps: reps }
    delete next.targetRepsMax
    const max = Number(item.targetRepsMax)
    // Верхняя граница имеет смысл, только если она выше нижней и в пределах.
    if (reps > 0 && Number.isInteger(max) && max > reps && max <= MAX_REPS) next.targetRepsMax = max
    result.push(next)
  }
  return { items: result }
}
