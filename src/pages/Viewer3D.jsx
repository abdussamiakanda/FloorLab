import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Vector3 } from 'three'
import { Canvas } from '@react-three/fiber'
import { useFirestore } from '../hooks/useFirestore'
import { useEditorNav } from '../context/EditorNavContext'
import { getPlanBounds, CornerAxesScene, CAMERA_FAR } from '../components/Scene3D'
import Scene3D from '../components/Scene3D'

function Viewer3D() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const editorNav = useEditorNav()
  const { fetchPlanById } = useFirestore()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!planId) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchPlanById(planId)
      .then((data) => {
        if (!cancelled) setPlan(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load plan.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when planId changes; fetchPlanById is unstable
  }, [planId])

  const objects = plan?.objects ?? []
  const colors = plan?.colors ?? {}
  const bounds = useMemo(() => getPlanBounds(objects), [objects])
  const cameraPosition = useMemo(() => {
    const [cx, , cz] = bounds.center
    const dist = Math.max(bounds.size * 1.2, 80)
    return [cx + dist * 0.6, dist * 0.8, -cz + dist * 0.6]
  }, [bounds])
  const sceneCenter = useMemo(
    () => [bounds.center[0], bounds.center[1], -bounds.center[2]],
    [bounds.center],
  )
  const cameraRef = useRef(new Vector3())

  useEffect(() => {
    if (!editorNav) return
    editorNav.setPlanName(plan?.name ?? '')
  }, [plan?.name, editorNav])

  useEffect(() => {
    return () => {
      if (editorNav) editorNav.setPlanName('')
    }
  }, [editorNav])

  if (loading) {
    return (
      <section className="viewer-3d-page">
        <div className="viewer-3d-loading">
          <div className="loading-spinner" aria-hidden />
          <p>Loading plan…</p>
        </div>
      </section>
    )
  }

  if (error || !plan) {
    return (
      <section className="viewer-3d-page">
        <div className="viewer-3d-placeholder">
          <h1>3D View</h1>
          <p className="viewer-3d-error">{error || 'Plan not found.'}</p>
          <button
            type="button"
            className="viewer-3d-back-btn"
            onClick={() => navigate('/')}
          >
            Back to dashboard
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="viewer-3d-page">
      <div className="viewer-3d-canvas-wrap">
        <Canvas
          style={{ width: '100%', height: '100%', display: 'block' }}
          camera={{
            position: cameraPosition,
            fov: 50,
            near: 0.1,
            far: CAMERA_FAR,
          }}
          gl={{ antialias: true }}
        >
          <Scene3D
            objects={objects}
            colors={colors}
            center={sceneCenter}
            floorSize={bounds.size}
            cameraRef={cameraRef}
          />
        </Canvas>
        <div className="viewer-3d-axes-corner" aria-hidden>
          <Canvas
            camera={{ position: [2, 2, 2], fov: 50, near: 0.01, far: 10 }}
            gl={{ alpha: true, antialias: true }}
            style={{ background: 'transparent' }}
          >
            <CornerAxesScene cameraRef={cameraRef} />
          </Canvas>
        </div>
      </div>
    </section>
  )
}

export default Viewer3D
