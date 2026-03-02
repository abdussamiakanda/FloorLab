import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { EditorNavProvider } from './context/EditorNavContext.jsx'
import Editor from './pages/Editor.jsx'
import Viewer3D from './pages/Viewer3D.jsx'
import Login from './pages/Login.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-spinner" aria-hidden />
        <p className="loading-message">Loading session…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PrivateLayout() {
  return (
    <ProtectedRoute>
      <EditorNavProvider>
        <div className="app-shell">
          <Navbar />
          <main className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/editor/:planId" element={<Editor />} />
              <Route path="/3d/:planId" element={<Viewer3D />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </EditorNavProvider>
    </ProtectedRoute>
  )
}

function App() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/*" element={<PrivateLayout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
