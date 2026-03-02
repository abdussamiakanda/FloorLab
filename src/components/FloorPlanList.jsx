import { useState, useRef, useEffect } from 'react'
import { FileText, MoreVertical, Pencil, Trash2, Share2 } from 'lucide-react'

function FloorPlanList({ plans, plansLoaded, user, onOpen, onRename, onDelete, onShareClick }) {
  const [openMenuId, setOpenMenuId] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const getRole = (plan) => {
    if (!user?.uid) return 'viewer'
    if (plan.createdBy === user.uid) return 'owner'
    const email = (user.email || '').toLowerCase()
    return plan.collaborators?.[email] ?? 'viewer'
  }

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
      {plans.map((plan) => {
        const role = getRole(plan)
        const canRename = role === 'owner' || role === 'editor'
        const canDelete = role === 'owner'
        const canShare = role === 'owner'
        const menuOpen = openMenuId === plan.id

        return (
          <li key={plan.id} className="plan-item">
            <div
              className="plan-item-clickable"
              onClick={() => onOpen(plan.id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(plan.id)}
              role="button"
              tabIndex={0}
              aria-label={`Open ${plan.name}`}
            >
              <div className="plan-info">
                <h3>{plan.name}</h3>
                {plan.createdByName && (
                  <span className="plan-creator">{plan.createdByName}</span>
                )}
                {role !== 'owner' && (
                  <span className="plan-role-badge">
                    {role === 'editor' ? 'Can edit' : 'Can view'}
                  </span>
                )}
              </div>
              <div className="plan-item-actions" ref={menuRef}>
                <button
                  type="button"
                  className="plan-menu-trigger"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(menuOpen ? null : plan.id)
                  }}
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  aria-label="Plan options"
                >
                  <MoreVertical size={20} />
                </button>
                {menuOpen && (
                  <div className="plan-dropdown">
                    {canRename && (
                      <button
                        type="button"
                        className="plan-dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          onRename(plan)
                        }}
                      >
                        <Pencil size={16} />
                        Rename
                      </button>
                    )}
                    {canShare && (
                      <button
                        type="button"
                        className="plan-dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          onShareClick(plan)
                        }}
                      >
                        <Share2 size={16} />
                        Share
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="plan-dropdown-item plan-dropdown-item-danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          onDelete(plan.id)
                        }}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default FloorPlanList
