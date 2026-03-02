import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import Swal from 'sweetalert2'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

const ICON_MAP = {
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
}

let injectedRoot = null

function injectLucideIcon(modal, iconType) {
  const IconComponent = ICON_MAP[iconType]
  if (!IconComponent) return

  const iconEl = modal.querySelector('.swal2-icon')
  if (!iconEl) return

  // Hide all default SweetAlert2 icon content (content, rings, lines, etc.)
  const existing = iconEl.querySelectorAll('.swal2-icon-content, .swal2-success-ring, .swal2-success-fix, [class^="swal2-success-line"], .swal2-warning-icon-content')
  existing.forEach((el) => { el.style.display = 'none' })
  // Also hide any direct children that aren't our wrapper (catch-all)
  Array.from(iconEl.children).forEach((child) => {
    if (!child.classList.contains('swal2-lucide-icon')) child.style.display = 'none'
  })

  const wrapper = document.createElement('div')
  wrapper.className = 'swal2-lucide-icon'
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.style.display = 'flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'
  wrapper.style.width = '40px'
  wrapper.style.height = '40px'
  wrapper.style.color = iconType === 'warning' ? '#f59e0b' : iconType === 'success' ? '#22c55e' : '#dc2626'
  iconEl.appendChild(wrapper)

  injectedRoot = createRoot(wrapper)
  injectedRoot.render(createElement(IconComponent, { size: 40, strokeWidth: 2 }))
}

function unmountLucideIcon() {
  if (injectedRoot) {
    try {
      injectedRoot.unmount()
    } catch (_) {}
    injectedRoot = null
  }
}

/**
 * SweetAlert2 fire() with Lucide icons injected for warning, success, and error.
 * Use this instead of Swal.fire() so modal icons are real Lucide components.
 */
export function fire(options = {}) {
  const iconType = options.icon
  const hasLucideIcon = iconType && ICON_MAP[iconType]

  const didOpen = (modal) => {
    if (hasLucideIcon) {
      const run = () => injectLucideIcon(modal, iconType)
      if (modal.querySelector('.swal2-icon')) run()
      else setTimeout(run, 50)
    }
    if (typeof options.didOpen === 'function') options.didOpen(modal)
  }

  const willClose = () => {
    unmountLucideIcon()
    if (typeof options.willClose === 'function') options.willClose()
  }

  const didClose = () => {
    unmountLucideIcon()
    if (typeof options.didClose === 'function') options.didClose()
  }

  return Swal.fire({
    ...options,
    didOpen,
    willClose,
    didClose,
  })
}

export default fire
