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
