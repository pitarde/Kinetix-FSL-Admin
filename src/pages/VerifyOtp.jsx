import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useOtp } from '../OtpContext'
import { useTheme } from '../ThemeContext'
import { Card, Btn } from '../components/ui'
import logoMarkLight from '../assets/logo-mark-light.svg'
import logoMarkDark from '../assets/logo-mark-dark.svg'

const RESEND_COOLDOWN_S = 60

export default function VerifyOtp() {
  const { user, logout } = useAuth()
  const { sendOtp, verifyOtp, isOtpVerified, sending } = useOtp()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  if (!user) return <Navigate to="/login" replace />
  if (isOtpVerified(user)) return <Navigate to="/" replace />

  const logoMark = theme === 'dark' ? logoMarkDark : logoMarkLight

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await verifyOtp(user, code)
      if (result.ok) {
        navigate('/')
        return
      }
      if (result.reason === 'expired') {
        setError('Code expired. Request a new one.')
      } else if (result.reason === 'locked') {
        setError('Too many failed attempts. Request a new code.')
      } else {
        setError(`Incorrect code. ${result.remaining} attempt(s) left.`)
      }
    } finally {
      setSubmitting(false)
      setCode('')
    }
  }

  async function handleResend() {
    setError('')
    await sendOtp(user)
    setCooldown(RESEND_COOLDOWN_S)
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  async function handleCancel() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={logoMark} alt="" className="w-14 h-14 mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Verify it's you</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            A 6-digit code was sent to <span className="font-medium text-slate-700 dark:text-slate-300">{user.email}</span>.
            It expires in 5 minutes.
          </p>
        </div>

        <form onSubmit={handleVerify}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full text-center tracking-[0.5em] text-lg font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />

          {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-4">{error}</p>}

          <Btn type="submit" variant="primary" size="lg" disabled={submitting || code.length !== 6} className="w-full">
            {submitting ? 'Verifying…' : 'Verify'}
          </Btn>

          <button
            type="button"
            onClick={handleResend}
            disabled={sending || cooldown > 0}
            className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-4 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            className="w-full text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:underline mt-2"
          >
            Cancel and sign out
          </button>
        </form>
      </Card>
    </div>
  )
}
