import { useMemo } from 'react'
import { BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, EdgesGeometry, Vector3 } from 'three'
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
  balcony: 60,
  table: 60,
  chair: 85,
  basin: 60,
  bed: 60,
  sofa: 60,
  wardrobe: 180,
  toilet: 60,
}
const CUSTOM_3D_DEFAULT_HEIGHT = 50
const CUSTOM_3D_COLOR = '#8b7355'
const BED_MATTRESS_COLOR = '#c4a77d'
const BED_HEADBOARD_COLOR = '#b0956f'
const BED_MATTRESS_HEIGHT_RATIO = 0.5
const BED_HEADBOARD_HEIGHT_RATIO = 1.1
const BED_HEADBOARD_THICKNESS = 6
const TABLE_TOP_THICKNESS = 5
const TABLE_LEG_SIZE = 5
const TABLE_LEG_INSET = 3
const CHAIR_SEAT_HEIGHT_RATIO = 0.5
const CHAIR_SEAT_THICKNESS = 4
const CHAIR_LEG_SIZE = 4
const CHAIR_LEG_INSET = 2
const CHAIR_BACK_THICKNESS = 4
const SOFA_SEAT_HEIGHT_RATIO = 0.45
const SOFA_BACK_THICKNESS = 10
const SOFA_ARMREST_THICKNESS = 8
const WARDROBE_DOOR_THICKNESS = 3
const WARDROBE_DOOR_GAP = 2
const WARDROBE_CORNICE_THICKNESS = 6
const WARDROBE_CORNICE_OVERHANG = 4
const TOILET_BASE_HEIGHT = 16
const TOILET_BOWL_HEIGHT = 16
const TOILET_SEAT_THICKNESS = 1
const TOILET_BASE_RADIUS_RATIO = 0.32
const TOILET_BOWL_RADIUS_RATIO = 0.45
const TOILET_TANK_WIDTH_RATIO = 0.75
const TOILET_TANK_DEPTH_RATIO = 0.35
const TOILET_CYLINDER_SEGMENTS = 24
const BASIN_TOP_THICKNESS = 5
const BASIN_TOP_LEVEL_RATIO = 0.6
const BASIN_BOTTOM_RADIUS_RATIO = 0.4
const BASIN_CYLINDER_SEGMENTS = 24
const BALCONY_DECK_THICKNESS = 1
const BALCONY_RAILING_HEIGHT = 65
const BALCONY_RAILING_THICKNESS = 4

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

/** Sofa shape: seat cushion, back on -Z, two armrests at ±X */
function SofaShape({ width, height, height3D }) {
  const seatY = height3D * SOFA_SEAT_HEIGHT_RATIO
  const seatCenterY = seatY / 2
  const backH = height3D - seatY
  const backCenterY = seatY + backH / 2
  const backZ = -height / 2 + SOFA_BACK_THICKNESS / 2
  const armH = backH
  const armCenterY = backCenterY
  const armX = width / 2 - SOFA_ARMREST_THICKNESS / 2

  return (
    <group>
      <mesh position={[0, seatCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, seatY, height]} />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} />
      </mesh>
      <mesh position={[0, backCenterY, backZ]} castShadow receiveShadow>
        <boxGeometry args={[width, backH, SOFA_BACK_THICKNESS]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
      <mesh position={[-armX, armCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[SOFA_ARMREST_THICKNESS, armH, height]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
      <mesh position={[armX, armCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[SOFA_ARMREST_THICKNESS, armH, height]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
    </group>
  )
}

/** Wardrobe shape: tall body, top cornice, two door panels on front (+Z) */
function WardrobeShape({ width, height, height3D }) {
  const bodyY = height3D / 2
  const corniceY = height3D + WARDROBE_CORNICE_THICKNESS / 2
  const corniceW = width + 2 * WARDROBE_CORNICE_OVERHANG
  const corniceD = height + 2 * WARDROBE_CORNICE_OVERHANG
  const doorZ = height / 2 - WARDROBE_DOOR_THICKNESS / 2
  const doorW = (width - WARDROBE_DOOR_GAP) / 2
  const doorH = height3D - 4
  const doorY = height3D / 2
  const leftDoorX = -WARDROBE_DOOR_GAP / 2 - doorW / 2
  const rightDoorX = WARDROBE_DOOR_GAP / 2 + doorW / 2

  return (
    <group>
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height3D, height]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
      <mesh position={[0, corniceY, 0]} castShadow receiveShadow>
        <boxGeometry args={[corniceW, WARDROBE_CORNICE_THICKNESS, corniceD]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
      <mesh position={[leftDoorX, doorY, doorZ]} castShadow receiveShadow>
        <boxGeometry args={[doorW, doorH, WARDROBE_DOOR_THICKNESS]} />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} />
      </mesh>
      <mesh position={[rightDoorX, doorY, doorZ]} castShadow receiveShadow>
        <boxGeometry args={[doorW, doorH, WARDROBE_DOOR_THICKNESS]} />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} />
      </mesh>
    </group>
  )
}

/** Basin shape: two parts. Top = semicircle (object radius) with fixed thickness. Bottom = semicircle (smaller radius) from floor to top. */
function BasinShape({ width, height, height3D }) {
  const maxSize = Math.max(width, height)
  const topRadius = maxSize / 2
  const bottomRadius = topRadius * BASIN_BOTTOM_RADIUS_RATIO
  const topLevel = height3D * BASIN_TOP_LEVEL_RATIO
  const topCenterY = topLevel + BASIN_TOP_THICKNESS / 2
  const bottomHeight = topLevel
  const bottomCenterY = bottomHeight / 2

  return (
    <group>
      {/* Bottom: vertical semicircle, same orientation as top (curved part +Z, flat at -Z) */}
      <mesh position={[0, bottomCenterY, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[
            bottomRadius,
            bottomRadius,
            bottomHeight,
            BASIN_CYLINDER_SEGMENTS,
            1,
            false,
            -Math.PI / 2,
            Math.PI,
          ]}
        />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} side={DoubleSide} />
      </mesh>
      {/* Top: horizontal semicircle, object radius, fixed thickness */}
      <mesh
        position={[0, topCenterY, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[
            topRadius,
            topRadius,
            BASIN_TOP_THICKNESS,
            BASIN_CYLINDER_SEGMENTS,
            1,
            false,
            0,
            Math.PI,
          ]}
        />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/** Toilet shape: round base (smaller), round bowl, round seat, tank on back (-Z) */
function ToiletShape({ width, height, height3D }) {
  const minSize = Math.min(width, height)
  const baseRadius = minSize * TOILET_BASE_RADIUS_RATIO
  const bowlRadius = minSize * TOILET_BOWL_RADIUS_RATIO

  const baseY = TOILET_BASE_HEIGHT / 2
  const bowlY = TOILET_BASE_HEIGHT + TOILET_BOWL_HEIGHT / 2
  const seatY = TOILET_BASE_HEIGHT + TOILET_BOWL_HEIGHT + TOILET_SEAT_THICKNESS / 2

  const tankW = width * TOILET_TANK_WIDTH_RATIO
  const tankD = height * TOILET_TANK_DEPTH_RATIO
  const tankH = height3D - TOILET_BASE_HEIGHT
  const tankCenterY = TOILET_BASE_HEIGHT + tankH / 2
  const tankZ = -height / 2 + tankD / 2

  return (
    <group>
      <mesh position={[0, baseY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[baseRadius, baseRadius, TOILET_BASE_HEIGHT, TOILET_CYLINDER_SEGMENTS]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
      <mesh position={[0, bowlY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[bowlRadius, bowlRadius, TOILET_BOWL_HEIGHT, TOILET_CYLINDER_SEGMENTS]} />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} />
      </mesh>
      <mesh position={[0, seatY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[bowlRadius, bowlRadius, TOILET_SEAT_THICKNESS, TOILET_CYLINDER_SEGMENTS]} />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} />
      </mesh>
      <mesh position={[0, tankCenterY, tankZ]} castShadow receiveShadow>
        <boxGeometry args={[tankW, tankH, tankD]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
    </group>
  )
}

/** Chair shape: seat, 4 legs, back rest on local -Z */
function ChairShape({ width, height, height3D }) {
  const seatY = height3D * CHAIR_SEAT_HEIGHT_RATIO
  const legH = seatY
  const legY = legH / 2
  const seatCenterY = seatY + CHAIR_SEAT_THICKNESS / 2
  const backH = height3D - seatY - CHAIR_SEAT_THICKNESS
  const backCenterY = seatY + CHAIR_SEAT_THICKNESS + backH / 2
  const backZ = -height / 2 + CHAIR_BACK_THICKNESS / 2
  const half = CHAIR_LEG_SIZE / 2
  const inset = CHAIR_LEG_INSET
  const legPositions = [
    [-width / 2 + half + inset, legY, -height / 2 + half + inset],
    [width / 2 - half - inset, legY, -height / 2 + half + inset],
    [width / 2 - half - inset, legY, height / 2 - half - inset],
    [-width / 2 + half + inset, legY, height / 2 - half - inset],
  ]

  return (
    <group>
      <mesh position={[0, seatCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, CHAIR_SEAT_THICKNESS, height]} />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} />
      </mesh>
      {legPositions.map((pos, i) => (
        <mesh key={i} position={pos} castShadow receiveShadow>
          <boxGeometry args={[CHAIR_LEG_SIZE, legH, CHAIR_LEG_SIZE]} />
          <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
        </mesh>
      ))}
      <mesh position={[0, backCenterY, backZ]} castShadow receiveShadow>
        <boxGeometry args={[width, backH, CHAIR_BACK_THICKNESS]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
    </group>
  )
}

/** Balcony shape: deck (floor) + railing on 3 sides (front -Z, left -X, right +X), wall face + edge color */
function BalconyShape({ width, height, height3D }) {
  const deckY = BALCONY_DECK_THICKNESS / 2
  const railY = BALCONY_DECK_THICKNESS + BALCONY_RAILING_HEIGHT / 2
  const t = BALCONY_RAILING_THICKNESS / 2

  const deckEdges = useMemo(
    () => new EdgesGeometry(new BoxGeometry(width, BALCONY_DECK_THICKNESS, height)),
    [width, height],
  )
  const frontRailEdges = useMemo(
    () => new EdgesGeometry(new BoxGeometry(width, BALCONY_RAILING_HEIGHT, BALCONY_RAILING_THICKNESS)),
    [width],
  )
  const sideRailEdges = useMemo(
    () => new EdgesGeometry(new BoxGeometry(BALCONY_RAILING_THICKNESS, BALCONY_RAILING_HEIGHT, height)),
    [height],
  )

  return (
    <group>
      <group position={[0, deckY, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, BALCONY_DECK_THICKNESS, height]} />
          <meshStandardMaterial color={WALL_FACE_COLOR} />
        </mesh>
        <lineSegments geometry={deckEdges}>
          <lineBasicMaterial color={WALL_EDGE_COLOR} />
        </lineSegments>
      </group>
      {/* Front (-Z) */}
      <group position={[0, railY, -height / 2 + t]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, BALCONY_RAILING_HEIGHT, BALCONY_RAILING_THICKNESS]} />
          <meshStandardMaterial color={WALL_FACE_COLOR} />
        </mesh>
        <lineSegments geometry={frontRailEdges}>
          <lineBasicMaterial color={WALL_EDGE_COLOR} />
        </lineSegments>
      </group>
      {/* Left (-X) */}
      <group position={[-width / 2 + t, railY, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[BALCONY_RAILING_THICKNESS, BALCONY_RAILING_HEIGHT, height]} />
          <meshStandardMaterial color={WALL_FACE_COLOR} />
        </mesh>
        <lineSegments geometry={sideRailEdges}>
          <lineBasicMaterial color={WALL_EDGE_COLOR} />
        </lineSegments>
      </group>
      {/* Right (+X) */}
      <group position={[width / 2 - t, railY, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[BALCONY_RAILING_THICKNESS, BALCONY_RAILING_HEIGHT, height]} />
          <meshStandardMaterial color={WALL_FACE_COLOR} />
        </mesh>
        <lineSegments geometry={sideRailEdges}>
          <lineBasicMaterial color={WALL_EDGE_COLOR} />
        </lineSegments>
      </group>
    </group>
  )
}

/** Table shape: thin top on +y and 4 legs at corners */
function TableShape({ width, height, height3D }) {
  const topThick = TABLE_TOP_THICKNESS
  const legH = height3D - topThick
  const legY = legH / 2
  const topY = height3D - topThick / 2
  const half = TABLE_LEG_SIZE / 2
  const inset = TABLE_LEG_INSET
  const legPositions = [
    [-width / 2 + half + inset, legY, -height / 2 + half + inset],
    [width / 2 - half - inset, legY, -height / 2 + half + inset],
    [width / 2 - half - inset, legY, height / 2 - half - inset],
    [-width / 2 + half + inset, legY, height / 2 - half - inset],
  ]

  return (
    <group>
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, topThick, height]} />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} />
      </mesh>
      {legPositions.map((pos, i) => (
        <mesh key={i} position={pos} castShadow receiveShadow>
          <boxGeometry args={[TABLE_LEG_SIZE, legH, TABLE_LEG_SIZE]} />
          <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
        </mesh>
      ))}
    </group>
  )
}

/** Bed shape: mattress + headboard on a fixed end (local -X), flush with bed edge */
function BedShape({ width, height, height3D }) {
  const mattressH = height3D * BED_MATTRESS_HEIGHT_RATIO
  const headboardH = height3D * BED_HEADBOARD_HEIGHT_RATIO
  const headX = -width / 2 + BED_HEADBOARD_THICKNESS / 2

  return (
    <group>
      <mesh position={[0, mattressH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, mattressH, height]} />
        <meshStandardMaterial color={BED_MATTRESS_COLOR} />
      </mesh>
      <mesh position={[headX, headboardH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BED_HEADBOARD_THICKNESS, headboardH, height]} />
        <meshStandardMaterial color={BED_HEADBOARD_COLOR} />
      </mesh>
    </group>
  )
}

function CustomMesh({ object }) {
  const { x, y, width, height, rotation = 0, customType } = object
  const height3D = CUSTOM_3D_HEIGHTS[customType] ?? CUSTOM_3D_DEFAULT_HEIGHT
  const angle = toRadians(rotation)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  // Center of rotated rect (2D pivot is top-left, so center = pivot + rotated (width/2, height/2))
  const cx = x + (width / 2) * cos - (height / 2) * sin
  const cy = y + (width / 2) * sin + (height / 2) * cos
  const [posX, , posZ] = planTo3D(cx, cy)

  const boxArgs = useMemo(() => [width, height3D, height], [width, height3D, height])

  const isBed = customType === 'bed'
  const isTable = customType === 'table'
  const isChair = customType === 'chair'
  const isSofa = customType === 'sofa'
  const isWardrobe = customType === 'wardrobe'
  const isToilet = customType === 'toilet'
  const isBasin = customType === 'basin'
  const isBalcony = customType === 'balcony'
  // Bed/table/chair/sofa/wardrobe/toilet/basin/balcony have bottom at local y=0; other objects use center at height3D/2
  const posY = isBed || isTable || isChair || isSofa || isWardrobe || isToilet || isBasin || isBalcony ? 0 : height3D / 2

  return (
    <group
      position={[posX, posY, posZ]}
      rotation={[0, -angle, 0]}
    >
      {isBed ? (
        <BedShape width={width} height={height} height3D={height3D} />
      ) : isTable ? (
        <TableShape width={width} height={height} height3D={height3D} />
      ) : isChair ? (
        <ChairShape width={width} height={height} height3D={height3D} />
      ) : isSofa ? (
        <SofaShape width={width} height={height} height3D={height3D} />
      ) : isWardrobe ? (
        <WardrobeShape width={width} height={height} height3D={height3D} />
      ) : isToilet ? (
        <ToiletShape width={width} height={height} height3D={height3D} />
      ) : isBasin ? (
        <BasinShape width={width} height={height} height3D={height3D} />
      ) : isBalcony ? (
        <BalconyShape width={width} height={height} height3D={height3D} />
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={boxArgs} />
          <meshStandardMaterial color={CUSTOM_3D_COLOR} />
        </mesh>
      )}
    </group>
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
