import { useState } from 'react'
import { X, UserPlus, Trash2, Copy } from 'lucide-react'

const ROLES = [
  { value: 'editor', label: 'Can edit' },
  { value: 'viewer', label: 'Can view' },
]

function ShareModal({ plan, currentUserUid, currentUserEmail, onShare, onRemoveCollaborator, onPlanUpdated, onClose }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const planUrl = plan?.id ? `${window.location.origin}/editor/${plan.id}` : ''

  const handleCopyLink = async () => {
    if (!planUrl) return
    try {
      await navigator.clipboard.writeText(planUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy link.')
    }
  }

  const collaborators = plan?.collaborators ?? {}
  const collaboratorEmails = Object.entries(collaborators).filter(
    ([e]) => e !== (currentUserEmail || '').toLowerCase()
  )
  const isOwner = plan?.createdBy && currentUserUid && plan.createdBy === currentUserUid

  const handleAdd = async (e) => {
    e.preventDefault()
    const trimmed = (email || '').trim().toLowerCase()
    if (!trimmed) {
      setError('Enter an email address.')
      return
    }
    if (trimmed === (currentUserEmail || '').toLowerCase()) {
      setError('You cannot share with yourself.')
      return
    }
    if (collaborators[trimmed]) {
      setError('This email already has access.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onShare(plan.id, trimmed, role)
      setEmail('')
      setRole('editor')
      onPlanUpdated?.(plan.id)
    } catch (err) {
      setError(err.message || 'Failed to share.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (collabEmail) => {
    if (!isOwner) return
    setSubmitting(true)
    try {
      await onRemoveCollaborator(plan.id, collabEmail)
      onPlanUpdated?.(plan.id)
    } catch (err) {
      setError(err.message || 'Failed to remove.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="share-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2 id="share-modal-title">Share &quot;{plan?.name ?? 'Plan'}&quot;</h2>
          <button type="button" className="share-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="share-modal-body">
          <div className="share-modal-section share-modal-link-section">
            <h3 className="share-modal-section-title">Plan link</h3>
            <div className="share-link-row">
              <input
                type="text"
                readOnly
                value={planUrl}
                className="share-link-input"
                aria-label="Plan URL"
              />
              <button
                type="button"
                className="share-copy-btn"
                onClick={handleCopyLink}
                disabled={!planUrl}
                aria-label="Copy link"
                title="Copy link"
              >
                <Copy size={18} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="share-modal-section">
            <h3 className="share-modal-section-title">People with access</h3>
            <ul className="share-collab-list">
              <li className="share-collab-item share-owner">
                <span className="share-collab-email">
                  {plan?.ownerEmail || '—'}
                  {isOwner && ' (You)'}
                </span>
                <span className="share-collab-role">Owner</span>
              </li>
              {collaboratorEmails.map(([collabEmail, collabRole]) => (
                  <li key={collabEmail} className="share-collab-item">
                    <span className="share-collab-email">{collabEmail}</span>
                    <span className="share-collab-role">
                      {collabRole === 'editor' ? 'Can edit' : 'Can view'}
                    </span>
                    {isOwner && (
                      <button
                        type="button"
                        className="share-remove-btn"
                        onClick={() => handleRemove(collabEmail)}
                        disabled={submitting}
                        aria-label={`Remove ${collabEmail}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>

          {isOwner && (
            <form className="share-modal-form" onSubmit={handleAdd}>
              <h3 className="share-modal-section-title">Add people</h3>
              {error && <p className="share-modal-error">{error}</p>}
              <div className="share-form-row">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="share-email-input"
                  disabled={submitting}
                  aria-label="Email address"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="share-role-select"
                  disabled={submitting}
                  aria-label="Permission"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="share-add-btn" disabled={submitting}>
                  <UserPlus size={18} />
                  Add
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShareModal
