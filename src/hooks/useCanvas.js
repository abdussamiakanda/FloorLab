import { useCallback, useReducer } from 'react'

const MAX_HISTORY = 50

const initialState = {
  objects: [],
  selectedTool: 'select',
  selectedObjectId: null,
  wallDraft: null,
  history: [[]],
  historyIndex: 0,
}

const pushHistory = (state, nextObjects) => {
  const truncated = state.history.slice(0, state.historyIndex + 1)
  const nextHistory = [...truncated, nextObjects]
  const trimmed = nextHistory.slice(-MAX_HISTORY)

  return {
    history: trimmed,
    historyIndex: trimmed.length - 1,
  }
}

const canvasReducer = (state, action) => {
  switch (action.type) {
    case 'RESET_PLAN': {
      const nextObjects = action.payload ?? []
      return {
        ...state,
        objects: nextObjects,
        selectedObjectId: null,
        wallDraft: null,
        history: [nextObjects],
        historyIndex: 0,
      }
    }
    case 'SET_TOOL':
      return {
        ...state,
        selectedTool: action.payload,
        wallDraft: null,
      }
    case 'SET_WALL_DRAFT':
      return {
        ...state,
        wallDraft: action.payload,
      }
    case 'SELECT_OBJECT':
      return {
        ...state,
        selectedObjectId: action.payload,
      }
    case 'ADD_OBJECT': {
      const nextObjects = [...state.objects, action.payload]
      const nextHistory = pushHistory(state, nextObjects)

      return {
        ...state,
        objects: nextObjects,
        selectedObjectId: action.payload.id,
        wallDraft: null,
        ...nextHistory,
      }
    }
    case 'UPDATE_OBJECT': {
      const nextObjects = state.objects.map((object) =>
        object.id === action.payload.id ? { ...object, ...action.payload.patch } : object,
      )
      const nextHistory = pushHistory(state, nextObjects)

      return {
        ...state,
        objects: nextObjects,
        ...nextHistory,
      }
    }
    case 'DELETE_OBJECT': {
      const nextObjects = state.objects.filter((object) => object.id !== action.payload)
      const nextHistory = pushHistory(state, nextObjects)

      return {
        ...state,
        objects: nextObjects,
        selectedObjectId: null,
        ...nextHistory,
      }
    }
    case 'UNDO': {
      if (state.historyIndex <= 0) {
        return state
      }

      const nextIndex = state.historyIndex - 1
      return {
        ...state,
        objects: state.history[nextIndex],
        historyIndex: nextIndex,
        selectedObjectId: null,
      }
    }
    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) {
        return state
      }

      const nextIndex = state.historyIndex + 1
      return {
        ...state,
        objects: state.history[nextIndex],
        historyIndex: nextIndex,
        selectedObjectId: null,
      }
    }
    default:
      return state
  }
}

export function useCanvas() {
  const [state, dispatch] = useReducer(canvasReducer, initialState)

  const resetPlan = useCallback((objects) => dispatch({ type: 'RESET_PLAN', payload: objects }), [])
  const setTool = useCallback((tool) => dispatch({ type: 'SET_TOOL', payload: tool }), [])
  const setWallDraft = useCallback((draft) => dispatch({ type: 'SET_WALL_DRAFT', payload: draft }), [])
  const selectObject = useCallback((objectId) => dispatch({ type: 'SELECT_OBJECT', payload: objectId }), [])
  const addObject = useCallback((object) => dispatch({ type: 'ADD_OBJECT', payload: object }), [])
  const updateObject = useCallback(
    (id, patch) => dispatch({ type: 'UPDATE_OBJECT', payload: { id, patch } }),
    [],
  )
  const deleteObject = useCallback((id) => dispatch({ type: 'DELETE_OBJECT', payload: id }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  // Return directly - all callbacks are stable, state changes are expected
  return {
    state,
    resetPlan,
    setTool,
    setWallDraft,
    selectObject,
    addObject,
    updateObject,
    deleteObject,
    undo,
    redo,
  }
}
