const admin = require('firebase-admin')

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-askesis'
admin.initializeApp({ projectId })
const db = admin.firestore()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function translateText(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(text)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data[0].map((segment) => segment[0]).join('')
}

async function translateWithRetry(text, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await translateText(text)
    } catch (err) {
      if (attempt === 3) {
        console.warn(`  ! Перевод не удался для "${label}": ${err.message} — оставляю оригинал`)
        return text
      }
      await sleep(600 * attempt)
    }
  }
}

async function main() {
  console.log(`Проект: ${projectId}`)
  const snap = await db.collection('exercises').get()
  const docs = snap.docs
  console.log(`Найдено ${docs.length} упражнений. Перевожу названия и инструкции...`)

  let done = 0
  let translated = 0

  for (const d of docs) {
    const data = d.data()
    done++

    if (data.nameRu) {
      // уже переведено в предыдущем запуске — пропускаем
      continue
    }

    const nameRu = await translateWithRetry(data.name, data.name)
    await sleep(120)

    let instructionsRu = ''
    if (data.instructions) {
      instructionsRu = await translateWithRetry(data.instructions, data.name)
      await sleep(120)
    }

    await d.ref.set({ nameRu, instructionsRu }, { merge: true })
    translated++

    if (done % 25 === 0 || done === docs.length) {
      console.log(`  ...${done}/${docs.length} обработано (${translated} переведено в этом запуске)`)
    }
  }

  console.log(`Готово: обработано ${done} упражнений, переведено заново ${translated}.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Перевод не удался:', err)
  process.exit(1)
})
