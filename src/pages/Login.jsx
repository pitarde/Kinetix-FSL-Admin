import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useOtp } from '../OtpContext'
import logoMark from '../assets/logo-mark-dark.svg'
import './Login.css'

const REMEMBER_KEY = 'kinetix_admin_remember_email'

export default function Login() {
  const { login, resetPassword } = useAuth()
  const { sendOtp } = useOtp()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setEmail(saved)
      setRemember(true)
    }
  }, [])

  async function handleSignIn(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const cred = await login(email, password)
      await sendOtp(cred.user)

      if (remember) {
        localStorage.setItem(REMEMBER_KEY, email)
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }

      navigate('/verify-otp')
    } catch (err) {
      setError('Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      await resetPassword(email)
      setMessage('Password reset email sent — check your inbox.')
    } catch (err) {
      setError('Could not send reset email. Check the address and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setMessage('')
  }

  return (
    <div className="kinetix-login-page">
      <div className="shell">
        {/* LEFT BRAND PANEL */}
        <div className="brand">
          <div>
            <div className="brand-mark">
              <div className="logo">
                <img src={logoMark} alt="" />
              </div>
              <span>KINETIX FSL</span>
              <span className="tag">ADMIN CONSOLE</span>
            </div>

            <div className="brand-copy">
              <h1>
                Every sign, every learner,
                <br />
                <span className="accent">validated.</span>
              </h1>
              <p>
                Sign in to validate community sign videos, moderate reports and manage
                Kinetix FSL learners in real time.
              </p>
            </div>

            <div className="route-wrap">
              <svg viewBox="0 0 440 210">
                <path
                  className="route-path"
                  d="M18,190 C 70,150 60,70 130,58 C 210,44 230,120 300,110 C 360,102 372,150 420,150"
                />

                <g className="route-node">
                  <circle cx="18" cy="190" r="8" className="ring" />
                  <circle cx="18" cy="190" r="3.2" className="dot" />
                  <text x="30" y="194">SUBMITTED</text>
                </g>

                <g className="route-node">
                  <circle cx="130" cy="58" r="8" className="ring" />
                  <circle cx="130" cy="58" r="3.2" className="dot" />
                  <text x="142" y="54">SIGN-014</text>
                </g>

                <g className="route-node">
                  <circle cx="300" cy="110" r="8" className="ring" />
                  <circle cx="300" cy="110" r="3.2" className="dot" />
                  <text x="312" y="106">SIGN-028</text>
                </g>

                <g className="route-node">
                  <circle cx="420" cy="150" r="8" className="ring" />
                  <circle cx="420" cy="150" r="3.2" className="dot" />
                  <text x="398" y="172">VALIDATED</text>
                </g>

                <circle r="4.5" className="pulse" />
              </svg>
            </div>
          </div>

          <div className="stat-rail">
            <div>
              <span className="num">56</span>
              <span className="lbl">SIGNS IN VOCABULARY</span>
            </div>
            <div>
              <span className="num up">1,204</span>
              <span className="lbl">ACTIVE LEARNERS</span>
            </div>
            <div>
              <span className="num good">312</span>
              <span className="lbl">VALIDATED VIDEOS</span>
            </div>
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="form-panel">
          <div className="form-inner">
            <span className="eyebrow">Admin sign in</span>
            <h2>{mode === 'signin' ? 'Welcome back' : 'Reset your password'}</h2>
            <p className="sub">
              {mode === 'signin'
                ? 'Sign in to your Kinetix FSL admin console to validate content, moderate the community and manage learners.'
                : "Enter your admin email and we'll send you a reset link."}
            </p>

            <form onSubmit={mode === 'signin' ? handleSignIn : handleReset}>
              <div className="field">
                <label htmlFor="email">Admin email</label>
                <div className="input-wrap">
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@kinetixfsl.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {mode === 'signin' && (
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrap">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="toggle-pass"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.6 10.6 0 0 1 12 4c7 0 11 8 11 8a18.7 18.7 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <path d="M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signin' ? (
                <div className="row-between">
                  <label className="remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <button type="button" className="link" onClick={() => switchMode('reset')}>
                    Forgot password?
                  </button>
                </div>
              ) : (
                <div className="row-between">
                  <button type="button" className="link" onClick={() => switchMode('signin')}>
                    Back to sign in
                  </button>
                </div>
              )}

              {error && <p className="error-note">{error}</p>}
              {message && <p className="success-note">{message}</p>}

              <button type="submit" className="submit" disabled={submitting}>
                {submitting
                  ? mode === 'signin'
                    ? 'Signing in...'
                    : 'Sending...'
                  : mode === 'signin'
                  ? 'Sign in to console'
                  : 'Send reset email'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>

            <div className="divider"><span>SECURITY</span></div>

            <div className="security-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Protected by Firebase Auth · Email verification required
            </div>

            <p className="help-line">
              Having trouble signing in? <a href="mailto:pitardeken2024@gmail.com">Contact the Kinetix FSL dev team</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
