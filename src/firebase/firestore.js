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
  where,
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

export const listFloorPlans = async (uid, userEmail) => {
  const ownedQuery = query(
    floorplansColRef(),
    where('createdBy', '==', uid),
    orderBy('updatedAt', 'desc')
  )
  const sharedQuery = query(
    floorplansColRef(),
    where('collaboratorEmails', 'array-contains', userEmail),
    orderBy('updatedAt', 'desc')
  )

  const [ownedSnap, sharedSnap] = await Promise.all([
    getDocs(ownedQuery),
    getDocs(sharedQuery),
  ])

  const byId = new Map()
  ownedSnap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }))
  sharedSnap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }))

  return Array.from(byId.values()).sort(
    (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
  )
}

export const createFloorPlan = async (uid, name = 'Untitled Plan', userDisplayName = '', ownerEmail = '') => {
  const created = await addDoc(floorplansColRef(), {
    name,
    objects: [],
    createdBy: uid,
    createdByName: userDisplayName,
    ownerEmail: ownerEmail || null,
    collaborators: {},
    collaboratorEmails: [],
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

export const shareFloorPlan = async (planId, email, role) => {
  const normalizedEmail = (email || '').trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Email is required.')

  const planRef = floorplanDocRef(planId)
  const snap = await getDoc(planRef)
  if (!snap.exists()) throw new Error('Plan not found.')

  const data = snap.data()
  const collaborators = { ...(data.collaborators || {}) }
  const collaboratorEmails = [...(data.collaboratorEmails || [])]

  if (collaborators[normalizedEmail]) {
    collaborators[normalizedEmail] = role
  } else {
    collaborators[normalizedEmail] = role
    if (!collaboratorEmails.includes(normalizedEmail)) {
      collaboratorEmails.push(normalizedEmail)
    }
  }

  await updateDoc(planRef, {
    collaborators,
    collaboratorEmails,
    updatedAt: serverTimestamp(),
  })
}

export const removeCollaborator = async (planId, email) => {
  const normalizedEmail = (email || '').trim().toLowerCase()
  const planRef = floorplanDocRef(planId)
  const snap = await getDoc(planRef)
  if (!snap.exists()) throw new Error('Plan not found.')

  const data = snap.data()
  const collaborators = { ...(data.collaborators || {}) }
  const collaboratorEmails = (data.collaboratorEmails || []).filter((e) => e !== normalizedEmail)
  delete collaborators[normalizedEmail]

  await updateDoc(planRef, {
    collaborators,
    collaboratorEmails,
    updatedAt: serverTimestamp(),
  })
}
