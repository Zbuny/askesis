// Что показывать вместо статичной картинки упражнения.
//
// Каталог из Free Exercise DB даёт ровно два кадра на упражнение — начало и
// конец движения, — и никакие настройки времени не сделают из них гифку.
// Настоящих анимаций в свободных лицензиях нет: все известные наборы восходят
// к GymVisual, где медиа лицензируется отдельно и платно (см. README).
//
// Поэтому анимация — это данные, а не код: если у упражнения появилось поле
// animationUrl, показываем его как есть (гифку браузер крутит сам), иначе
// работает прежняя перелистовка двух кадров. Так гифки можно докладывать по
// одной, не трогая ни строчки логики.

export function exerciseFrames(exercise) {
  if (!exercise) return []

  if (Array.isArray(exercise.imageUrls) && exercise.imageUrls.length > 0) {
    return exercise.imageUrls
  }

  const first = exercise.imageUrl
  if (!first) return []

  // У записей, залитых до появления imageUrls, есть только первый кадр.
  // В Free Exercise DB картинки всегда лежат парой `<id>/0.jpg` и `<id>/1.jpg`
  // (проверено на всех 873 упражнениях датасета).
  const second = first.replace(/\/0(\.[a-z]+)$/i, '/1$1')
  return second === first ? [first] : [first, second]
}

// Готовая анимация, если она есть. Пустая строка и пробелы считаются
// отсутствием: в админке поле легко очистить не до конца.
export function exerciseAnimationUrl(exercise) {
  const url = typeof exercise?.animationUrl === 'string' ? exercise.animationUrl.trim() : ''
  return url || null
}

// Есть ли вообще что показать. Экраны раньше спрашивали про imageUrl, но с
// появлением animationUrl упражнение может иметь анимацию и не иметь кадров —
// и тогда картинка молча пропадала бы.
export function hasExerciseMedia(exercise) {
  return Boolean(exerciseAnimationUrl(exercise)) || exerciseFrames(exercise).length > 0
}
