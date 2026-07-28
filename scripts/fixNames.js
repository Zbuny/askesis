// Точечная правка машинного перевода: «Сидячие кабельные ряды» — это
// калька с Seated Cable Rows, в зале так никто не говорит. Правим только
// те названия, где перевод сбивает с толку.
const admin = require('firebase-admin')

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID })
const db = admin.firestore()

const FIXES = {
  'Cable Hammer Curls - Rope Attachment': 'Молотковые сгибания на блоке с канатом',
  'Triceps Pushdown - Rope Attachment': 'Разгибания на трицепс на блоке с канатом',
  'Seated Triceps Press': 'Французский жим сидя',
  'Butterfly': 'Сведение рук в тренажёре («бабочка»)',
  'Cable Crossover': 'Сведение рук в кроссовере',
  'Wide-Grip Lat Pulldown': 'Тяга верхнего блока широким хватом',
  'Lying T-Bar Row': 'Тяга Т-грифа лёжа на скамье',
  'Seated Cable Rows': 'Тяга нижнего блока сидя',
  'Leg Extensions': 'Разгибания ног сидя',
  'Smith Machine Bench Press': 'Жим лёжа в Смите',
  'Dumbbell Bench Press': 'Жим гантелей лёжа',
  'Standing Calf Raises': 'Подъёмы на носки стоя',
}

async function main() {
  let updated = 0
  for (const [name, nameRu] of Object.entries(FIXES)) {
    const snap = await db.collection('exercises').where('name', '==', name).limit(1).get()
    if (snap.empty) {
      console.warn(`  ! не найдено: ${name}`)
      continue
    }
    const doc = snap.docs[0]
    const before = doc.data().nameRu
    if (before === nameRu) {
      console.log(`= ${name} — уже так`)
      continue
    }
    await doc.ref.update({ nameRu })
    console.log(`✓ ${name}\n    было:  ${before}\n    стало: ${nameRu}`)
    updated += 1
  }
  console.log(`Готово: обновлено ${updated} названий.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
