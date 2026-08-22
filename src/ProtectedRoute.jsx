import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useOtp } from './OtpContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { isOtpVerified } = useOtp()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isOtpVerified(user)) {
    return <Navigate to="/verify-otp" replace />
  }

  return children
}
