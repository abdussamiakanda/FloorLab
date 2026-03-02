import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './config'

const userDocRef = (uid) => doc(db, 'users', uid)
const floorplansColRef = () => collection(db, 'floorplans')
const floorplanDocRef = (planId) => doc(db, 'floorplans', planId)

export const ensureUserProfile = async (user) => {
  if (!user?.uid) {
    return
  }

  await setDoc(
    userDocRef(user.uid),
    {
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export const listFloorPlans = async () => {
  const floorplansQuery = query(floorplansColRef(), orderBy('updatedAt', 'desc'))
  const snapshot = await getDocs(floorplansQuery)

  return snapshot.docs.map((planDoc) => ({
    id: planDoc.id,
    ...planDoc.data(),
  }))
}

export const createFloorPlan = async (uid, name = 'Untitled Plan', userDisplayName = '') => {
  const created = await addDoc(floorplansColRef(), {
    name,
    objects: [],
    createdBy: uid,
    createdByName: userDisplayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return created.id
}

export const getFloorPlan = async (planId) => {
  const snapshot = await getDoc(floorplanDocRef(planId))
  if (!snapshot.exists()) {
    return null
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  }
}

export const updateFloorPlan = async (planId, payload) => {
  console.log('Firestore updateFloorPlan called:', { planId, objectsCount: payload.objects?.length })
  await updateDoc(floorplanDocRef(planId), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
  console.log('Firestore updateFloorPlan completed successfully')
}

export const removeFloorPlan = async (planId) => {
  await deleteDoc(floorplanDocRef(planId))
}
