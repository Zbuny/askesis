// Выдать права админа по email. Из клиента это невозможно: settings/admins
// закрыт правилами (allow write: if false), а Admin SDK правила не проверяет.
//
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   GCLOUD_PROJECT=askesis-web node grantAdmin.js you@mail.com
const admin = require('firebase-admin')

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID })
const db = admin.firestore()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Укажите email: node grantAdmin.js you@mail.com')
    process.exit(1)
  }

  const user = await admin.auth().getUserByEmail(email).catch(() => null)
  if (!user) {
    console.error(`Пользователь с email ${email} не найден. Сначала зарегистрируйтесь на сайте.`)
    process.exit(1)
  }

  const ref = db.collection('settings').doc('admins')
  const snap = await ref.get()
  const uids = snap.exists ? snap.data().uids || [] : []

  if (uids.includes(user.uid)) {
    console.log(`${email} уже админ (uid ${user.uid}).`)
    process.exit(0)
  }

  await ref.set({ uids: [...uids, user.uid] }, { merge: true })
  console.log(`✓ ${email} (uid ${user.uid}) добавлен в админы. Всего админов: ${uids.length + 1}`)
  console.log('Перезагрузите страницу сайта — появится раздел «Админка».')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
