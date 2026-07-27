const admin = require('firebase-admin')

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-askesis'
admin.initializeApp({ projectId })
const db = admin.firestore()

// Названия упражнений — точные строки из библиотеки Free Exercise DB (уже в Firestore).
const PROGRAMS = [
  {
    id: 'full-body-beginner',
    title: 'Full Body — с нуля',
    level: 'Начинающий',
    duration: '4 недели · 3 тренировки в неделю',
    description:
      'Базовый комплекс на всё тело для тех, кто только начинает выстраивать дисциплину: простые движения, растущая нагрузка.',
    exerciseNames: [
      'Bodyweight Squat',
      'Pushups',
      'One-Arm Dumbbell Row',
      'Dumbbell Shoulder Press',
      'Dumbbell Lunges',
      'Plank',
      'Superman',
    ],
  },
  {
    id: 'push-pull-legs',
    title: 'Push / Pull / Legs',
    level: 'Средний',
    duration: '6 недель · 3 тренировки в неделю',
    description: 'Классический трёхдневный сплит: жим, тяга, ноги — на силу и объём.',
    exerciseNames: [
      'Barbell Bench Press - Medium Grip',
      'Standing Military Press',
      'Incline Dumbbell Press',
      'Triceps Pushdown',
      'Bent Over Barbell Row',
      'Wide-Grip Lat Pulldown',
      'Barbell Curl',
      'Face Pull',
      'Barbell Squat',
      'Romanian Deadlift',
      'Leg Press',
      'Standing Barbell Calf Raise',
    ],
  },
  {
    id: '5x5-strength',
    title: '5×5 Сила',
    level: 'Продвинутый',
    duration: '8 недель · 3 тренировки в неделю',
    description: 'Пять базовых движений, пять подходов — программа на чистый силовой прогресс без лишнего объёма.',
    exerciseNames: [
      'Barbell Squat',
      'Barbell Bench Press - Medium Grip',
      'Barbell Deadlift',
      'Standing Military Press',
      'Bent Over Barbell Row',
    ],
  },
  {
    id: 'upper-lower-split',
    title: 'Верх / Низ',
    level: 'Средний',
    duration: '6 недель · 4 тренировки в неделю',
    description: 'Четырёхдневный сплит: два дня на верх тела, два — на низ, с акцентом на контроль нагрузки.',
    exerciseNames: [
      'Dumbbell Bench Press',
      'Seated Cable Rows',
      'Dumbbell Shoulder Press',
      'Barbell Curl',
      'Triceps Pushdown',
      'Barbell Squat',
      'Romanian Deadlift',
      'Leg Press',
      'Barbell Hip Thrust',
      'Standing Barbell Calf Raise',
    ],
  },
  {
    id: 'home-bodyweight',
    title: 'Дома без инвентаря',
    level: 'Начинающий',
    duration: '4 недели · 3 тренировки в неделю',
    description: 'Комплекс на собственном весе — без зала и оборудования, для тренировок в любых условиях.',
    exerciseNames: [
      'Pushups',
      'Bodyweight Squat',
      'Plank',
      'Mountain Climbers',
      'Superman',
      'Russian Twist',
      'Glute Kickback',
    ],
  },
]

async function findExerciseId(name) {
  const snap = await db.collection('exercises').where('name', '==', name).limit(1).get()
  if (snap.empty) return null
  return snap.docs[0].id
}

async function main() {
  console.log(`Проект: ${projectId}${process.env.FIRESTORE_EMULATOR_HOST ? ` (эмулятор ${process.env.FIRESTORE_EMULATOR_HOST})` : ''}`)

  for (const program of PROGRAMS) {
    const exerciseIds = []
    for (const name of program.exerciseNames) {
      const id = await findExerciseId(name)
      if (id) {
        exerciseIds.push(id)
      } else {
        console.warn(`  ! Упражнение не найдено в базе, пропускаю: "${name}" (программа "${program.title}")`)
      }
    }

    await db
      .collection('programs')
      .doc(program.id)
      .set(
        {
          title: program.title,
          level: program.level,
          duration: program.duration,
          description: program.description,
          exerciseIds,
          createdAt: new Date().toISOString(),
        },
        { merge: true },
      )

    console.log(`✓ ${program.title} — ${exerciseIds.length}/${program.exerciseNames.length} упражнений найдено`)
  }

  console.log(`Готово: записано ${PROGRAMS.length} программ.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Не удалось создать программы:', err)
  process.exit(1)
})
