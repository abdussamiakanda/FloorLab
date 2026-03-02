import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { signInWithGooglePopup, logout as signOutUser } from '../firebase/auth'
import { auth } from '../firebase/config'
import { ensureUserProfile } from '../firebase/firestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)

      if (nextUser) {
        try {
          await ensureUserProfile(nextUser)
        } catch (profileError) {
          console.error('Failed to create user profile:', profileError)
          console.error('Make sure Firestore security rules are deployed (see firestore.rules file)')
        }
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle: async () => {
        const signedInUser = await signInWithGooglePopup()
        try {
          await ensureUserProfile(signedInUser)
        } catch (profileError) {
          console.error('Failed to create user profile:', profileError)
          console.error('Make sure Firestore security rules are deployed (see firestore.rules file)')
          throw profileError
        }
      },
      logout: signOutUser,
    }),
    [loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
