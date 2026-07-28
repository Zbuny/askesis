// Отозвать права админа по email.
//
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   GCLOUD_PROJECT=askesis-web node revokeAdmin.js someone@example.com
const admin = require('firebase-admin')

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID })
const db = admin.firestore()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Укажите email: node revokeAdmin.js someone@example.com')
    process.exit(1)
  }

  const user = await admin.auth().getUserByEmail(email).catch(() => null)
  if (!user) {
    console.error(`Пользователь с email ${email} не найден.`)
    process.exit(1)
  }

  const ref = db.collection('settings').doc('admins')
  const snap = await ref.get()
  const uids = snap.exists ? snap.data().uids || [] : []

  if (!uids.includes(user.uid)) {
    console.log(`${email} и так не админ.`)
    process.exit(0)
  }

  await ref.set({ uids: uids.filter((uid) => uid !== user.uid) }, { merge: true })
  console.log(`✓ ${email} (uid ${user.uid}) удалён из админов. Осталось: ${uids.length - 1}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
