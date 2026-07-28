const admin = require('firebase-admin')

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-askesis'
admin.initializeApp({ projectId })
const db = admin.firestore()

// Личный сплит на 4 дня. Названия слева — точные строки из Free Exercise DB,
// reps — нижняя граница, repsMax — верхняя (0 повторов = «до отказа»).
const PROGRAMS = [
  {
    id: 'split-arms-day',
    title: 'День рук',
    level: 'Средний',
    duration: '1 тренировка · руки',
    description: 'Бицепс и трицепс в один день: сгибания на разных углах, затем жим узким хватом и добивка на блоке.',
    items: [
      { name: 'Dumbbell Bicep Curl', sets: 3, reps: 10 },
      { name: 'Cable Hammer Curls - Rope Attachment', sets: 2, reps: 8 },
      { name: 'EZ-Bar Curl', sets: 2, reps: 10 },
      { name: 'Seated Triceps Press', sets: 4, reps: 8, repsMax: 10 },
      { name: 'Close-Grip Barbell Bench Press', sets: 3, reps: 10 },
      { name: 'Triceps Pushdown - Rope Attachment', sets: 3, reps: 8, repsMax: 10 },
    ],
  },
  {
    id: 'split-legs-day',
    title: 'День ног',
    level: 'Средний',
    duration: '1 тренировка · ноги',
    description: 'Начинаем с изоляции на бицепс бедра и квадрицепс, потом присед и жим ногами, добивка на икры.',
    items: [
      { name: 'Lying Leg Curls', sets: 3, reps: 12, repsMax: 15 },
      { name: 'Leg Extensions', sets: 4, reps: 10, repsMax: 12 },
      { name: 'Barbell Squat', sets: 3, reps: 8 },
      { name: 'Leg Press', sets: 4, reps: 10, repsMax: 12 },
      { name: 'Standing Calf Raises', sets: 4, reps: 8 },
    ],
  },
  {
    id: 'split-chest-day',
    title: 'День груди',
    level: 'Средний',
    duration: '1 тренировка · грудь',
    description: 'Жимовая база в Смите и с гантелями, затем сведения на разной высоте для растяжения грудных.',
    items: [
      { name: 'Dumbbell Bench Press', sets: 3, reps: 12, repsMax: 15 },
      { name: 'Smith Machine Bench Press', sets: 4, reps: 8, repsMax: 10 },
      { name: 'Butterfly', sets: 3, reps: 12, repsMax: 15 },
      { name: 'Cable Crossover', sets: 3, reps: 8 },
    ],
  },
  {
    id: 'split-back-day',
    title: 'День спины',
    level: 'Средний',
    duration: '1 тренировка · спина',
    description: 'Вертикальная и горизонтальная тяга в связке: сначала ширина, потом толщина, в конце — работа до отказа.',
    items: [
      { name: 'Wide-Grip Lat Pulldown', sets: 4, reps: 8, repsMax: 12 },
      { name: 'Lying T-Bar Row', sets: 4, reps: 8, repsMax: 12 },
      { name: 'One-Arm Dumbbell Row', sets: 4, reps: 10 },
      { name: 'Bent Over Barbell Row', sets: 3, reps: 8 },
      { name: 'Seated Cable Rows', sets: 2, reps: 0 }, // до отказа
    ],
  },
]

async function findExerciseId(name) {
  const snap = await db.collection('exercises').where('name', '==', name).limit(1).get()
  return snap.empty ? null : snap.docs[0].id
}

async function main() {
  console.log(`Проект: ${projectId}`)
  let missing = 0

  for (const program of PROGRAMS) {
    const items = []
    for (const item of program.items) {
      const id = await findExerciseId(item.name)
      if (!id) {
        console.warn(`  ! не найдено: "${item.name}" (${program.title})`)
        missing += 1
        continue
      }
      items.push({
        exerciseId: id,
        targetSets: item.sets,
        targetReps: item.reps,
        ...(item.repsMax ? { targetRepsMax: item.repsMax } : {}),
      })
    }

    await db.collection('programs').doc(program.id).set(
      {
        title: program.title,
        level: program.level,
        duration: program.duration,
        description: program.description,
        recommended: true,
        items,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    )

    console.log(`✓ ${program.title} — ${items.length}/${program.items.length} упражнений`)
  }

  console.log(missing ? `Готово, но не найдено упражнений: ${missing}` : 'Готово, все упражнения найдены.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Не удалось создать программы:', err)
  process.exit(1)
})
