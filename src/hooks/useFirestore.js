import { useCallback, useState } from 'react'
import {
  createFloorPlan,
  getFloorPlan,
  listFloorPlans,
  removeFloorPlan,
  removeCollaborator,
  shareFloorPlan,
  updateFloorPlan,
} from '../firebase/firestore'
import { useAuth } from '../context/AuthContext'

export function useFirestore() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const withGuard = useCallback(
    async (operation) => {
      if (!user?.uid) {
        throw new Error('You must be signed in to perform this action.')
      }

      setLoading(true)
      setError('')

      try {
        return await operation(user)
      } catch (operationError) {
        setError(operationError.message || 'An unexpected Firestore error occurred.')
        throw operationError
      } finally {
        setLoading(false)
      }
    },
    [user?.uid],
  )

  return {
    loading,
    error,
    fetchFloorPlans: () =>
      withGuard((u) =>
        listFloorPlans(u.uid, (u.email || '').trim().toLowerCase()),
      ),
    createPlan: (name) =>
      withGuard((u) =>
        createFloorPlan(u.uid, name, u.displayName ?? '', u.email ?? ''),
      ),
    fetchPlanById: (planId) => withGuard(() => getFloorPlan(planId)),
    savePlan: (planId, payload) => withGuard(() => updateFloorPlan(planId, payload)),
    deletePlan: (planId) => withGuard(() => removeFloorPlan(planId)),
    sharePlan: (planId, email, role) =>
      withGuard(() => shareFloorPlan(planId, email, role)),
    removeCollaborator: (planId, email) =>
      withGuard(() => removeCollaborator(planId, email)),
  }
}
