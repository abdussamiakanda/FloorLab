import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { auth } from './config'

const provider = new GoogleAuthProvider()

export const signInWithGooglePopup = async () => {
  const credential = await signInWithPopup(auth, provider)
  return credential.user
}

export const logout = () => signOut(auth)
