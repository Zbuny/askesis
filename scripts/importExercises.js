const admin = require('firebase-admin')

const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-askesis'
admin.initializeApp({ projectId })
const db = admin.firestore()

async function main() {
  console.log(`Проект: ${projectId}${process.env.FIRESTORE_EMULATOR_HOST ? ` (эмулятор ${process.env.FIRESTORE_EMULATOR_HOST})` : ''}`)
  console.log('Скачиваю датасет упражнений (Free Exercise DB)...')

  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`Не удалось скачать датасет: ${res.status}`)
  const exercises = await res.json()
  console.log(`Найдено ${exercises.length} упражнений, импортирую в Firestore...`)

  let batch = db.batch()
  let opsInBatch = 0
  let total = 0

  for (const ex of exercises) {
    const ref = db.collection('exercises').doc(ex.id)
    batch.set(
      ref,
      {
        name: ex.name,
        muscleGroup: ex.primaryMuscles?.[0] || null,
        secondaryMuscles: ex.secondaryMuscles || [],
        equipment: ex.equipment || null,
        level: ex.level || null,
        category: ex.category || null,
        instructions: (ex.instructions || []).join('\n'),
        imageUrl: ex.images?.[0] ? IMAGE_BASE + ex.images[0] : null,
        // Оба кадра движения: клиент крутит их по кругу вместо гифки.
        imageUrls: (ex.images || []).map((path) => IMAGE_BASE + path),
        source: 'free-exercise-db',
      },
      { merge: true },
    )

    opsInBatch += 1
    total += 1

    if (opsInBatch === 450) {
      await batch.commit()
      batch = db.batch()
      opsInBatch = 0
      console.log(`  ...${total} записано`)
    }
  }

  if (opsInBatch > 0) await batch.commit()

  console.log(`Готово: импортировано ${total} упражнений.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Импорт не удался:', err)
  process.exit(1)
})
