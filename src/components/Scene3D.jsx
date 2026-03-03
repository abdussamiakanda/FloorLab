import { useMemo } from 'react'
import { BoxGeometry, BufferGeometry, DoubleSide, EdgesGeometry, Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'

const FLOOR_COLOR = '#e3e3c8'
const WALL_FACE_COLOR = '#f0f0e9'
const WALL_EDGE_COLOR = '#363631'
const WALL_HEIGHT = 200
const WALL_THICKNESS = 10
const DOOR_HEIGHT = 0.8 * WALL_HEIGHT
const DOOR_THICKNESS = WALL_THICKNESS + 2
const WINDOW_HEIGHT = 0.5 * WALL_HEIGHT
const WINDOW_THICKNESS = WALL_THICKNESS + 2
const DEFAULT_DOOR_COLOR = '#16a34a'
const DEFAULT_WINDOW_COLOR = '#7c3aed'
const WINDOW_OPACITY = 0.5
const FLOOR_SIZE_MULTIPLIER = 1
const FLOOR_SIZE_MIN = 50
const FLOOR_SIZE_DEFAULT = 100
const ORBIT_MIN_DISTANCE = 2
const CAMERA_FAR = 3000
const ORBIT_MAX_DISTANCE = CAMERA_FAR
const AXES_X_COLOR = '#e53935'
const AXES_Y_COLOR = '#43a047'
const AXES_Z_COLOR = '#1e88e5'
const CORNER_AXES_LENGTH = 0.8

/** 3D height (same units as plan) per custom type for floor objects */
const CUSTOM_3D_HEIGHTS = {
  balcony: 100,
  table: 70,
  chair: 45,
  basin: 90,
  bed: 40,
  sofa: 45,
  wardrobe: 180,
  toilet: 40,
}
const CUSTOM_3D_DEFAULT_HEIGHT = 50
const CUSTOM_3D_COLOR = '#8b7355'

const toRadians = (degrees) => (degrees * Math.PI) / 180

/** Syncs main camera position to a ref so the corner axes overlay can match orientation. */
function CameraSync({ cameraRef }) {
  const { camera } = useThree()
  useFrame(() => {
    if (cameraRef?.current) cameraRef.current.copy(camera.position)
  })
  return null
}

/** Minimal axes (X,Y,Z) for the fixed screen-corner overlay; camera is synced from main scene direction. */
export function CornerAxesScene({ cameraRef }) {
  const { camera } = useThree()
  const length = CORNER_AXES_LENGTH
  const lineX = useMemo(
    () => new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(length, 0, 0)]),
    [length],
  )
  const lineY = useMemo(
    () => new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, length, 0)]),
    [length],
  )
  const lineZ = useMemo(
    () => new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, length)]),
    [length],
  )
  useFrame(() => {
    if (cameraRef?.current && cameraRef.current.lengthSq() > 0) {
      camera.position.copy(cameraRef.current).normalize().multiplyScalar(2.5)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
    }
  })
  return (
    <>
      <line geometry={lineX}>
        <lineBasicMaterial color={AXES_X_COLOR} />
      </line>
      <line geometry={lineY}>
        <lineBasicMaterial color={AXES_Y_COLOR} />
      </line>
      <line geometry={lineZ}>
        <lineBasicMaterial color={AXES_Z_COLOR} />
      </line>
      <Html position={[length + 0.15, 0, 0]} center style={{ color: AXES_X_COLOR, fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, pointerEvents: 'none' }}>X</Html>
      <Html position={[0, length + 0.15, 0]} center style={{ color: AXES_Y_COLOR, fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, pointerEvents: 'none' }}>Y</Html>
      <Html position={[0, 0, length + 0.15]} center style={{ color: AXES_Z_COLOR, fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, pointerEvents: 'none' }}>Z</Html>
    </>
  )
}

// 2D coords: x right, y down. 3D: X = x, Y up, Z = -y (so 2D y-down = 3D -Z)
function planTo3D(x, y) {
  return [x, 0, -y]
}

export { CAMERA_FAR }
export function getPlanBounds(objects) {
  if (!objects?.length) return { center: [0, 0, 0], size: 100 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  objects.forEach((obj) => {
    if (obj.visible === false) return
    if (obj.type === 'wall' || obj.type === 'door' || obj.type === 'window') {
      const angle = toRadians(obj.rotation)
      const x2 = obj.x + Math.cos(angle) * obj.width
      const y2 = obj.y + Math.sin(angle) * obj.width
      minX = Math.min(minX, obj.x, x2)
      minY = Math.min(minY, obj.y, y2)
      maxX = Math.max(maxX, obj.x, x2)
      maxY = Math.max(maxY, obj.y, y2)
    } else if (obj.type === 'room') {
      const r = toRadians(obj.rotation || 0)
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
    } else if (obj.type === 'custom') {
      const r = toRadians(obj.rotation || 0)
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
    }
  })
  if (minX === Infinity) return { center: [0, 0, 0], size: 100 }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const size = Math.max(maxX - minX, maxY - minY, 50) * 1.2
  return {
    center: [cx, 0, -cy],
    size,
  }
}

function WallMesh({ object, color, thickness = WALL_THICKNESS, height = WALL_HEIGHT }) {
  const { x, y, width, rotation } = object
  const angle = toRadians(rotation)
  const cx = x + (Math.cos(angle) * width) / 2
  const cy = y + (Math.sin(angle) * width) / 2
  const [posX, posY, posZ] = planTo3D(cx, cy)

  const boxArgs = useMemo(() => [width, height, thickness], [width, height, thickness])
  const edgesGeometry = useMemo(
    () => new EdgesGeometry(new BoxGeometry(width, height, thickness)),
    [width, height, thickness],
  )

  return (
    <group position={[posX, posY + height / 2, posZ]} rotation={[0, -angle, 0]}>
      <mesh>
        <boxGeometry args={boxArgs} />
        <meshStandardMaterial color={color} />
      </mesh>
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color={WALL_EDGE_COLOR} />
      </lineSegments>
    </group>
  )
}

function DoorMesh({ object, color }) {
  return (
    <WallMesh
      object={object}
      color={color}
      thickness={DOOR_THICKNESS}
      height={DOOR_HEIGHT}
    />
  )
}

function WindowMesh({ object, color }) {
  const { x, y, width, rotation } = object
  const angle = toRadians(rotation)
  const cx = x + (Math.cos(angle) * width) / 2
  const cy = y + (Math.sin(angle) * width) / 2
  const [posX, , posZ] = planTo3D(cx, cy)

  const geometry = useMemo(
    () => [width, WINDOW_HEIGHT, WINDOW_THICKNESS],
    [width],
  )

  return (
    <mesh position={[posX, WALL_HEIGHT / 2, posZ]} rotation={[0, -angle, 0]}>
      <boxGeometry args={geometry} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={WINDOW_OPACITY}
      />
    </mesh>
  )
}

function CustomMesh({ object }) {
  const { x, y, width, height, rotation = 0, customType } = object
  const height3D = CUSTOM_3D_HEIGHTS[customType] ?? CUSTOM_3D_DEFAULT_HEIGHT
  const angle = toRadians(rotation)
  const cx = x + width / 2
  const cy = y + height / 2
  const [posX, , posZ] = planTo3D(cx, cy)

  const boxArgs = useMemo(() => [width, height3D, height], [width, height3D, height])

  return (
    <mesh
      position={[posX, height3D / 2, posZ]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={boxArgs} />
      <meshStandardMaterial color={CUSTOM_3D_COLOR} />
    </mesh>
  )
}

/** Returns 4 wall segments (x, y, width, rotation) for a room's edges */
function getRoomWalls(room) {
  const { x, y, width, height, rotation = 0 } = room
  const r = toRadians(rotation)
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const c0 = [x, y]
  const c1 = [x + width * cos, y + width * sin]
  const c2 = [x + width * cos - height * sin, y + width * sin + height * cos]
  const c3 = [x - height * sin, y + height * cos]
  return [
    { x: c0[0], y: c0[1], width, rotation },
    { x: c1[0], y: c1[1], width: height, rotation: rotation + 90 },
    { x: c2[0], y: c2[1], width, rotation: rotation + 180 },
    { x: c3[0], y: c3[1], width: height, rotation: rotation + 270 },
  ]
}

function FloorPlanScene({ objects, colors, center, floorSize, cameraRef }) {
  const doorColor = DEFAULT_DOOR_COLOR
  const windowColor = DEFAULT_WINDOW_COLOR

  const visible = (objects || []).filter((obj) => obj.visible !== false)
  const target = center ?? [0, 0, 0]
  const floorExtent = Math.max(floorSize ?? FLOOR_SIZE_DEFAULT, FLOOR_SIZE_MIN) * FLOOR_SIZE_MULTIPLIER

  const roomWalls = useMemo(() => {
    const segments = []
    visible.forEach((obj) => {
      if (obj.type === 'room') {
        getRoomWalls(obj).forEach((edge, i) => {
          segments.push({ key: `${obj.id}-edge-${i}`, ...edge })
        })
      }
    })
    return segments
  }, [visible])

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 30, 20]} intensity={0.8} castShadow />
      <directionalLight position={[-20, 20, -20]} intensity={0.3} />
      <group scale={[1, 1, -1]}>
        {/* Floor plan floor – negate Z so after mirror it aligns with walls */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[target[0], 0, -target[2]]}>
          <planeGeometry args={[floorExtent, floorExtent]} />
          <meshStandardMaterial color={FLOOR_COLOR} side={DoubleSide} />
        </mesh>

        {/* Walls from room boundaries */}
        {roomWalls.map((edge) => (
          <WallMesh key={edge.key} object={edge} color={WALL_FACE_COLOR} />
        ))}

        {visible.map((obj) => {
          if (obj.type === 'wall') {
            return <WallMesh key={obj.id} object={obj} color={WALL_FACE_COLOR} />
          }
          if (obj.type === 'door') {
            return <DoorMesh key={obj.id} object={obj} color={doorColor} />
          }
          if (obj.type === 'window') {
            return <WindowMesh key={obj.id} object={obj} color={windowColor} />
          }
          if (obj.type === 'custom') {
            return <CustomMesh key={obj.id} object={obj} />
          }
          /* rooms: walls already rendered from room edges above */
          return null
        })}
      </group>

      {cameraRef && <CameraSync cameraRef={cameraRef} />}
      <OrbitControls
        makeDefault
        enablePan
        enableRotate
        enableZoom
        minDistance={ORBIT_MIN_DISTANCE}
        maxDistance={ORBIT_MAX_DISTANCE}
        target={target}
      />
    </>
  )
}

export default FloorPlanScene
