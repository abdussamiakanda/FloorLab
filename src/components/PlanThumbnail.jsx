import { useRef, useEffect } from 'react'

const toRadians = (deg) => (deg * Math.PI) / 180

function getBounds(objects) {
  if (!objects?.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const toRad = toRadians

  objects.forEach((obj) => {
    if (obj.type === 'room' || obj.type === 'custom') {
      const r = toRad(obj.rotation || 0)
      const cos = Math.cos(r), sin = Math.sin(r)
      const corners = [
        [obj.x, obj.y],
        [obj.x + obj.width * cos, obj.y + obj.width * sin],
        [obj.x + obj.width * cos - obj.height * sin, obj.y + obj.width * sin + obj.height * cos],
        [obj.x - obj.height * sin, obj.y + obj.height * cos],
      ]
      corners.forEach(([px, py]) => {
        minX = Math.min(minX, px)
        minY = Math.min(minY, py)
        maxX = Math.max(maxX, px)
        maxY = Math.max(maxY, py)
      })
    } else if (obj.type === 'wall' || obj.type === 'door' || obj.type === 'window') {
      const r = toRad(obj.rotation || 0)
      const endX = obj.x + Math.cos(r) * obj.width
      const endY = obj.y + Math.sin(r) * obj.width
      const perp = r + Math.PI / 2
      const h = (obj.height || 10) / 2
      const corners = [
        [obj.x + Math.cos(perp) * h, obj.y + Math.sin(perp) * h],
        [obj.x - Math.cos(perp) * h, obj.y - Math.sin(perp) * h],
        [endX + Math.cos(perp) * h, endY + Math.sin(perp) * h],
        [endX - Math.cos(perp) * h, endY - Math.sin(perp) * h],
      ]
      corners.forEach(([px, py]) => {
        minX = Math.min(minX, px)
        minY = Math.min(minY, py)
        maxX = Math.max(maxX, px)
        maxY = Math.max(maxY, py)
      })
    }
  })

  if (minX === Infinity) return null
  const pad = 20
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  }
}

const ROOM_FILL = '#e0e7ff'
const ROOM_STROKE = '#818cf8'
const WALL_STROKE = '#94a3b8'
const DOOR_FILL = '#86efac'
const WINDOW_FILL = '#c4b5fd'
const CUSTOM_FILL = '#fde68a'

function PlanThumbnail({ objects, width = 360, height = 160 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const objs = Array.isArray(objects) ? objects : []
    const bounds = getBounds(objs)

    ctx.clearRect(0, 0, width, height)

    if (!bounds || objs.length === 0) {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No content yet', width / 2, height / 2)
      return
    }

    const rangeX = bounds.maxX - bounds.minX || 1
    const rangeY = bounds.maxY - bounds.minY || 1
    const padding = 24
    const fitScale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeY)
    const scale = fitScale * 1.4
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const tx = width / 2 - centerX * scale
    const ty = height / 2 - centerY * scale

    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)

    objs.forEach((obj) => {
      if (obj.visible === false) return
      const r = toRadians(obj.rotation || 0)
      const cos = Math.cos(r)
      const sin = Math.sin(r)

      if (obj.type === 'room') {
        ctx.save()
        ctx.translate(obj.x, obj.y)
        ctx.rotate(r)
        ctx.fillStyle = ROOM_FILL
        ctx.fillRect(0, 0, obj.width, obj.height)
        ctx.strokeStyle = ROOM_STROKE
        ctx.lineWidth = 2
        ctx.strokeRect(0, 0, obj.width, obj.height)
        ctx.restore()
      } else if (obj.type === 'custom') {
        ctx.save()
        ctx.translate(obj.x, obj.y)
        ctx.rotate(r)
        ctx.fillStyle = CUSTOM_FILL
        ctx.fillRect(0, 0, obj.width, obj.height)
        ctx.strokeStyle = ROOM_STROKE
        ctx.lineWidth = 1
        ctx.strokeRect(0, 0, obj.width, obj.height)
        ctx.restore()
      } else if (obj.type === 'wall') {
        ctx.beginPath()
        ctx.moveTo(obj.x, obj.y)
        ctx.lineTo(obj.x + Math.cos(r) * obj.width, obj.y + Math.sin(r) * obj.width)
        ctx.strokeStyle = WALL_STROKE
        ctx.lineWidth = Math.max(4, (obj.height || 10) * 0.5)
        ctx.lineCap = 'round'
        ctx.stroke()
      } else if (obj.type === 'door') {
        ctx.save()
        ctx.translate(obj.x, obj.y)
        ctx.rotate(r)
        ctx.fillStyle = DOOR_FILL
        ctx.fillRect(0, -(obj.height || 10) / 2, obj.width, obj.height || 10)
        ctx.strokeStyle = WALL_STROKE
        ctx.lineWidth = 1
        ctx.strokeRect(0, -(obj.height || 10) / 2, obj.width, obj.height || 10)
        ctx.restore()
      } else if (obj.type === 'window') {
        ctx.save()
        ctx.translate(obj.x, obj.y)
        ctx.rotate(r)
        ctx.fillStyle = WINDOW_FILL
        ctx.globalAlpha = 0.8
        ctx.fillRect(0, -(obj.height || 10) / 2, obj.width, obj.height || 10)
        ctx.globalAlpha = 1
        ctx.strokeStyle = WALL_STROKE
        ctx.lineWidth = 1
        ctx.strokeRect(0, -(obj.height || 10) / 2, obj.width, obj.height || 10)
        ctx.restore()
      }
    })

    ctx.restore()
  }, [objects, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="plan-thumbnail"
      aria-hidden
    />
  )
}

export default PlanThumbnail
