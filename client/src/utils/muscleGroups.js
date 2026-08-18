// Разделы библиотеки упражнений.
//
// В каталоге 17 групп мышц, и плоским списком они бесполезны: между
// «абдукторами» и «трапециями» человек не выбирает. Но и сводить их в
// «жимовые/тяговые» неправильно — это паттерн движения, а не часть тела, и
// поясница с прессом оказываются в одной куче «корпуса», хотя тренируются
// по-разному и в разные дни.
//
// Поэтому делим анатомически, как человек и думает о теле: спина — это и
// широчайшие, и трапеции, и поясница; пресс живёт отдельно. Раздел — не поле
// в базе, а список групп мышц, так что менять его можно здесь и не трогать
// ни одного документа.

export const BODY_PARTS = [
  { key: 'chest', label: 'Грудь', muscles: ['chest'] },
  { key: 'back', label: 'Спина', muscles: ['lats', 'middle back', 'traps', 'lower back'] },
  { key: 'shoulders', label: 'Плечи', muscles: ['shoulders'] },
  { key: 'arms', label: 'Руки', muscles: ['biceps', 'triceps', 'forearms'] },
  {
    key: 'legs',
    label: 'Ноги',
    muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  },
  { key: 'abs', label: 'Пресс', muscles: ['abdominals'] },
  { key: 'neck', label: 'Шея', muscles: ['neck'] },
]

export function bodyPartOf(muscleGroup) {
  return BODY_PARTS.find((part) => part.muscles.includes(muscleGroup)) || null
}

// Картинку для группы мышц берём у первого её упражнения по алфавиту.
// Именно по алфавиту, а не «любое»: иначе обложка раздела менялась бы от
// загрузки к загрузке вслед за порядком документов.
function coverFor(exercises) {
  const withImage = exercises.filter((ex) => ex?.imageUrl)
  if (withImage.length === 0) return null
  return [...withImage].sort((a, b) => String(a.id).localeCompare(String(b.id)))[0].imageUrl
}

// Разделы с числом упражнений и обложкой у каждой группы мышц. Считаем по
// тому, что реально пришло с сервера: пустые разделы показывать незачем.
export function bodyPartSections(exercises = []) {
  const byMuscle = new Map()
  exercises.forEach((ex) => {
    if (!ex?.muscleGroup) return
    if (!byMuscle.has(ex.muscleGroup)) byMuscle.set(ex.muscleGroup, [])
    byMuscle.get(ex.muscleGroup).push(ex)
  })

  return BODY_PARTS.map((part) => {
    const muscles = part.muscles
      .map((key) => {
        const list = byMuscle.get(key) || []
        return { key, count: list.length, cover: coverFor(list) }
      })
      .filter((muscle) => muscle.count > 0)
      // Внутри раздела — от больших групп к меньшим: то, чего много, ищут чаще.
      .sort((a, b) => b.count - a.count)

    return { ...part, muscles, count: muscles.reduce((sum, m) => sum + m.count, 0) }
  }).filter((part) => part.count > 0)
}
