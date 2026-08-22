import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useOtp } from './OtpContext'
import { useTheme } from './ThemeContext'
import { subscribeOpenReportsCount, subscribePendingValidationCount } from './firestore/stats'
import logoMarkLight from './assets/logo-mark-light.svg'
import logoMarkDark from './assets/logo-mark-dark.svg'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/validation', label: 'Content Validation', badgeKey: 'pendingValidation' },
  { to: '/reports', label: 'Reports & Moderation', badgeKey: 'openReports' },
  { to: '/content', label: 'Content Management' },
  { to: '/users', label: 'User Management' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/broadcast', label: 'Broadcast' },
  { to: '/audit-log', label: 'Audit Log' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { clearOtpVerification } = useOtp()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const logoMark = theme === 'dark' ? logoMarkDark : logoMarkLight

  // Live count of open reports, shown as a badge on the nav item and in the
  // browser tab title so an admin notices new reports without being on the
  // Reports page. Updates in realtime — no polling.
  const [openReports, setOpenReports] = useState(0)
  const [pendingValidation, setPendingValidation] = useState(0)
  useEffect(() => subscribeOpenReportsCount(setOpenReports, () => setOpenReports(0)), [])
  useEffect(() => subscribePendingValidationCount(setPendingValidation, () => setPendingValidation(0)), [])

  useEffect(() => {
    const pending = openReports + pendingValidation
    document.title = pending > 0
      ? `(${pending}) Kinetix FSL Admin`
      : 'Kinetix FSL Admin'
  }, [openReports, pendingValidation])

  const badgeCounts = { openReports, pendingValidation }

  async function handleLogout() {
    clearOtpVerification(user)
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <aside className="w-60 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 flex flex-col border-r border-slate-200 dark:border-slate-700 transition-colors">
        <div className="px-4 py-5 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700">
          <img src={logoMark} alt="" className="w-12 h-12" />
          <span className="text-lg font-semibold text-slate-900 dark:text-white">Kinetix FSL Admin</span>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
                      : 'text-slate-600 dark:text-slate-300'
                  }`
                }
              >
                <span>{item.label}</span>
                {count > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-xs font-semibold">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-3"
          >
            {theme === 'dark' ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
                Light mode
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
                </svg>
                Dark mode
              </>
            )}
          </button>
          <p className="truncate mb-2 text-slate-500 dark:text-slate-400">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
