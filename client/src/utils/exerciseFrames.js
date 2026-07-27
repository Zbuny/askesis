// Кадры движения для одного упражнения.
//
// Новые импорты пишут в Firestore оба кадра в поле imageUrls. У записей,
// залитых раньше, есть только imageUrl — второй кадр достраиваем из первого:
// в Free Exercise DB картинки всегда лежат парой `<id>/0.jpg` и `<id>/1.jpg`
// (проверено — так у всех 873 упражнений датасета). Если второй кадр всё же
// не отдастся, ExerciseAnimation откатится на статичную картинку.
export function exerciseFrames(exercise) {
  if (!exercise) return []

  if (Array.isArray(exercise.imageUrls) && exercise.imageUrls.length > 0) {
    return exercise.imageUrls
  }

  const first = exercise.imageUrl
  if (!first) return []

  const second = first.replace(/\/0(\.[a-z]+)$/i, '/1$1')
  return second === first ? [first] : [first, second]
}
