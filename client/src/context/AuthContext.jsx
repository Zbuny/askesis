import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth'
import { auth } from '../firebase.js'

const AuthContext = createContext(null)

// Провайдер монтируется на каждой странице, включая главную и вход, где
// Firestore не нужен. Статический импорт затащил бы его SDK в стартовый
// бандл, поэтому тянем модуль динамически — только когда есть кого проверять.
async function checkIsAdmin(uid) {
  const [{ doc, getDoc }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('../db.js'),
  ])
  try {
    const snap = await getDoc(doc(db, 'settings', 'admins'))
    return snap.exists() && (snap.data().uids || []).includes(uid)
  } catch {
    // Правила пускают на чтение этого документа только тех, кто уже в
    // списке — обычному пользователю придёт permission-denied, и это
    // ожидаемое «не админ», а не сбой.
    return false
  }
}

// Firebase восстанавливает сессию асинхронно — около секунды на холодном
// старте. Главная в это время не знает, гость перед ней или нет: показать
// витрину — вошедший увидит, как она мелькает перед обзором; показать пустоту —
// гость секунду смотрит на чёрный экран. Подсказка в localStorage решает
// это без ожидания: гость сразу получает витрину, а пустую паузу видит только
// тот, кто в этом браузере уже входил. Это лишь подсказка — права по-прежнему
// решает Firebase, и при ошибке хранилища всё работает как раньше.
const SESSION_HINT_KEY = 'askesis:had-session'

function rememberSession(signedIn) {
  try {
    if (signedIn) localStorage.setItem(SESSION_HINT_KEY, '1')
    else localStorage.removeItem(SESSION_HINT_KEY)
  } catch {
    // приватный режим или запрет хранилища — подсказки просто не будет
  }
}

export function hadSession() {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1'
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      rememberSession(Boolean(firebaseUser))
      setUser(firebaseUser)
      setIsAdmin(firebaseUser ? await checkIsAdmin(firebaseUser.uid) : false)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = useCallback((email, password) => signInWithEmailAndPassword(auth, email, password), [])

  const register = useCallback(async (name, email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    if (name) await updateProfile(credential.user, { displayName: name })
    return credential
  }, [])

  const loginWithGoogle = useCallback(() => signInWithPopup(auth, new GoogleAuthProvider()), [])

  const logout = useCallback(() => firebaseSignOut(auth), [])

  const resetPassword = useCallback((email) => sendPasswordResetEmail(auth, email), [])

  const verifyEmail = useCallback(() => {
    if (!auth.currentUser) throw new Error('Требуется авторизация')
    return sendEmailVerification(auth.currentUser)
  }, [])

  // Подтверждение почты происходит вне приложения — в почтовом клиенте, а то
  // и на другом устройстве. onAuthStateChanged об этом не узнает, и объект
  // пользователя в контексте остаётся с прежним emailVerified до следующего
  // входа. reload() перечитывает его с сервера; возвращаем сам флаг, а не
  // кладём в состояние: reload меняет объект на месте, ссылка остаётся той
  // же, и перерисовки от setUser всё равно не будет.
  const refreshEmailVerified = useCallback(async () => {
    if (!auth.currentUser) return false
    await auth.currentUser.reload()
    return auth.currentUser.emailVerified
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
        verifyEmail,
        refreshEmailVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
