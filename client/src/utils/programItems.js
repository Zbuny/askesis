// Программы, созданные до появления подходов/повторов, хранят только
// exerciseIds — расширяем их значениями по умолчанию, пока админ не
// отредактирует и не сохранит программу в новом формате.
export function programItems(program) {
  if (program.items && program.items.length) return program.items
  return (program.exerciseIds || []).map((exerciseId) => ({
    exerciseId,
    targetSets: 3,
    targetReps: 10,
  }))
}
