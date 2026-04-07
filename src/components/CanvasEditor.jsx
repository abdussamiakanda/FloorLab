import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCanvas } from '../hooks/useCanvas'
import { useEditorNav } from '../context/EditorNavContext'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  DoorOpen,
  Eye,
  EyeOff,
  Gauge,
  Grid3X3,
  Keyboard,
  LayoutGrid,
  Minus,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelTop,
  Pencil,
  Redo2,
  RotateCw,
  FlipHorizontal,
  Ruler,
  Save,
  Square,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import CustomToolModal from './CustomToolModal'
import { CUSTOM_TYPES } from './CustomToolModal'

const GRID_SIZE = 24
const RULER_SIZE = 28
const MEASUREMENT_STEP = 0.2
/** When zoom exceeds this, snap uses half-grid for finer positioning */
const ZOOM_FRACTIONAL_THRESHOLD = 1.2
const SNAP_STEP_FRACTIONAL = GRID_SIZE / 5

const roundToStep = (value, step) => Math.round(value / step) * step
const formatMeasurement = (value) => (value % 1 === 0 ? String(Math.round(value)) : value.toFixed(1))

const DEFAULT_LEGEND_COLORS = {
  wall: '#111827',
  door: '#16a34a',
  window: '#7c3aed',
  room: '#3b82f6',
  custom: '#64748b',
}

/** Real CSS 3D cube for the 3D view toolbar control (not a flat stroke icon). */
function Toolbar3DBoxIcon() {
  return (
    <span className="tool-btn-3d-scene">
      <span className="tool-btn-3d-cube">
        <span className="tool-btn-cube-face tool-btn-cube-face--front" />
        <span className="tool-btn-cube-face tool-btn-cube-face--back" />
        <span className="tool-btn-cube-face tool-btn-cube-face--right" />
        <span className="tool-btn-cube-face tool-btn-cube-face--left" />
        <span className="tool-btn-cube-face tool-btn-cube-face--top" />
        <span className="tool-btn-cube-face tool-btn-cube-face--bottom" />
      </span>
    </span>
  )
}

const toRadians = (degrees) => (degrees * Math.PI) / 180

const createWallObject = (start, end) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)

  return {
    id: crypto.randomUUID(),
    type: 'wall',
    name: '',
    visible: true,
    x: start.x,
    y: start.y,
    width: length,
    height: 6,
    rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

const createDoorObject = (start, end) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)

  return {
    id: crypto.randomUUID(),
    type: 'door',
    name: '',
    visible: true,
    x: start.x,
    y: start.y,
    width: Math.max(length, 30),
    height: 6,
    rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

const createWindowObject = (start, end) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)

  return {
    id: crypto.randomUUID(),
    type: 'window',
    name: '',
    visible: true,
    x: start.x,
    y: start.y,
    width: Math.max(length, 25),
    height: 6,
    rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

const createRoomObject = (start, end) => {
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)

  return {
    id: crypto.randomUUID(),
    type: 'room',
    name: '',
    visible: true,
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.max(width, 50),
    height: Math.max(height, 50),
    rotation: 0,
  }
}

const createCustomObject = (x, y, customTypeId) => {
  const def = CUSTOM_TYPES.find((t) => t.id === customTypeId) || CUSTOM_TYPES[0]
  const width = def.width * GRID_SIZE
  const height = def.height * GRID_SIZE
  return {
    id: crypto.randomUUID(),
    type: 'custom',
    customType: customTypeId,
    name: '',
    visible: true,
    x,
    y,
    width,
    height,
    rotation: 0,
  }
}

const pointToWallDistance = (point, wall) => {
  const angle = toRadians(wall.rotation)
  const endX = wall.x + Math.cos(angle) * wall.width
  const endY = wall.y + Math.sin(angle) * wall.width

  const vx = endX - wall.x
  const vy = endY - wall.y
  const wx = point.x - wall.x
  const wy = point.y - wall.y

  const c1 = vx * wx + vy * wy
  if (c1 <= 0) {
    return Math.hypot(point.x - wall.x, point.y - wall.y)
  }

  const c2 = vx * vx + vy * vy
  if (c2 <= c1) {
    return Math.hypot(point.x - endX, point.y - endY)
  }

  const b = c1 / c2
  const projectionX = wall.x + b * vx
  const projectionY = wall.y + b * vy
  return Math.hypot(point.x - projectionX, point.y - projectionY)
}

function CanvasEditor({
  planId,
  initialObjects,
  onObjectsChange,
  onSave,
  onExportJson,
  planName,
  saveState,
  colors,
  onColorsChange,
  readOnly = false,
}) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rulerBottomRef = useRef(null)
  const rulerRightRef = useRef(null)
  const dragStateRef = useRef(null)
  const panStateRef = useRef(null)
  const panZoomRef = useRef({ pan: { x: 0, y: 0 }, zoom: 1 })

  const [gridEnabled, setGridEnabled] = useState(true)
  const [measurementsVisible, setMeasurementsVisible] = useState(true)
  const [rulersVisible, setRulersVisible] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  useEffect(() => {
    panZoomRef.current = { pan, zoom }
  }, [pan, zoom])
  const [wallLengthInput, setWallLengthInput] = useState('')
  const [doorLengthInput, setDoorLengthInput] = useState('')
  const [windowLengthInput, setWindowLengthInput] = useState('')
  const [roomWidthInput, setRoomWidthInput] = useState('')
  const [roomHeightInput, setRoomHeightInput] = useState('')
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false)
  const [editingNameId, setEditingNameId] = useState(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(220)
  const [isResizingRight, setIsResizingRight] = useState(false)
  const [objectGroupExpanded, setObjectGroupExpanded] = useState({
    wall: true,
    door: true,
    window: true,
    room: true,
    custom: true,
  })
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [pendingCustomType, setPendingCustomType] = useState(null)
  const resizeRightRef = useRef(null)
  const editorNav = useEditorNav()
  const sidebarOpen = editorNav?.sidebarOpen ?? true
  const setSidebarOpen = editorNav?.setSidebarOpen ?? (() => {})

  const { state, resetPlan, setTool, setWallDraft, selectObject, addObject, updateObject, deleteObject, undo, redo } =
    useCanvas()

  const legendColors = { ...DEFAULT_LEGEND_COLORS, ...(colors || {}) }

  const handleLegendColorChange = (key, value) => {
    if (!onColorsChange) return
    onColorsChange({ ...legendColors, [key]: value })
  }

  const selectedObject = state.selectedObjectId
    ? state.objects.find((o) => o.id === state.selectedObjectId) ?? null
    : null

  const toGridUnits = (px) => roundToStep(px / GRID_SIZE, MEASUREMENT_STEP)
  const toDisplayMeasurement = (px) => formatMeasurement(px / GRID_SIZE)

  // Sync measurement inputs when selection changes (grid units = px / GRID_SIZE, step 0.2)
  useEffect(() => {
    if (selectedObject?.type === 'wall') {
      setWallLengthInput(formatMeasurement(toGridUnits(selectedObject.width)))
      setDoorLengthInput('')
      setWindowLengthInput('')
      setRoomWidthInput('')
      setRoomHeightInput('')
    } else if (selectedObject?.type === 'door') {
      setWallLengthInput('')
      setDoorLengthInput(formatMeasurement(toGridUnits(selectedObject.width)))
      setWindowLengthInput('')
      setRoomWidthInput('')
      setRoomHeightInput('')
    } else if (selectedObject?.type === 'window') {
      setWallLengthInput('')
      setDoorLengthInput('')
      setWindowLengthInput(formatMeasurement(toGridUnits(selectedObject.width)))
      setRoomWidthInput('')
      setRoomHeightInput('')
    } else if (selectedObject?.type === 'room' || selectedObject?.type === 'custom') {
      setWallLengthInput('')
      setDoorLengthInput('')
      setWindowLengthInput('')
      setRoomWidthInput(formatMeasurement(toGridUnits(selectedObject.width)))
      setRoomHeightInput(formatMeasurement(toGridUnits(selectedObject.height)))
    } else {
      setWallLengthInput('')
      setDoorLengthInput('')
      setWindowLengthInput('')
      setRoomWidthInput('')
      setRoomHeightInput('')
    }
  }, [state.selectedObjectId])

  const applyWallLength = useCallback(() => {
    if (selectedObject?.type !== 'wall') return
    const parsed = parseFloat(wallLengthInput)
    const measurement = !Number.isNaN(parsed) ? roundToStep(parsed, MEASUREMENT_STEP) : null
    if (measurement != null && measurement >= MEASUREMENT_STEP) {
      updateObject(selectedObject.id, { width: measurement * GRID_SIZE })
    } else {
      setWallLengthInput(formatMeasurement(toGridUnits(selectedObject.width)))
    }
  }, [selectedObject, wallLengthInput, updateObject])

  const applyDoorLength = useCallback(() => {
    if (selectedObject?.type !== 'door') return
    const parsed = parseFloat(doorLengthInput)
    const measurement = !Number.isNaN(parsed) ? roundToStep(parsed, MEASUREMENT_STEP) : null
    if (measurement != null && measurement >= MEASUREMENT_STEP) {
      updateObject(selectedObject.id, { width: measurement * GRID_SIZE })
    } else {
      setDoorLengthInput(formatMeasurement(toGridUnits(selectedObject.width)))
    }
  }, [selectedObject, doorLengthInput, updateObject])

  const applyWindowLength = useCallback(() => {
    if (selectedObject?.type !== 'window') return
    const parsed = parseFloat(windowLengthInput)
    const measurement = !Number.isNaN(parsed) ? roundToStep(parsed, MEASUREMENT_STEP) : null
    if (measurement != null && measurement >= MEASUREMENT_STEP) {
      updateObject(selectedObject.id, { width: measurement * GRID_SIZE })
    } else {
      setWindowLengthInput(formatMeasurement(toGridUnits(selectedObject.width)))
    }
  }, [selectedObject, windowLengthInput, updateObject])

  const applyRoomDimensions = useCallback(() => {
    if (selectedObject?.type !== 'room' && selectedObject?.type !== 'custom') return
    const wParsed = parseFloat(roomWidthInput)
    const hParsed = parseFloat(roomHeightInput)
    const w = !Number.isNaN(wParsed) ? roundToStep(wParsed, MEASUREMENT_STEP) : null
    const h = !Number.isNaN(hParsed) ? roundToStep(hParsed, MEASUREMENT_STEP) : null
    const minGrid = selectedObject?.type === 'room' ? 2 : 0.5
    if (w != null && h != null && w >= minGrid && h >= minGrid) {
      updateObject(selectedObject.id, { width: w * GRID_SIZE, height: h * GRID_SIZE })
    } else {
      setRoomWidthInput(formatMeasurement(toGridUnits(selectedObject.width)))
      setRoomHeightInput(formatMeasurement(toGridUnits(selectedObject.height)))
    }
  }, [selectedObject, roomWidthInput, roomHeightInput, updateObject])

  const duplicateObjectById = useCallback((object) => {
    const copy = {
      ...object,
      id: crypto.randomUUID(),
      name: (object.name || '').trim() ? `${(object.name || '').trim()} (copy)` : '',
      visible: true,
      x: object.x + GRID_SIZE,
      y: object.y + GRID_SIZE,
    }
    addObject(copy)
  }, [addObject])

  const handleDuplicate = useCallback(() => {
    if (!selectedObject) return
    duplicateObjectById(selectedObject)
  }, [selectedObject, duplicateObjectById])

  const ROTATE_STEP = 90
  const handleRotate = useCallback(() => {
    if (!selectedObject) return
    const current = Number(selectedObject.rotation) || 0
    const next = ((current + ROTATE_STEP) % 360 + 360) % 360
    updateObject(selectedObject.id, { rotation: next })
  }, [selectedObject, updateObject])

  const getObjectDisplayName = (object, index) => {
    const name = (object.name || '').trim()
    if (object.type === 'custom') {
      const typeLabel = CUSTOM_TYPES.find((t) => t.id === object.customType)?.label || object.customType || 'Custom'
      return name || `${typeLabel} ${index + 1}`
    }
    const typeLabel = object.type.charAt(0).toUpperCase() + object.type.slice(1)
    return name || `${typeLabel} ${index + 1}`
  }

  const startEditingName = (object) => {
    setEditingNameId(object.id)
    setEditingNameValue((object.name || '').trim())
  }

  const applyRename = useCallback(() => {
    if (!editingNameId) return
    const value = (editingNameValue || '').trim()
    updateObject(editingNameId, { name: value })
    setEditingNameId(null)
    setEditingNameValue('')
  }, [editingNameId, editingNameValue, updateObject])

  const toggleObjectVisible = (object) => {
    updateObject(object.id, { visible: object.visible === false })
  }

  const RIGHT_SIDEBAR_MIN = 180
  const RIGHT_SIDEBAR_MAX = 480

  const onRightResizeStart = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    resizeRightRef.current = { startX: e.clientX, startWidth: rightSidebarWidth }
    setIsResizingRight(true)
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeRightRef.current) return
      const { startX, startWidth } = resizeRightRef.current
      const delta = startX - e.clientX
      setRightSidebarWidth((w) => Math.min(RIGHT_SIDEBAR_MAX, Math.max(RIGHT_SIDEBAR_MIN, startWidth + delta)))
    }
    const onUp = () => {
      resizeRightRef.current = null
      setIsResizingRight(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Initialize canvas with loaded objects once on mount
  const initializedRef = useRef(false)
  useEffect(() => {
    if (!initializedRef.current) {
      resetPlan(initialObjects || [])
      initializedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync canvas state to parent - use ref to prevent infinite loops
  const lastSyncedObjects = useRef(null)
  useEffect(() => {
    const objectsJson = JSON.stringify(state.objects)
    if (lastSyncedObjects.current !== objectsJson) {
      console.log('Canvas syncing objects to parent:', state.objects.length)
      lastSyncedObjects.current = objectsJson
      onObjectsChange(state.objects)
    }
  }, [state.objects, onObjectsChange])

  // Fit all objects to viewport on first load
  const fittedRef = useRef(false)
  useEffect(() => {
    if (!fittedRef.current && state.objects.length > 0 && containerRef.current && canvasRef.current) {
      fittedRef.current = true
      setTimeout(() => fitToView(), 0) // Defer to ensure canvas dimensions are ready
    }
  }, [state.objects.length])

  const getObjectBounds = (object) => {
    if (object.type === 'room' || object.type === 'custom') {
      const angle = toRadians(object.rotation || 0)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const corners = [
        { x: object.x, y: object.y },
        { x: object.x + object.width * cos, y: object.y + object.width * sin },
        { x: object.x + object.width * cos - object.height * sin, y: object.y + object.width * sin + object.height * cos },
        { x: object.x - object.height * sin, y: object.y + object.height * cos },
      ]
      const xs = corners.map((c) => c.x)
      const ys = corners.map((c) => c.y)
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      }
    } else {
      // Wall, door, window - account for rotation
      const angle = toRadians(object.rotation)
      const endX = object.x + Math.cos(angle) * object.width
      const endY = object.y + Math.sin(angle) * object.width

      // Get perpendicular offset for height
      const perpAngle = angle + Math.PI / 2
      const offsetX = Math.cos(perpAngle) * (object.height / 2)
      const offsetY = Math.sin(perpAngle) * (object.height / 2)

      // Four corners of rotated rectangle
      const corners = [
        { x: object.x + offsetX, y: object.y + offsetY },
        { x: object.x - offsetX, y: object.y - offsetY },
        { x: endX + offsetX, y: endY + offsetY },
        { x: endX - offsetX, y: endY - offsetY },
      ]

      const xs = corners.map((c) => c.x)
      const ys = corners.map((c) => c.y)

      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      }
    }
  }

  const fitToView = () => {
    const canvas = canvasRef.current
    const container = containerRef.current

    if (!canvas || !container || state.objects.length === 0) return

    // Calculate combined bounds of all objects
    let bounds = null

    state.objects.forEach((obj) => {
      const objBounds = getObjectBounds(obj)
      if (!bounds) {
        bounds = objBounds
      } else {
        bounds.minX = Math.min(bounds.minX, objBounds.minX)
        bounds.minY = Math.min(bounds.minY, objBounds.minY)
        bounds.maxX = Math.max(bounds.maxX, objBounds.maxX)
        bounds.maxY = Math.max(bounds.maxY, objBounds.maxY)
      }
    })

    if (!bounds) return

    // Add padding
    const padding = 100
    bounds.minX -= padding
    bounds.minY -= padding
    bounds.maxX += padding
    bounds.maxY += padding

    const boundsWidth = bounds.maxX - bounds.minX
    const boundsHeight = bounds.maxY - bounds.minY

    // Get container dimensions
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Calculate zoom to fit both dimensions
    const zoomX = containerWidth / boundsWidth
    const zoomY = containerHeight / boundsHeight
    const newZoom = Math.min(zoomX, zoomY, 2.5)

    // Calculate pan to center the content
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2

    const newPanX = containerWidth / 2 - centerX * newZoom
    const newPanY = containerHeight / 2 - centerY * newZoom

    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }

  const worldFromPointer = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top

    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    }
  }

  const toSnap = (point) => {
    const step = zoom > ZOOM_FRACTIONAL_THRESHOLD ? SNAP_STEP_FRACTIONAL : GRID_SIZE
    return {
      x: Math.round(point.x / step) * step,
      y: Math.round(point.y / step) * step,
    }
  }

  const findObjectAtPoint = (point) => {
    for (let index = state.objects.length - 1; index >= 0; index -= 1) {
      const object = state.objects[index]
      if (object.visible === false) continue

      if (object.type === 'wall' && pointToWallDistance(point, object) <= object.height) {
        return object
      }
      
      if (object.type === 'door' && pointToWallDistance(point, object) <= object.height + 5) {
        return object
      }
      
      if (object.type === 'window' && pointToWallDistance(point, object) <= object.height + 5) {
        return object
      }
      
      if (object.type === 'room') {
        const angle = toRadians(object.rotation)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        const dx = point.x - object.x
        const dy = point.y - object.y

        const localX = dx * cos + dy * sin
        const localY = -dx * sin + dy * cos

        if (localX >= 0 && localX <= object.width && localY >= 0 && localY <= object.height) {
          return object
        }
      }

      if (object.type === 'custom') {
        const angle = toRadians(object.rotation || 0)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const dx = point.x - object.x
        const dy = point.y - object.y
        const localX = dx * cos + dy * sin
        const localY = -dx * sin + dy * cos
        if (localX >= 0 && localX <= object.width && localY >= 0 && localY <= object.height) {
          return object
        }
      }
    }

    return null
  }

  const draw = useMemo(
    () => () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) {
        return
      }

      const width = container.clientWidth
      const height = container.clientHeight
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      context.clearRect(0, 0, width, height)

      context.save()
      context.translate(pan.x, pan.y)
      context.scale(zoom, zoom)

      if (gridEnabled) {
        const startX = Math.floor((-pan.x / zoom) / GRID_SIZE) * GRID_SIZE
        const startY = Math.floor((-pan.y / zoom) / GRID_SIZE) * GRID_SIZE
        const endX = startX + width / zoom + GRID_SIZE
        const endY = startY + height / zoom + GRID_SIZE

        if (zoom > ZOOM_FRACTIONAL_THRESHOLD) {
          context.beginPath()
          context.strokeStyle = '#eef2ff'
          context.lineWidth = 0.5 / zoom
          for (let x = Math.floor(startX / SNAP_STEP_FRACTIONAL) * SNAP_STEP_FRACTIONAL; x <= endX; x += SNAP_STEP_FRACTIONAL) {
            context.moveTo(x, startY)
            context.lineTo(x, endY)
          }
          for (let y = Math.floor(startY / SNAP_STEP_FRACTIONAL) * SNAP_STEP_FRACTIONAL; y <= endY; y += SNAP_STEP_FRACTIONAL) {
            context.moveTo(startX, y)
            context.lineTo(endX, y)
          }
          context.stroke()
        }

        context.beginPath()
        context.strokeStyle = '#e3e7ef'
        context.lineWidth = 1 / zoom
        for (let x = startX; x <= endX; x += GRID_SIZE) {
          context.moveTo(x, startY)
          context.lineTo(x, endY)
        }
        for (let y = startY; y <= endY; y += GRID_SIZE) {
          context.moveTo(startX, y)
          context.lineTo(endX, y)
        }
        context.stroke()
      }

      // Draw all objects (selected last so it appears on top)
      const selectedId = state.selectedObjectId
      const drawOrder = [...state.objects].sort((a, b) => {
        if (a.id === selectedId) return 1
        if (b.id === selectedId) return -1
        return 0
      })
      drawOrder.forEach((object) => {
        if (object.visible === false) return
        const isSelected = object.id === selectedId

        if (object.type === 'wall') {
          const angle = toRadians(object.rotation)
          const endX = object.x + Math.cos(angle) * object.width
          const endY = object.y + Math.sin(angle) * object.width

          context.beginPath()
          context.lineCap = 'round'
          context.lineWidth = object.height
          context.strokeStyle = isSelected ? '#f97316' : legendColors.wall
          context.moveTo(object.x, object.y)
          context.lineTo(endX, endY)
          context.stroke()

          if (measurementsVisible) {
            const midX = (object.x + endX) / 2
            const midY = (object.y + endY) / 2
            const measurement = formatMeasurement(roundToStep(object.width / GRID_SIZE, MEASUREMENT_STEP))
            const perpAngle = toRadians(object.rotation + 90)
            const lineOffset = 16 / zoom
            const lineLength = 5 / zoom
            context.beginPath()
            context.lineWidth = 1 / zoom
            context.strokeStyle = legendColors.wall
            const startLineX1 = object.x + Math.cos(perpAngle) * lineOffset
            const startLineY1 = object.y + Math.sin(perpAngle) * lineOffset
            const startLineX2 = object.x + Math.cos(perpAngle) * (lineOffset + lineLength)
            const startLineY2 = object.y + Math.sin(perpAngle) * (lineOffset + lineLength)
            context.moveTo(startLineX1, startLineY1)
            context.lineTo(startLineX2, startLineY2)
            context.stroke()
            context.beginPath()
            const endLineX1 = endX + Math.cos(perpAngle) * lineOffset
            const endLineY1 = endY + Math.sin(perpAngle) * lineOffset
            const endLineX2 = endX + Math.cos(perpAngle) * (lineOffset + lineLength)
            const endLineY2 = endY + Math.sin(perpAngle) * (lineOffset + lineLength)
            context.moveTo(endLineX1, endLineY1)
            context.lineTo(endLineX2, endLineY2)
            context.stroke()
            context.beginPath()
            context.moveTo(startLineX2, startLineY2)
            context.lineTo(endLineX2, endLineY2)
            context.stroke()
            const textX = midX + Math.cos(perpAngle) * lineOffset
            const textY = midY + Math.sin(perpAngle) * lineOffset
            context.save()
            context.translate(textX, textY)
            let textRotation = object.rotation
            if (textRotation > 90 || textRotation < -90) textRotation += 180
            context.rotate(toRadians(textRotation))
            context.font = `bold ${12 / zoom}px Arial`
            context.textAlign = 'center'
            context.textBaseline = 'middle'
            const m0 = context.measureText(measurement)
            const pad = 4 / zoom
            const w0 = m0.width + 2 * pad
            const h0 = 12 / zoom + 2 * pad
            context.fillStyle = '#ffffff'
            context.fillRect(-w0 / 2, -h0 / 2, w0, h0)
            context.fillStyle = '#111827'
            context.fillText(measurement, 0, 0)
            context.restore()
          }
        }
        else if (object.type === 'door') {
          const angle = toRadians(object.rotation)
          const endX = object.x + Math.cos(angle) * object.width
          const endY = object.y + Math.sin(angle) * object.width

          context.beginPath()
          context.lineCap = 'round'
          context.lineWidth = object.height
          context.strokeStyle = isSelected ? '#f97316' : legendColors.door
          context.moveTo(object.x, object.y)
          context.lineTo(endX, endY)
          context.stroke()

          // Draw door arc
          context.beginPath()
          context.strokeStyle = isSelected ? '#f97316' : legendColors.door
          context.lineWidth = 2 / zoom
          const arcRadius = 15
          context.arc(object.x, object.y, arcRadius, angle, angle + Math.PI / 4, false)
          context.stroke()

          if (measurementsVisible) {
            const midX = (object.x + endX) / 2
            const midY = (object.y + endY) / 2
            const measurement = formatMeasurement(roundToStep(object.width / GRID_SIZE, MEASUREMENT_STEP))
            const perpAngle = toRadians(object.rotation + 90)
            const lineOffset = 16 / zoom
            const lineLength = 5 / zoom
            context.beginPath()
            context.lineWidth = 1 / zoom
            context.strokeStyle = legendColors.door
            const startLineX1 = object.x + Math.cos(perpAngle) * lineOffset
            const startLineY1 = object.y + Math.sin(perpAngle) * lineOffset
            const startLineX2 = object.x + Math.cos(perpAngle) * (lineOffset + lineLength)
            const startLineY2 = object.y + Math.sin(perpAngle) * (lineOffset + lineLength)
            context.moveTo(startLineX1, startLineY1)
            context.lineTo(startLineX2, startLineY2)
            context.stroke()
            context.beginPath()
            const endLineX1 = endX + Math.cos(perpAngle) * lineOffset
            const endLineY1 = endY + Math.sin(perpAngle) * lineOffset
            const endLineX2 = endX + Math.cos(perpAngle) * (lineOffset + lineLength)
            const endLineY2 = endY + Math.sin(perpAngle) * (lineOffset + lineLength)
            context.moveTo(endLineX1, endLineY1)
            context.lineTo(endLineX2, endLineY2)
            context.stroke()
            context.beginPath()
            context.moveTo(startLineX2, startLineY2)
            context.lineTo(endLineX2, endLineY2)
            context.stroke()
            const textX = midX + Math.cos(perpAngle) * lineOffset
            const textY = midY + Math.sin(perpAngle) * lineOffset
            context.save()
            context.translate(textX, textY)
            let textRotation = object.rotation
            if (textRotation > 90 || textRotation < -90) textRotation += 180
            context.rotate(toRadians(textRotation))
            context.font = `bold ${11 / zoom}px Arial`
            context.textAlign = 'center'
            context.textBaseline = 'middle'
            const m1 = context.measureText(measurement)
            const pad1 = 4 / zoom
            const w1 = m1.width + 2 * pad1
            const h1 = 11 / zoom + 2 * pad1
            context.fillStyle = '#ffffff'
            context.fillRect(-w1 / 2, -h1 / 2, w1, h1)
            context.fillStyle = '#15803d'
            context.fillText(measurement, 0, 0)
            context.restore()
          }
        }
        else if (object.type === 'window') {
          const angle = toRadians(object.rotation)
          const endX = object.x + Math.cos(angle) * object.width
          const endY = object.y + Math.sin(angle) * object.width

          context.beginPath()
          context.lineCap = 'round'
          context.lineWidth = object.height
          context.strokeStyle = isSelected ? '#f97316' : legendColors.window
          context.moveTo(object.x, object.y)
          context.lineTo(endX, endY)
          context.stroke()

          // Draw window cross pattern
          const stepSize = object.width / 4
          for (let i = 1; i < 4; i++) {
            const px = object.x + Math.cos(angle) * stepSize * i
            const py = object.y + Math.sin(angle) * stepSize * i
            const perpX = Math.cos(angle + Math.PI / 2) * 4
            const perpY = Math.sin(angle + Math.PI / 2) * 4
            context.beginPath()
            context.moveTo(px - perpX, py - perpY)
            context.lineTo(px + perpX, py + perpY)
            context.strokeStyle = isSelected ? '#f97316' : legendColors.window
            context.lineWidth = 1 / zoom
            context.stroke()
          }

          if (measurementsVisible) {
            const midX = (object.x + endX) / 2
            const midY = (object.y + endY) / 2
            const measurement = formatMeasurement(roundToStep(object.width / GRID_SIZE, MEASUREMENT_STEP))
            const perpAngle = toRadians(object.rotation + 90)
            const lineOffset = 16 / zoom
            const lineLength = 5 / zoom
            context.beginPath()
            context.lineWidth = 1 / zoom
            context.strokeStyle = legendColors.window
            const startLineX1 = object.x + Math.cos(perpAngle) * lineOffset
            const startLineY1 = object.y + Math.sin(perpAngle) * lineOffset
            const startLineX2 = object.x + Math.cos(perpAngle) * (lineOffset + lineLength)
            const startLineY2 = object.y + Math.sin(perpAngle) * (lineOffset + lineLength)
            context.moveTo(startLineX1, startLineY1)
            context.lineTo(startLineX2, startLineY2)
            context.stroke()
            context.beginPath()
            const endLineX1 = endX + Math.cos(perpAngle) * lineOffset
            const endLineY1 = endY + Math.sin(perpAngle) * lineOffset
            const endLineX2 = endX + Math.cos(perpAngle) * (lineOffset + lineLength)
            const endLineY2 = endY + Math.sin(perpAngle) * (lineOffset + lineLength)
            context.moveTo(endLineX1, endLineY1)
            context.lineTo(endLineX2, endLineY2)
            context.stroke()
            context.beginPath()
            context.moveTo(startLineX2, startLineY2)
            context.lineTo(endLineX2, endLineY2)
            context.stroke()
            const textX = midX + Math.cos(perpAngle) * lineOffset
            const textY = midY + Math.sin(perpAngle) * lineOffset
            context.save()
            context.translate(textX, textY)
            let textRotation = object.rotation
            if (textRotation > 90 || textRotation < -90) textRotation += 180
            context.rotate(toRadians(textRotation))
            context.font = `bold ${11 / zoom}px Arial`
            context.textAlign = 'center'
            context.textBaseline = 'middle'
            const m2 = context.measureText(measurement)
            const pad2 = 4 / zoom
            const w2 = m2.width + 2 * pad2
            const h2 = 11 / zoom + 2 * pad2
            context.fillStyle = '#ffffff'
            context.fillRect(-w2 / 2, -h2 / 2, w2, h2)
            context.fillStyle = '#6d28d9'
            context.fillText(measurement, 0, 0)
            context.restore()
          }
        }
        else if (object.type === 'room') {
          const rot = toRadians(object.rotation || 0)
          context.save()
          context.translate(object.x, object.y)
          context.rotate(rot)
          context.fillStyle = isSelected
            ? legendColors.room + '1a' // ~10% alpha
            : legendColors.room + '0d' // ~5% alpha
          context.fillRect(0, 0, object.width, object.height)
          context.strokeStyle = isSelected ? '#f97316' : legendColors.room
          context.lineWidth = 2 / zoom
          context.strokeRect(0, 0, object.width, object.height)
          if (measurementsVisible) {
            const squaresW = formatMeasurement(roundToStep(object.width / GRID_SIZE, MEASUREMENT_STEP))
            const squaresH = formatMeasurement(roundToStep(object.height / GRID_SIZE, MEASUREMENT_STEP))
            const measurement = `${squaresW}×${squaresH}`
            const cx = object.width / 2
            const cy = object.height / 2
            context.font = `bold ${11 / zoom}px Arial`
            context.textAlign = 'center'
            context.textBaseline = 'middle'
            const m3 = context.measureText(measurement)
            const pad3 = 4 / zoom
            const w3 = m3.width + 2 * pad3
            const h3 = 11 / zoom + 2 * pad3
            context.fillStyle = '#ffffff'
            context.fillRect(cx - w3 / 2, cy - h3 / 2, w3, h3)
            context.fillStyle = legendColors.room
            context.fillText(measurement, cx, cy)
          }
          context.restore()
        } else if (object.type === 'custom') {
          context.save()
          context.translate(object.x, object.y)
          context.rotate(toRadians(object.rotation || 0))
          context.fillStyle = isSelected ? legendColors.custom + '2a' : legendColors.custom + '1a'
          context.fillRect(0, 0, object.width, object.height)
          context.strokeStyle = isSelected ? '#f97316' : legendColors.custom
          context.lineWidth = 2 / zoom
          context.strokeRect(0, 0, object.width, object.height)
          const label = CUSTOM_TYPES.find((t) => t.id === object.customType)?.label || object.customType || 'Custom'
          context.font = `${Math.max(10, 12 / zoom)}px Arial`
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillStyle = isSelected ? '#f97316' : '#475569'
          context.fillText(label, object.width / 2, object.height / 2)
          context.restore()
        }
      })

      // Draw draft preview
      if (state.wallDraft) {
        let previewObject

        if (state.selectedTool === 'wall') {
          previewObject = createWallObject(state.wallDraft.start, state.wallDraft.end)
        } else if (state.selectedTool === 'door') {
          previewObject = createDoorObject(state.wallDraft.start, state.wallDraft.end)
        } else if (state.selectedTool === 'window') {
          previewObject = createWindowObject(state.wallDraft.start, state.wallDraft.end)
        } else if (state.selectedTool === 'room') {
          previewObject = createRoomObject(state.wallDraft.start, state.wallDraft.end)
        }

        if (previewObject) {
          if (previewObject.type === 'wall') {
            const angle = toRadians(previewObject.rotation)
            const endX = previewObject.x + Math.cos(angle) * previewObject.width
            const endY = previewObject.y + Math.sin(angle) * previewObject.width
            context.beginPath()
            context.lineCap = 'round'
            context.lineWidth = previewObject.height
            context.strokeStyle = legendColors.wall
            context.moveTo(previewObject.x, previewObject.y)
            context.lineTo(endX, endY)
            context.stroke()
          } else if (previewObject.type === 'door') {
            const angle = toRadians(previewObject.rotation)
            const endX = previewObject.x + Math.cos(angle) * previewObject.width
            const endY = previewObject.y + Math.sin(angle) * previewObject.width
            context.beginPath()
            context.lineCap = 'round'
            context.lineWidth = previewObject.height
            context.strokeStyle = legendColors.door
            context.moveTo(previewObject.x, previewObject.y)
            context.lineTo(endX, endY)
            context.stroke()
          } else if (previewObject.type === 'window') {
            const angle = toRadians(previewObject.rotation)
            const endX = previewObject.x + Math.cos(angle) * previewObject.width
            const endY = previewObject.y + Math.sin(angle) * previewObject.width
            context.beginPath()
            context.lineCap = 'round'
            context.lineWidth = previewObject.height
            context.strokeStyle = legendColors.window
            context.moveTo(previewObject.x, previewObject.y)
            context.lineTo(endX, endY)
            context.stroke()
          } else if (previewObject.type === 'room') {
            context.fillStyle = legendColors.room + '1a'
            context.fillRect(previewObject.x, previewObject.y, previewObject.width, previewObject.height)
            context.strokeStyle = legendColors.room
            context.lineWidth = 2 / zoom
            context.strokeRect(previewObject.x, previewObject.y, previewObject.width, previewObject.height)
          }
        }
      }

      context.restore()
    },
    [
      gridEnabled,
      measurementsVisible,
      pan.x,
      pan.y,
      state.objects,
      state.selectedObjectId,
      state.wallDraft,
      state.selectedTool,
      zoom,
      colors,
    ],
  )

  useEffect(() => {
    draw()
  }, [draw])

  // Draw bottom and right rulers with grid square numbers
  const drawRulers = useCallback(() => {
    const container = containerRef.current
    const rulerBottom = rulerBottomRef.current
    const rulerRight = rulerRightRef.current
    if (!container || !rulerBottom || !rulerRight) return

    const cw = container.clientWidth
    const ch = container.clientHeight

    rulerBottom.width = cw
    rulerBottom.height = RULER_SIZE
    rulerRight.width = RULER_SIZE
    rulerRight.height = ch

    const bottomCtx = rulerBottom.getContext('2d')
    const rightCtx = rulerRight.getContext('2d')
    if (!bottomCtx || !rightCtx) return

    bottomCtx.clearRect(0, 0, cw, RULER_SIZE)
    rightCtx.clearRect(0, 0, RULER_SIZE, ch)

    bottomCtx.fillStyle = '#f8fafc'
    bottomCtx.fillRect(0, 0, cw, RULER_SIZE)
    rightCtx.fillStyle = '#f8fafc'
    rightCtx.fillRect(0, 0, RULER_SIZE, ch)

    bottomCtx.strokeStyle = '#e2e8f0'
    bottomCtx.lineWidth = 1
    bottomCtx.beginPath()
    bottomCtx.moveTo(0, 0)
    bottomCtx.lineTo(cw, 0)
    bottomCtx.stroke()

    rightCtx.strokeStyle = '#e2e8f0'
    rightCtx.beginPath()
    rightCtx.moveTo(0, 0)
    rightCtx.lineTo(RULER_SIZE, 0)
    rightCtx.stroke()

    bottomCtx.fillStyle = '#475569'
    bottomCtx.font = '11px Inter, system-ui, sans-serif'
    bottomCtx.textAlign = 'left'
    bottomCtx.textBaseline = 'top'

    rightCtx.fillStyle = '#475569'
    rightCtx.font = '11px Inter, system-ui, sans-serif'
    rightCtx.textAlign = 'left'
    rightCtx.textBaseline = 'top'

    const worldLeft = -pan.x / zoom
    const worldRight = (cw - pan.x) / zoom
    const worldTop = -pan.y / zoom
    const worldBottom = (ch - pan.y) / zoom

    const minX = Math.floor(worldLeft / GRID_SIZE)
    const maxX = Math.ceil(worldRight / GRID_SIZE)
    const minY = Math.floor(worldTop / GRID_SIZE)
    const maxY = Math.ceil(worldBottom / GRID_SIZE)

    for (let n = minX; n <= maxX; n++) {
      const screenX = pan.x + n * GRID_SIZE * zoom
      if (screenX < -20 || screenX > cw + 20) continue
      bottomCtx.beginPath()
      bottomCtx.moveTo(screenX, 0)
      bottomCtx.lineTo(screenX, n % 5 === 0 ? 10 : 6)
      bottomCtx.stroke()
      if (n % 5 === 0) {
        bottomCtx.fillText(String(n), screenX + 2, 12)
      }
    }

    for (let n = minY; n <= maxY; n++) {
      const screenY = pan.y + n * GRID_SIZE * zoom
      if (screenY < -20 || screenY > ch + 20) continue
      rightCtx.save()
      rightCtx.translate(0, screenY)
      rightCtx.beginPath()
      rightCtx.moveTo(0, 0)
      rightCtx.lineTo(n % 5 === 0 ? 10 : 6, 0)
      rightCtx.stroke()
      if (n % 5 === 0) {
        rightCtx.fillText(String(n), 12, 4)
      }
      rightCtx.restore()
    }
  }, [pan.x, pan.y, zoom])

  useEffect(() => {
    drawRulers()
  }, [drawRulers])

  // Redraw when container resizes (e.g. sidebar open/close) so canvas resolution stays in sync — keeps zoom/pan, no stretch
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => {
      draw()
      drawRulers()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [draw, drawRulers])

  const onMouseDown = (event) => {
    if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey))) {
      event.preventDefault()
      panStateRef.current = {
        startMouse: { x: event.clientX, y: event.clientY },
        startPan: pan,
      }
      return
    }

    if (event.button !== 0) {
      return
    }

    const worldPoint = toSnap(worldFromPointer(event))

    if (readOnly) {
      const hitObject = findObjectAtPoint(worldPoint)
      selectObject(hitObject?.id ?? null)
      return
    }

    if (state.selectedTool === 'wall' || state.selectedTool === 'door' || state.selectedTool === 'window' || state.selectedTool === 'room') {
      setWallDraft({ start: worldPoint, end: worldPoint })
      return
    }

    const hitObject = findObjectAtPoint(worldPoint)

    if (state.selectedTool === 'custom' && pendingCustomType && !hitObject) {
      const snapped = toSnap(worldPoint)
      const obj = createCustomObject(snapped.x, snapped.y, pendingCustomType)
      addObject(obj)
      return
    }

    if (state.selectedTool === 'delete') {
      if (hitObject) {
        deleteObject(hitObject.id)
      }
      return
    }

    if (!hitObject) {
      selectObject(null)
      return
    }

    selectObject(hitObject.id)
    dragStateRef.current = {
      objectId: hitObject.id,
      startPointer: worldPoint,
      startObject: { x: hitObject.x, y: hitObject.y },
    }
  }

  const onMouseMove = (event) => {
    if (panStateRef.current) {
      const dx = event.clientX - panStateRef.current.startMouse.x
      const dy = event.clientY - panStateRef.current.startMouse.y

      setPan({
        x: panStateRef.current.startPan.x + dx,
        y: panStateRef.current.startPan.y + dy,
      })
      return
    }

    if (readOnly) return

    if (state.wallDraft) {
      setWallDraft({
        start: state.wallDraft.start,
        end: toSnap(worldFromPointer(event)),
      })
      return
    }

    if (!dragStateRef.current) {
      return
    }

    const worldPoint = toSnap(worldFromPointer(event))
    const dx = worldPoint.x - dragStateRef.current.startPointer.x
    const dy = worldPoint.y - dragStateRef.current.startPointer.y

    updateObject(dragStateRef.current.objectId, {
      x: dragStateRef.current.startObject.x + dx,
      y: dragStateRef.current.startObject.y + dy,
    })
  }

  const onMouseUp = () => {
    panStateRef.current = null
    dragStateRef.current = null

    if (readOnly || !state.wallDraft) {
      return
    }

    let object = null

    if (state.selectedTool === 'wall') {
      object = createWallObject(state.wallDraft.start, state.wallDraft.end)
      if (object.width < 3) {
        setWallDraft(null)
        return
      }
    } else if (state.selectedTool === 'door') {
      object = createDoorObject(state.wallDraft.start, state.wallDraft.end)
      if (object.width < 10) {
        setWallDraft(null)
        return
      }
    } else if (state.selectedTool === 'window') {
      object = createWindowObject(state.wallDraft.start, state.wallDraft.end)
      if (object.width < 10) {
        setWallDraft(null)
        return
      }
    } else if (state.selectedTool === 'room') {
      object = createRoomObject(state.wallDraft.start, state.wallDraft.end)
      if (object.width < 30 || object.height < 30) {
        setWallDraft(null)
        return
      }
    }

    if (object) {
      addObject(object)
    }

    setWallDraft(null)
  }

  const onWheel = (event) => {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const { pan: currentPan, zoom: currentZoom } = panZoomRef.current
    const rect = canvas.getBoundingClientRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top
    const delta = event.deltaY < 0 ? 1.1 : 0.9
    const newZoom = Math.min(3, Math.max(0.25, currentZoom * delta))
    const worldX = (screenX - currentPan.x) / currentZoom
    const worldY = (screenY - currentPan.y) / currentZoom
    setPan({
      x: screenX - worldX * newZoom,
      y: screenY - worldY * newZoom,
    })
    setZoom(newZoom)
  }

  // Attach wheel listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  // Close shortcuts modal on Escape
  useEffect(() => {
    if (!shortcutsModalOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShortcutsModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcutsModalOpen])

  // Keyboard shortcuts (ignore when typing in inputs or when modal is open)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (shortcutsModalOpen) return
      const tag = e.target?.tagName?.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable
      if (isInput) return

      if (e.key === 'Escape') {
        e.preventDefault()
        setTool('select')
        selectObject(null)
        setWallDraft(null)
        return
      }

      if (readOnly) {
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault()
          setTool('select')
        }
        return
      }

      const ctrlOrMeta = e.ctrlKey || e.metaKey

      if (ctrlOrMeta && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }
      if (ctrlOrMeta && (e.key === 'y' || e.key === 'Z')) {
        e.preventDefault()
        redo()
        return
      }
      if (ctrlOrMeta && e.key === 's') {
        e.preventDefault()
        onSave()
        return
      }
      if (ctrlOrMeta && e.key === 'd') {
        e.preventDefault()
        handleDuplicate()
        return
      }
      if (ctrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        handleRotate()
        return
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select')
          break
        case 'w':
          setTool('wall')
          break
        case 'd':
          setTool('door')
          break
        case 'n':
          setTool('window')
          break
        case 'r':
          setTool('room')
          break
        case 'delete':
        case 'backspace':
          e.preventDefault()
          if (state.selectedObjectId) {
            deleteObject(state.selectedObjectId)
            selectObject(null)
          }
          break
        default:
          return
      }
      e.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [readOnly, shortcutsModalOpen, state.selectedObjectId, state.wallDraft, undo, redo, onSave, handleDuplicate, handleRotate, setTool, setWallDraft, selectObject, deleteObject])

  const handleExportPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const off = document.createElement('canvas')
    off.width = canvas.width
    off.height = canvas.height
    const ctx = off.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, off.width, off.height)
    ctx.drawImage(canvas, 0, 0)
    const png = off.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = png
    link.download = 'floorplan.png'
    link.click()
  }

  const importInputRef = useRef(null)

  const handleImportJson = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const raw = Array.isArray(data) ? data : data?.objects ? data.objects : []
        const validTypes = ['wall', 'door', 'window', 'room', 'custom']
        const validCustomTypes = CUSTOM_TYPES.map((t) => t.id)
        const normalized = raw.map((obj) => {
          const type = validTypes.includes(obj.type) ? obj.type : 'wall'
          const customType = type === 'custom' && validCustomTypes.includes(obj.customType) ? obj.customType : (CUSTOM_TYPES[0]?.id || 'table')
          const def = type === 'custom' ? CUSTOM_TYPES.find((t) => t.id === customType) || CUSTOM_TYPES[0] : null
          return {
            id: obj.id && typeof obj.id === 'string' ? obj.id : crypto.randomUUID(),
            type,
            ...(type === 'custom' ? { customType } : {}),
            name: typeof obj.name === 'string' ? obj.name : '',
            visible: obj.visible !== false,
            x: Number(obj.x) || 0,
            y: Number(obj.y) || 0,
            width: Number(obj.width) || (def ? def.width * GRID_SIZE : 24),
            height: Number(obj.height) ?? (def ? def.height * GRID_SIZE : 6),
            rotation: Number(obj.rotation) || 0,
          }
        })
        resetPlan(normalized)
      } catch (err) {
        console.error('Import JSON failed:', err)
        alert('Invalid JSON file. Use an exported floor plan JSON.')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div className={`editor-wrap ${readOnly ? 'editor-wrap-readonly' : ''}`}>
      {readOnly && (
        <div className="editor-readonly-banner" role="status">
          View only — you can open and pan this plan but cannot edit it.
        </div>
      )}
      {/* Main layout with sidebar and canvas */}
      <div className="editor-main">
        {!sidebarOpen && (
          <button
            type="button"
            className="sidebar-open-tab"
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <PanelLeftOpen size={20} strokeWidth={2} />
          </button>
        )}
        <aside className={`editor-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="toolbar">
            <div className="editor-sidebar-header">
              <span className="toolbar-label">Tools</span>
              <button
                type="button"
                className="object-list-btn sidebar-header-close-btn"
                onClick={() => setSidebarOpen(false)}
                title="Close sidebar"
                aria-label="Close sidebar"
              >
                <PanelLeftClose size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="toolbar-group toolbar-group-grid">
              <div className="toolbar-label">Drawing Tools</div>
              {[
                { id: 'select', Icon: MousePointer2, label: 'Select', shortcut: 'V' },
                { id: 'wall', Icon: Minus, label: 'Wall', shortcut: 'W' },
                { id: 'door', Icon: DoorOpen, label: 'Door', shortcut: 'D' },
                { id: 'window', Icon: PanelTop, label: 'Window', shortcut: 'N' },
                { id: 'room', Icon: Square, label: 'Room', shortcut: 'R' },
              ].map(({ id, Icon, label, shortcut }) => (
                <button
                  key={id}
                  type="button"
                  className={`tool-btn ${state.selectedTool === id ? 'active' : ''}`}
                  onClick={() => !readOnly && setTool(id)}
                  disabled={readOnly && id !== 'select'}
                  title={readOnly && id !== 'select' ? 'View only' : `${label} (${shortcut})`}
                >
                  <span className="tool-btn-icon"><Icon size={16} /></span>
                  {label}
                </button>
              ))}
              <button
                type="button"
                className={`tool-btn ${state.selectedTool === 'custom' ? 'active' : ''}`}
                onClick={() => {
                  if (readOnly) return
                  setCustomModalOpen(true)
                }}
                disabled={readOnly}
                title="Add custom object (balcony, table, chair, etc.)"
              >
                <span className="tool-btn-icon"><LayoutGrid size={16} /></span>
                Custom
              </button>
            </div>
            <CustomToolModal
              isOpen={customModalOpen}
              onClose={() => setCustomModalOpen(false)}
              onSelect={(customTypeId) => {
                setPendingCustomType(customTypeId)
                setTool('custom')
              }}
            />

            <div className="toolbar-group toolbar-group-grid">
              <div className="toolbar-label">Edit</div>
              <button type="button" className="tool-btn" onClick={undo} disabled={readOnly} title="Undo (Ctrl+Z)">
                <span className="tool-btn-icon"><Undo2 size={16} /></span>
                Undo
              </button>
              <button type="button" className="tool-btn" onClick={redo} disabled={readOnly} title="Redo (Ctrl+Shift+Z)">
                <span className="tool-btn-icon"><Redo2 size={16} /></span>
                Redo
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={handleDuplicate}
                disabled={readOnly || !selectedObject}
                title="Duplicate (Ctrl+D)"
              >
                <span className="tool-btn-icon"><Copy size={16} /></span>
                Duplicate
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={handleRotate}
                disabled={readOnly || !selectedObject}
                title="Rotate 90° (Ctrl+Shift+R)"
              >
                <span className="tool-btn-icon"><RotateCw size={16} /></span>
                Rotate
              </button>
              <button type="button" className="tool-btn tool-btn-save" onClick={onSave} disabled={readOnly} title="Save (Ctrl+S)">
                <span className="tool-btn-icon"><Save size={16} /></span>
                Save
              </button>
            </div>

            <div className="toolbar-group toolbar-group-grid">
              <div className="toolbar-label">View</div>
              <button type="button" className={`tool-btn ${gridEnabled ? 'active' : ''}`} onClick={() => setGridEnabled((c) => !c)} title="Toggle grid">
                <span className="tool-btn-icon"><Grid3X3 size={16} /></span>
                Grid
              </button>
              <button type="button" className={`tool-btn ${measurementsVisible ? 'active' : ''}`} onClick={() => setMeasurementsVisible((c) => !c)} title="Toggle dimension labels">
                <span className="tool-btn-icon"><Gauge size={16} /></span>
                Labels
              </button>
              <button type="button" className={`tool-btn ${rulersVisible ? 'active' : ''}`} onClick={() => setRulersVisible((c) => !c)} title="Toggle rulers">
                <span className="tool-btn-icon"><Ruler size={16} /></span>
                Rulers
              </button>
              {planId && (
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => navigate(`/3d/${planId}`)}
                  title="Open 3D view"
                >
                  <span className="tool-btn-icon tool-btn-icon-3d-cube" aria-hidden>
                    <Toolbar3DBoxIcon />
                  </span>
                  3D
                </button>
              )}
            </div>

            <div className="toolbar-group">
              <div className="toolbar-label">Import / Export</div>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportJson}
                className="toolbar-import-input"
                aria-label="Import JSON"
              />
              <button
                type="button"
                className="tool-btn"
                onClick={() => importInputRef.current?.click()}
                disabled={readOnly}
                title="Import JSON"
              >
                <span className="tool-btn-icon"><Upload size={16} /></span>
                Import JSON
              </button>
              <button type="button" className="tool-btn" onClick={onExportJson} title="Export JSON">
                <span className="tool-btn-icon"><Download size={16} /></span>
                Export JSON
              </button>
              <button type="button" className="tool-btn" onClick={handleExportPng} title="Export PNG (white background)">
                <span className="tool-btn-icon"><Download size={16} /></span>
                Export PNG
              </button>
            </div>

            <div className="toolbar-footer">
              <button
                type="button"
                className="tool-btn tool-btn-link"
                onClick={() => setShortcutsModalOpen(true)}
                title="View keyboard shortcuts"
              >
                <span className="tool-btn-icon"><Keyboard size={16} /></span>
                Keyboard shortcuts
              </button>
            </div>
          </div>
        </aside>

        {shortcutsModalOpen && (
          <div
            className="shortcuts-modal-overlay"
            onClick={() => setShortcutsModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
          >
            <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
              <div className="shortcuts-modal-header">
                <h2 id="shortcuts-modal-title">Keyboard shortcuts</h2>
                <button
                  type="button"
                  className="shortcuts-modal-close"
                  onClick={() => setShortcutsModalOpen(false)}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="shortcuts-modal-body">
                <dl className="shortcuts-list">
                  <div className="shortcuts-row">
                    <dt>Undo</dt>
                    <dd><kbd>Ctrl</kbd> + <kbd>Z</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Redo</dt>
                    <dd><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> or <kbd>Ctrl</kbd> + <kbd>Y</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Save</dt>
                    <dd><kbd>Ctrl</kbd> + <kbd>S</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Duplicate</dt>
                    <dd><kbd>Ctrl</kbd> + <kbd>D</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Rotate selected 90°</dt>
                    <dd><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Select tool</dt>
                    <dd><kbd>V</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Wall tool</dt>
                    <dd><kbd>W</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Door tool</dt>
                    <dd><kbd>D</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Window tool</dt>
                    <dd><kbd>N</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Room tool</dt>
                    <dd><kbd>R</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Remove selected</dt>
                    <dd><kbd>Delete</kbd> or <kbd>Backspace</kbd></dd>
                  </div>
                  <div className="shortcuts-row">
                    <dt>Cancel / Deselect</dt>
                    <dd><kbd>Escape</kbd></dd>
                  </div>
                </dl>
                <p className="shortcuts-note">On Mac use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>.</p>
              </div>
            </div>
          </div>
        )}

        {/* Canvas area */}
        <div className="canvas-area">
          <div className="canvas-meta">
            <span>Tool: {state.selectedTool.charAt(0).toUpperCase() + state.selectedTool.slice(1)}</span>
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <span>Objects: {state.objects.length}</span>

            <div className="canvas-legend">
              <div className="legend-item">
                <input
                  type="color"
                  value={legendColors.wall}
                  onChange={(e) => handleLegendColorChange('wall', e.target.value)}
                  aria-label="Wall color"
                />
                <span>Wall</span>
              </div>
              <div className="legend-item">
                <input
                  type="color"
                  value={legendColors.door}
                  onChange={(e) => handleLegendColorChange('door', e.target.value)}
                  aria-label="Door color"
                />
                <span>Door</span>
              </div>
              <div className="legend-item">
                <input
                  type="color"
                  value={legendColors.window}
                  onChange={(e) => handleLegendColorChange('window', e.target.value)}
                  aria-label="Window color"
                />
                <span>Window</span>
              </div>
              <div className="legend-item">
                <input
                  type="color"
                  value={legendColors.room}
                  onChange={(e) => handleLegendColorChange('room', e.target.value)}
                  aria-label="Room color"
                />
                <span>Room</span>
              </div>
            </div>
          </div>

          <div className={`canvas-rulers-wrap ${rulersVisible ? '' : 'rulers-hidden'}`}>
            <div className="canvas-container" ref={containerRef}>
              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  cursor:
                    state.selectedTool === 'wall' || state.selectedTool === 'door' || state.selectedTool === 'window' || state.selectedTool === 'room' || state.selectedTool === 'custom'
                      ? 'crosshair'
                      : 'default',
                }}
              />
            </div>
            {rulersVisible && (
              <>
                <canvas className="ruler ruler-bottom" ref={rulerBottomRef} aria-hidden />
                <canvas className="ruler ruler-right" ref={rulerRightRef} aria-hidden />
              </>
            )}
          </div>
        </div>

        <aside
          className={`editor-sidebar editor-sidebar-right ${rightSidebarOpen ? 'open' : 'closed'} ${isResizingRight ? 'resizing' : ''}`}
          style={{
            width: rightSidebarOpen ? rightSidebarWidth : 0,
            minWidth: rightSidebarOpen ? rightSidebarWidth : 0,
          }}
        >
          {!rightSidebarOpen && (
            <button
              type="button"
              className="sidebar-open-tab sidebar-open-tab-right"
              onClick={() => setRightSidebarOpen(true)}
              title="Open objects sidebar"
              aria-label="Open objects sidebar"
            >
              <PanelRightOpen size={20} strokeWidth={2} />
            </button>
          )}
          {rightSidebarOpen && (
            <div
              className="sidebar-resize-handle sidebar-resize-handle-left"
              onMouseDown={onRightResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={rightSidebarWidth}
              aria-valuemin={RIGHT_SIDEBAR_MIN}
              aria-valuemax={RIGHT_SIDEBAR_MAX}
              aria-label="Resize objects sidebar"
            />
          )}
          <div className="objects-sidebar-inner">
            <div className="objects-sidebar-header">
              <button
                type="button"
                className="object-list-btn sidebar-header-close-btn"
                onClick={() => setRightSidebarOpen(false)}
                title="Close sidebar"
                aria-label="Close objects sidebar"
              >
                <PanelRightClose size={20} strokeWidth={2} />
              </button>
              <span className="toolbar-label">Objects</span>
            </div>
            <div className="objects-list" aria-label="Object list">
              {(() => {
                const groups = { wall: [], door: [], window: [], room: [], custom: [] }
                state.objects.forEach((obj) => {
                  if (groups[obj.type]) groups[obj.type].push(obj)
                })
                const typeOrder = ['room', 'door', 'window', 'wall', 'custom']
                const typeLabels = { wall: 'Walls', door: 'Doors', window: 'Windows', room: 'Rooms', custom: 'Custom' }
                const typeIcons = { wall: Minus, door: DoorOpen, window: PanelTop, room: Square, custom: LayoutGrid }
                return typeOrder.map((type) => {
                  const items = groups[type]
                  const expanded = objectGroupExpanded[type]
                  const TypeIcon = typeIcons[type]
                  return (
                    <div key={type} className="objects-group">
                      <button
                        type="button"
                        className="objects-group-header"
                        onClick={() => setObjectGroupExpanded((prev) => ({ ...prev, [type]: !prev[type] }))}
                        aria-expanded={expanded}
                        aria-controls={`objects-group-list-${type}`}
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <TypeIcon size={14} />
                        <span className="objects-group-label">{typeLabels[type]}</span>
                        <span className="objects-group-count">{items.length}</span>
                      </button>
                      <ul
                        id={`objects-group-list-${type}`}
                        className={`objects-group-list ${expanded ? 'expanded' : 'collapsed'}`}
                        aria-hidden={!expanded}
                      >
                        {items.map((object, idx) => {
                          const globalIndex = state.objects.indexOf(object)
                          const isSelected = object.id === state.selectedObjectId
                          const isEditing = editingNameId === object.id
                          const displayName = getObjectDisplayName(object, globalIndex)
                          const ItemIcon = type === 'custom'
                            ? (CUSTOM_TYPES.find((t) => t.id === object.customType)?.Icon || LayoutGrid)
                            : typeIcons[type]
                          return (
                            <li
                              key={object.id}
                              className={`object-list-item ${isSelected ? 'selected' : ''} ${object.visible === false ? 'hidden' : ''}`}
                            >
                              <div className="object-list-item-row">
                                <div
                                  className="object-list-item-main"
                                  onClick={() => selectObject(object.id)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => e.key === 'Enter' && selectObject(object.id)}
                                >
                                  <span className="object-list-icon" aria-hidden><ItemIcon size={14} /></span>
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      className="object-list-name-input"
                                      value={editingNameValue}
                                      onChange={(e) => setEditingNameValue(e.target.value)}
                                      onBlur={applyRename}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') applyRename()
                                        if (e.key === 'Escape') {
                                          setEditingNameId(null)
                                          setEditingNameValue('')
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                      aria-label="Rename object"
                                    />
                                  ) : (
                                    <span className="object-list-name">{displayName}</span>
                                  )}
                                </div>
                                <div className="object-list-actions">
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      className="object-list-btn"
                                      onClick={(e) => { e.stopPropagation(); toggleObjectVisible(object) }}
                                      title={object.visible !== false ? 'Hide' : 'Show'}
                                      aria-label={object.visible !== false ? 'Hide object' : 'Show object'}
                                    >
                                      {object.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                  )}
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      className="object-list-btn object-list-btn-remove"
                                      onClick={(e) => { e.stopPropagation(); deleteObject(object.id); if (state.selectedObjectId === object.id) selectObject(null) }}
                                      title="Remove"
                                      aria-label="Remove object"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                  {!readOnly && !isEditing && (
                                    <button
                                      type="button"
                                      className="object-list-btn"
                                      onClick={(e) => { e.stopPropagation(); startEditingName(object) }}
                                      title="Rename"
                                      aria-label="Rename object"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {!readOnly && isSelected && object.type === 'wall' && (
                                <div className="toolbar-group toolbar-group-properties object-list-item-properties">
                                  <div className="toolbar-label">Wall</div>
                                  <label className="toolbar-field">
                                    <span>Length (grid units)</span>
                                    <input
                                      type="number"
                                      min={0.2}
                                      step={0.2}
                                      value={wallLengthInput}
                                      onChange={(e) => setWallLengthInput(e.target.value)}
                                      onBlur={applyWallLength}
                                      onKeyDown={(e) => e.key === 'Enter' && applyWallLength()}
                                      aria-label="Wall length in grid units"
                                    />
                                  </label>
                                </div>
                              )}
                              {!readOnly && isSelected && object.type === 'door' && (
                                <div className="toolbar-group toolbar-group-properties object-list-item-properties">
                                  <div className="toolbar-label">Door</div>
                                  <label className="toolbar-field">
                                    <span>Length (grid units)</span>
                                    <input
                                      type="number"
                                      min={0.2}
                                      step={0.2}
                                      value={doorLengthInput}
                                      onChange={(e) => setDoorLengthInput(e.target.value)}
                                      onBlur={applyDoorLength}
                                      onKeyDown={(e) => e.key === 'Enter' && applyDoorLength()}
                                      aria-label="Door length in grid units"
                                    />
                                  </label>
                                </div>
                              )}
                              {!readOnly && isSelected && object.type === 'window' && (
                                <div className="toolbar-group toolbar-group-properties object-list-item-properties">
                                  <div className="toolbar-label">Window</div>
                                  <label className="toolbar-field">
                                    <span>Length (grid units)</span>
                                    <input
                                      type="number"
                                      min={0.2}
                                      step={0.2}
                                      value={windowLengthInput}
                                      onChange={(e) => setWindowLengthInput(e.target.value)}
                                      onBlur={applyWindowLength}
                                      onKeyDown={(e) => e.key === 'Enter' && applyWindowLength()}
                                      aria-label="Window length in grid units"
                                    />
                                  </label>
                                </div>
                              )}
                              {!readOnly && isSelected && object.type === 'room' && (
                                <div className="toolbar-group toolbar-group-properties object-list-item-properties">
                                  <div className="toolbar-label">Room</div>
                                  <label className="toolbar-field">
                                    <span>Width (grid units)</span>
                                    <input
                                      type="number"
                                      min={2}
                                      step={0.2}
                                      value={roomWidthInput}
                                      onChange={(e) => setRoomWidthInput(e.target.value)}
                                      onBlur={applyRoomDimensions}
                                      onKeyDown={(e) => e.key === 'Enter' && applyRoomDimensions()}
                                      aria-label="Room width in grid units"
                                    />
                                  </label>
                                  <label className="toolbar-field">
                                    <span>Height (grid units)</span>
                                    <input
                                      type="number"
                                      min={2}
                                      step={0.2}
                                      value={roomHeightInput}
                                      onChange={(e) => setRoomHeightInput(e.target.value)}
                                      onBlur={applyRoomDimensions}
                                      onKeyDown={(e) => e.key === 'Enter' && applyRoomDimensions()}
                                      aria-label="Room height in grid units"
                                    />
                                  </label>
                                </div>
                              )}
                              {!readOnly && isSelected && object.type === 'custom' && (
                                <div className="toolbar-group toolbar-group-properties object-list-item-properties">
                                  <div className="toolbar-label">Custom</div>
                                  <label className="toolbar-field">
                                    <span>Width (grid units)</span>
                                    <input
                                      type="number"
                                      min={0.5}
                                      step={0.2}
                                      value={roomWidthInput}
                                      onChange={(e) => setRoomWidthInput(e.target.value)}
                                      onBlur={applyRoomDimensions}
                                      onKeyDown={(e) => e.key === 'Enter' && applyRoomDimensions()}
                                      aria-label="Width in grid units"
                                    />
                                  </label>
                                  <label className="toolbar-field">
                                    <span>Height (grid units)</span>
                                    <input
                                      type="number"
                                      min={0.5}
                                      step={0.2}
                                      value={roomHeightInput}
                                      onChange={(e) => setRoomHeightInput(e.target.value)}
                                      onBlur={applyRoomDimensions}
                                      onKeyDown={(e) => e.key === 'Enter' && applyRoomDimensions()}
                                      aria-label="Height in grid units"
                                    />
                                  </label>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })
              })()}
            </div>
            {state.objects.length === 0 && (
              <p className="objects-list-empty">No objects yet. Use the tools to draw.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default CanvasEditor
