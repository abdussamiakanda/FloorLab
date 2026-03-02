import { createContext, useCallback, useContext, useRef, useState } from 'react'

const EditorNavContext = createContext(null)

export function EditorNavProvider({ children }) {
  const [planName, setPlanName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [saveState, setSaveState] = useState('Saved')
  const submitPlanNameRef = useRef(null)

  const submitPlanName = useCallback((newName) => {
    submitPlanNameRef.current?.(newName)
  }, [])

  const setSubmitPlanName = useCallback((fn) => {
    submitPlanNameRef.current = fn
  }, [])

  return (
    <EditorNavContext.Provider
      value={{
        planName,
        setPlanName,
        sidebarOpen,
        setSidebarOpen,
        saveState,
        setSaveState,
        submitPlanName,
        setSubmitPlanName,
      }}
    >
      {children}
    </EditorNavContext.Provider>
  )
}

export function useEditorNav() {
  const ctx = useContext(EditorNavContext)
  return ctx
}
