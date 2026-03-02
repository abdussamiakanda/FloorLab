import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { fire as SwalFire } from '../utils/swalWithLucide'
import { useFirestore } from '../hooks/useFirestore'
import FloorPlanList from './FloorPlanList'
import { Plus } from 'lucide-react'

function Dashboard() {
  const navigate = useNavigate()
  const { fetchFloorPlans, createPlan, savePlan, deletePlan, loading, error } = useFirestore()
  const [plans, setPlans] = useState([])
  const [plansLoaded, setPlansLoaded] = useState(false)

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

      <FloorPlanList plans={plans} plansLoaded={plansLoaded} onOpen={handleOpen} onRename={handleRename} onDelete={handleDelete} />
    </section>
  )
}

export default Dashboard
