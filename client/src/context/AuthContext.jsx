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
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

const AuthContext = createContext(null)

async function checkIsAdmin(uid) {
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
