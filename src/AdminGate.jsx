import { useNavigate } from 'react-router-dom'
import { useAdmin } from './AdminContext'
import { useAuth } from './AuthContext'
import { useOtp } from './OtpContext'

/**
 * Sits between authentication and the console. A signed-in, OTP-verified user
 * still needs an `admins/{uid}` allowlist entry to see anything — the same
 * check the Firestore rules enforce server-side. Non-admins get a clear
 * "not authorized" screen rather than a wall of permission errors.
 */
export default function AdminGate({ children }) {
  const { checking, isAdmin } = useAdmin()
  const { user, logout } = useAuth()
  const { clearOtpVerification } = useOtp()
  const navigate = useNavigate()

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950">
        Checking admin access…
      </div>
    )
  }

  if (!isAdmin) {
    async function signOut() {
      clearOtpVerification(user)
      await logout()
      navigate('/login')
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md text-center bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
          <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto mb-4 text-2xl">🔒</div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Not authorized</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">{user?.email}</span> isn't an admin.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Ask an existing admin to add your account to the <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">admins</code> allowlist.
          </p>
          <button
            onClick={signOut}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return children
}
