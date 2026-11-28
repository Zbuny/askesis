import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { app } from './firebase.js'

// Отдельно от firebase.js специально: всё, что импортирует этот модуль,
// затягивает за собой Firestore SDK (~330 kB). Импортировать его можно только
// оттуда, где данные действительно нужны, — то есть из ленивых страниц, а не
// из общих провайдеров.
export const db = getFirestore(app)

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080)
}
