import { ExternalLink, FileText, Pencil, Trash2 } from 'lucide-react'

function FloorPlanList({ plans, plansLoaded, onOpen, onRename, onDelete }) {
  if (!plansLoaded) {
    return (
      <ul className="loading-list-skeletons" role="status" aria-label="Loading floor plans">
        {[1, 2, 3, 4].map((i) => (
          <li key={i} className="skeleton-item" aria-hidden />
        ))}
      </ul>
    )
  }
  if (!plans.length) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon" aria-hidden><FileText size={20} /></span>
        <p>No floor plans yet. Create your first one.</p>
      </div>
    )
  }

  return (
    <ul className="plan-list">
      {plans.map((plan) => (
        <li key={plan.id} className="plan-item">
          <div className="plan-info">
            <h3>{plan.name}</h3>
            {plan.createdByName && (
              <span className="plan-creator">{plan.createdByName}</span>
            )}
          </div>
          <div className="plan-actions">
            <button type="button" className="open-btn" onClick={() => onOpen(plan.id)}>
              <span className="btn-icon" aria-hidden><ExternalLink size={20} /></span>
              Open
            </button>
            <button type="button" className="rename-btn" onClick={() => onRename(plan)}>
              <span className="btn-icon" aria-hidden><Pencil size={20} /></span>
              Rename
            </button>
            <button type="button" className="delete-btn" onClick={() => onDelete(plan.id)}>
              <span className="btn-icon" aria-hidden><Trash2 size={20} /></span>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default FloorPlanList
