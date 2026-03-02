import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CanvasEditor from '../components/CanvasEditor'
import { useEditorNav } from '../context/EditorNavContext'
import { useAuth } from '../context/AuthContext'
import { useFirestore } from '../hooks/useFirestore'

const DEFAULT_COLORS = {
  wall: '#111827',
  door: '#16a34a',
  window: '#7c3aed',
  room: '#3b82f6',
}

function Editor() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const editorNav = useEditorNav()
  const { fetchPlanById, savePlan, loading, error } = useFirestore()

  const [planName, setPlanName] = useState('')
  const [objects, setObjects] = useState([])
  const [colors, setColors] = useState(DEFAULT_COLORS)
  const [isReady, setIsReady] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [lastSavedSignature, setLastSavedSignature] = useState(
    JSON.stringify({ objects: [], colors: DEFAULT_COLORS }),
  )
  const [saveState, setSaveState] = useState('Saved')

  // Sync to navbar context
  useEffect(() => {
    if (!editorNav) return
    editorNav.setPlanName(planName)
  }, [planName, editorNav])

  useEffect(() => {
    if (!editorNav) return
    editorNav.setSaveState(saveState)
  }, [saveState, editorNav])

  useEffect(() => {
    return () => {
      if (editorNav) {
        editorNav.setPlanName('')
        editorNav.setSaveState('Saved')
        editorNav.setSubmitPlanName(null)
      }
    }
  }, [editorNav])

  // Register callback for navbar title edit → save to Firestore
  useEffect(() => {
    if (!editorNav || !planId) return
    editorNav.setSubmitPlanName((newName) => {
      const name = (newName || '').trim() || 'Untitled Plan'
      setPlanName(name)
      savePlan(planId, { name, objects, colors })
    })
    return () => editorNav.setSubmitPlanName(null)
  }, [editorNav, planId, objects, savePlan])

  const handleObjectsChange = useCallback((nextObjects) => {
    setObjects(nextObjects)
  }, [])

  // Deterministic stringify (sort keys) so same data always gives same signature
  const stableStringify = (obj) => {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
    if (Array.isArray(obj)) return '[' + obj.map((item) => stableStringify(item)).join(',') + ']'
    const keys = Object.keys(obj).sort()
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
  }

  const objectsSignature = useMemo(
    () => stableStringify({ objects, colors }),
    [objects, colors],
  )
  const hasUnsavedChanges = objectsSignature !== lastSavedSignature

  // Show "Saved" whenever there are no unsaved changes
  useEffect(() => {
    if (isReady && !hasUnsavedChanges) {
      setSaveState('Saved')
    }
  }, [isReady, hasUnsavedChanges])

  useEffect(() => {
    console.log('Editor state:', {
      isReady,
      hasUnsavedChanges,
      objectsCount: objects.length,
      objectsSignature: objectsSignature.substring(0, 50),
      lastSavedSignature: lastSavedSignature.substring(0, 50),
    })
  }, [hasUnsavedChanges, isReady, objects.length, objectsSignature, lastSavedSignature])

  // Load plan only once on mount
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (hasLoadedRef.current) {
      return
    }
    hasLoadedRef.current = true

    const loadPlan = async () => {
      console.log('Loading plan:', planId)
      const plan = await fetchPlanById(planId)

      if (!plan) {
        navigate('/')
        return
      }

      const nextObjects = Array.isArray(plan.objects) ? plan.objects : []
      const nextColors = {
        ...DEFAULT_COLORS,
        ...(plan.colors || {}),
      }
      const email = (user?.email || '').toLowerCase()
      const role = plan.createdBy === user?.uid ? 'owner' : (plan.collaborators?.[email] || 'viewer')
      setReadOnly(role === 'viewer')
      setPlanName(plan.name || 'Untitled Plan')
      setObjects(nextObjects)
      setColors(nextColors)
      setLastSavedSignature(stableStringify({ objects: nextObjects, colors: nextColors }))
      setSaveState('Saved')
      setIsReady(true)
    }

    loadPlan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  const saveNow = useCallback(async () => {
    if (!hasUnsavedChanges) {
      console.log('Save skipped: no changes')
      return
    }

    console.log('Saving plan:', planId, 'with', objects.length, 'objects')
    setSaveState('Saving...')
    try {
      await savePlan(planId, { name: planName, objects, colors })
      setLastSavedSignature(objectsSignature)
      setSaveState('Saved')
      console.log('Save successful')
    } catch (saveError) {
      console.error('Save failed:', saveError)
      setSaveState('Save failed')
    }
  }, [hasUnsavedChanges, objects, colors, objectsSignature, planId, planName, savePlan])

  // Autosave with ref-based approach to avoid dependency issues
  const autosaveTimeoutRef = useRef(null)
  useEffect(() => {
    if (!isReady) {
      return
    }

    if (!hasUnsavedChanges) {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
        autosaveTimeoutRef.current = null
      }
      return
    }

    console.log('Autosave scheduled in 10 seconds...')
    setSaveState('Unsaved changes')

    // Clear any existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    // Set new timeout – save 10s after the last change
    autosaveTimeoutRef.current = setTimeout(async () => {
      console.log('Autosave triggered')
      if (!hasUnsavedChanges) {
        console.log('Autosave cancelled: no changes')
        return
      }

      setSaveState('Saving...')
      try {
        await savePlan(planId, { name: planName, objects, colors })
        setLastSavedSignature(stableStringify({ objects, colors }))
        setSaveState('Saved')
        console.log('Autosave successful')
      } catch (saveError) {
        console.error('Autosave failed:', saveError)
        setSaveState('Autosave failed')
      }
    }, 10000)

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [hasUnsavedChanges, isReady, objects, colors, objectsSignature, planId, planName, savePlan])

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(objects, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${planName || 'floorplan'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!isReady) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-spinner" aria-hidden />
        <p className="loading-message">Loading plan…</p>
      </div>
    )
  }

  return (
    <section className="editor-page">
      <CanvasEditor
        key={planId}
        initialObjects={objects}
        onObjectsChange={handleObjectsChange}
        onSave={saveNow}
        onExportJson={handleExportJson}
        planName={planName}
        saveState={saveState}
        colors={colors}
        onColorsChange={setColors}
        readOnly={readOnly}
      />
    </section>
  )
}

export default Editor
