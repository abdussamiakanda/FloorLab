import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { fire as SwalFire } from '../utils/swalWithLucide'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import FloorPlanList from './FloorPlanList'
import ShareModal from './ShareModal'
import { Plus } from 'lucide-react'

function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    fetchFloorPlans,
    createPlan,
    savePlan,
    deletePlan,
    sharePlan,
    removeCollaborator,
    fetchPlanById,
    loading,
    error,
  } = useFirestore()
  const [plans, setPlans] = useState([])
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [sharePlanData, setSharePlanData] = useState(null)

  const loadPlans = useCallback(async () => {
    try {
      const result = await fetchFloorPlans()
      setPlans(result ?? [])
    } finally {
      setPlansLoaded(true)
    }
  }, [fetchFloorPlans])

  useEffect(() => {
    loadPlans()
  }, [])

  const handleCreate = async () => {
    const id = await createPlan(`Floor Plan ${plans.length + 1}`)
    navigate(`/editor/${id}`)
  }

  const handleOpen = (planId) => {
    navigate(`/editor/${planId}`)
  }

  const handleRename = async (plan) => {
    const result = await SwalFire({
      title: 'Rename Floor Plan',
      input: 'text',
      inputValue: plan.name,
      inputPlaceholder: 'Enter new name',
      showCancelButton: true,
      confirmButtonColor: '#064e3b',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Rename',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal-container',
        popup: 'swal-popup',
        title: 'swal-title',
        input: 'swal-input',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn',
      },
      inputValidator: (value) => {
        if (!value) {
          return 'Floor plan name cannot be empty'
        }
        if (value.trim() === plan.name) {
          return 'Please enter a different name'
        }
        return null
      },
    })

    if (result.isConfirmed && result.value) {
      SwalFire({
        title: 'Saving…',
        allowOutsideClick: false,
        customClass: { container: 'swal-container', popup: 'swal-popup' },
        didOpen: () => Swal.showLoading(),
      })
      await savePlan(plan.id, { name: result.value.trim() })
      await SwalFire({
        title: 'Success!',
        text: 'Floor plan renamed successfully',
        icon: 'success',
        confirmButtonColor: '#064e3b',
        customClass: {
          container: 'swal-container',
          popup: 'swal-popup',
          title: 'swal-title',
          htmlContainer: 'swal-text',
          confirmButton: 'swal-confirm-btn',
        },
      })
      loadPlans()
    }
  }

  const handleDelete = async (planId) => {
    const result = await SwalFire({
      title: 'Delete Floor Plan',
      text: 'This action cannot be undone. Are you sure?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal-container',
        popup: 'swal-popup',
        title: 'swal-title',
        htmlContainer: 'swal-text',
        confirmButton: 'swal-delete-btn',
        cancelButton: 'swal-cancel-btn',
      },
    })

    if (result.isConfirmed) {
      SwalFire({
        title: 'Deleting…',
        allowOutsideClick: false,
        customClass: { container: 'swal-container', popup: 'swal-popup' },
        didOpen: () => Swal.showLoading(),
      })
      await deletePlan(planId)
      await SwalFire({
        title: 'Deleted!',
        text: 'Floor plan deleted successfully',
        icon: 'success',
        confirmButtonColor: '#064e3b',
        customClass: {
          container: 'swal-container',
          popup: 'swal-popup',
          title: 'swal-title',
          htmlContainer: 'swal-text',
          confirmButton: 'swal-confirm-btn',
        },
      })
      loadPlans()
    }
  }

  const handleShareClick = (plan) => {
    setSharePlanData(plan)
  }

  const handleShareModalClose = () => {
    setSharePlanData(null)
  }

  const handlePlanUpdated = useCallback(
    async (planId) => {
      const updated = await fetchPlanById(planId)
      if (updated) setSharePlanData(updated)
    },
    [fetchPlanById],
  )

  return (
    <section className="dashboard">
      <div className="dashboard-head">
        <h1>All Floor Plans</h1>
        <button type="button" onClick={handleCreate} disabled={loading} className="btn-new-plan">
          <span className="btn-icon" aria-hidden><Plus size={20} /></span>
          New Floor Plan
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <FloorPlanList
        plans={plans}
        plansLoaded={plansLoaded}
        user={user}
        onOpen={handleOpen}
        onRename={handleRename}
        onDelete={handleDelete}
        onShareClick={handleShareClick}
      />

      {sharePlanData && (
        <ShareModal
          plan={sharePlanData}
          currentUserUid={user?.uid}
          currentUserEmail={user?.email}
          onShare={sharePlan}
          onRemoveCollaborator={removeCollaborator}
          onPlanUpdated={handlePlanUpdated}
          onClose={handleShareModalClose}
        />
      )}
    </section>
  )
}

export default Dashboard
