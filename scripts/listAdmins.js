// Показать, у кого сейчас права админа. Только чтение.
//
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   GCLOUD_PROJECT=askesis-web node listAdmins.js
const admin = require('firebase-admin')

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID })
const db = admin.firestore()

async function main() {
  const snap = await db.collection('settings').doc('admins').get()
  const uids = snap.exists ? snap.data().uids || [] : []

  if (uids.length === 0) {
    console.log('Админов нет. Выдать: node grantAdmin.js you@mail.com')
    process.exit(0)
  }

  console.log(`Админов: ${uids.length}`)
  for (const uid of uids) {
    const user = await admin.auth().getUser(uid).catch(() => null)
    console.log(`  ${uid}  ${user ? `— ${user.email || 'без email'}${user.displayName ? ` (${user.displayName})` : ''}` : '— пользователь удалён'}`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
