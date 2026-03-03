import { useEffect } from 'react'
import {
  Armchair,
  Bath,
  BedDouble,
  Droplets,
  RectangleHorizontal,
  Shirt,
  Sofa,
  Sun,
  X,
} from 'lucide-react'

/** Default width/height in grid units for custom objects. Exported for CanvasEditor. */
export const CUSTOM_TYPES = [
  { id: 'balcony', label: 'Balcony', width: 5, height: 3, Icon: Sun },
  { id: 'table', label: 'Table', width: 3, height: 2, Icon: RectangleHorizontal },
  { id: 'chair', label: 'Chair', width: 1.4, height: 1.4, Icon: Armchair },
  { id: 'basin', label: 'Basin', width: 1.4, height: 1, Icon: Droplets },
  { id: 'bed', label: 'Bed', width: 6, height: 5, Icon: BedDouble },
  { id: 'sofa', label: 'Sofa', width: 5, height: 2, Icon: Sofa },
  { id: 'wardrobe', label: 'Wardrobe', width: 4, height: 1.6, Icon: Shirt },
  { id: 'toilet', label: 'Toilet', width: 1.4, height: 1.4, Icon: Bath },
]

function CustomToolModal({ isOpen, onClose, onSelect }) {
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="custom-tool-modal-title">
      <div className="modal-content custom-tool-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="custom-tool-modal-title">Add custom object</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="custom-tool-list">
          {CUSTOM_TYPES.map((item) => {
            const IconComponent = item.Icon
            return (
              <button
                key={item.id}
                type="button"
                className="custom-tool-option"
                onClick={() => {
                  onSelect(item.id)
                  onClose()
                }}
              >
                {IconComponent && (
                  <span className="custom-tool-icon" aria-hidden>
                    <IconComponent size={20} />
                  </span>
                )}
                <span className="custom-tool-label">{item.label}</span>
                <span className="custom-tool-size">{item.width}×{item.height}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CustomToolModal
