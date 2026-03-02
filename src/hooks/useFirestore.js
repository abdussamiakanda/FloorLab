import { useCallback, useState } from 'react'
import {
  createFloorPlan,
  getFloorPlan,
  listFloorPlans,
  removeFloorPlan,
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
        return await operation(user.uid)
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
    fetchFloorPlans: () => withGuard(() => listFloorPlans()),
    createPlan: (name) => withGuard((uid) => createFloorPlan(uid, name, user?.displayName)),
    fetchPlanById: (planId) => withGuard(() => getFloorPlan(planId)),
    savePlan: (planId, payload) => withGuard(() => updateFloorPlan(planId, payload)),
    deletePlan: (planId) => withGuard(() => removeFloorPlan(planId)),
  }
}
