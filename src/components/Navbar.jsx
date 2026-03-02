import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useMatch } from 'react-router-dom'
import { fire as SwalFire } from '../utils/swalWithLucide'
import { useAuth } from '../context/AuthContext'
import { useEditorNav } from '../context/EditorNavContext'
import { ArrowLeft, LogOut } from 'lucide-react'

function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const editorNav = useEditorNav()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const titleInputRef = useRef(null)
  const dropdownRef = useRef(null)

  const viewer3DMatch = useMatch('/3d/:planId')
  const pathname = location.pathname || ''
  const isEditor = pathname.startsWith('/editor/')
  const isViewer3D = !!viewer3DMatch || pathname.startsWith('/3d/')
  const planId = viewer3DMatch?.params?.planId ?? (pathname.startsWith('/3d/') ? pathname.slice(4).split('/')[0] : undefined)

  const startEditingTitle = () => {
    if (!editorNav) return
    setTitleInput(editorNav.planName || 'Untitled Plan')
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 0)
  }

  const submitTitleEdit = () => {
    if (!editorNav) return
    const name = titleInput.trim() || 'Untitled Plan'
    editorNav.setPlanName(name)
    editorNav.submitPlanName?.(name)
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitTitleEdit()
    }
    if (e.key === 'Escape') {
      setTitleInput(editorNav?.planName || 'Untitled Plan')
      setEditingTitle(false)
      titleInputRef.current?.blur()
    }
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    const result = await SwalFire({
      title: 'Logout',
      text: 'Are you sure you want to logout?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#064e3b',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal-container',
        popup: 'swal-popup',
        title: 'swal-title',
        htmlContainer: 'swal-text',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn',
      },
    })

    if (result.isConfirmed) {
      setDropdownOpen(false)
      logout()
    }
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">
        {isViewer3D && editorNav && planId ? (
          <>
            <Link
              to={`/editor/${planId}`}
              className="navbar-editor-btn"
              title="Back to editor"
              aria-label="Back to editor"
            >
              <ArrowLeft size={20} />
            </Link>
            <span className="navbar-editor-title">
              3D View: {editorNav.planName || 'Untitled Plan'}
            </span>
          </>
        ) : isEditor && editorNav ? (
          <>
            <Link to="/" className="navbar-editor-btn" title="Back to all plans" aria-label="Back to all plans">
              <ArrowLeft size={20} />
            </Link>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                className="navbar-editor-title-input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={submitTitleEdit}
                onKeyDown={handleTitleKeyDown}
                aria-label="Plan name"
                autoFocus
              />
            ) : (
              <span
                className="navbar-editor-title"
                onDoubleClick={startEditingTitle}
                title="Double-click to rename"
              >
                {editorNav.planName || 'Untitled Plan'}
              </span>
            )}
            <span
              className={`navbar-save-state ${editorNav.saveState?.includes('fail') ? 'error' : editorNav.saveState === 'Saved' ? 'saved' : ''}`}
            >
              {editorNav.saveState}
            </span>
          </>
        ) : (
          <Link to="/">
            <img src="/favicon.svg" alt="" className="navbar-brand-icon" width={20} height={20} aria-hidden />
            FloorLab
          </Link>
        )}
      </div>

      <div className="navbar-right">
        <div className="navbar-user-container" ref={dropdownRef}>
        <button
          type="button"
          className="user-profile-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
        >
          <img
            src={user?.photoURL || ''}
            alt={user?.displayName || 'User'}
            className="user-avatar"
          />
        </button>

        {dropdownOpen && (
          <div className="user-dropdown">
            <div className="dropdown-header">
              <img
                src={user?.photoURL || ''}
                alt={user?.displayName || 'User'}
                className="dropdown-avatar"
              />
              <div className="dropdown-info">
                <div className="dropdown-name">{user?.displayName}</div>
                <div className="dropdown-email">{user?.email}</div>
              </div>
            </div>
            <div className="dropdown-divider"></div>
            <button type="button" className="dropdown-item logout-item" onClick={handleLogout}>
              <span className="dropdown-item-icon" aria-hidden><LogOut size={20} /></span>
              Logout
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
