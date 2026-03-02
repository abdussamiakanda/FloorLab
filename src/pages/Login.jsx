import { useState } from 'react'
import { AlertTriangle, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function Login() {
  const { signInWithGoogle } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)

    try {
      await signInWithGoogle()
    } catch (authError) {
      const message = authError.message || 'Unable to sign in with Google.'
      if (message.includes('permission')) {
        setError('You don\'t have access to this app, or Firestore rules need to be deployed.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center-screen login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/favicon.svg" alt="" className="logo-icon" width={48} height={48} aria-hidden />
          <h1>FloorLab</h1>
          <p className="login-subtitle">Create professional 2D floor plans with ease</p>
        </div>

        <div className="login-content">
          <p className="login-description">Sign in to create, edit, and manage your floor plans from anywhere.</p>
          
          {error && (
            <div className="error-banner">
              <span className="error-icon" aria-hidden><AlertTriangle size={20} /></span>
              <p className="error-text">{error}</p>
            </div>
          )}

          <button type="button" className="google-signin-btn" onClick={handleLogin} disabled={loading}>
            <span className="google-icon" aria-hidden><LogIn size={20} /></span>
            <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
