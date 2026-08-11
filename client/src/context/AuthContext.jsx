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
  const snap = await getDoc(doc(db, 'settings', 'admins'))
  return snap.exists() && (snap.data().uids || []).includes(uid)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, loading, login, register, loginWithGoogle, logout, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
