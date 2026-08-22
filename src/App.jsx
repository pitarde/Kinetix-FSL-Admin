import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext'
import { AuthProvider } from './AuthContext'
import { OtpProvider } from './OtpContext'
import { AdminProvider } from './AdminContext'
import { ToastProvider } from './components/ui'
import ProtectedRoute from './ProtectedRoute'
import AdminGate from './AdminGate'
import Layout from './Layout'
import Login from './pages/Login'
import VerifyOtp from './pages/VerifyOtp'

// The authenticated pages are lazy-loaded, so each becomes its own chunk that
// only downloads when that route is opened. This keeps the initial bundle
// (login + shell) small and moves the heavy dependencies — Recharts especially,
// used by Dashboard/Analytics — out of the first load.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Users = lazy(() => import('./pages/Users'))
const Reports = lazy(() => import('./pages/Reports'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Content = lazy(() => import('./pages/Content'))
const Broadcast = lazy(() => import('./pages/Broadcast'))
const Validation = lazy(() => import('./pages/Validation'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-slate-400 dark:text-slate-500">
      <span className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-indigo-500 animate-spin" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <OtpProvider>
            <AdminProvider>
              <ToastProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/verify-otp" element={<VerifyOtp />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <AdminGate>
                          <Layout />
                        </AdminGate>
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
                    <Route path="validation" element={<Suspense fallback={<PageFallback />}><Validation /></Suspense>} />
                    <Route path="reports" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
                    <Route path="content" element={<Suspense fallback={<PageFallback />}><Content /></Suspense>} />
                    <Route path="users" element={<Suspense fallback={<PageFallback />}><Users /></Suspense>} />
                    <Route path="analytics" element={<Suspense fallback={<PageFallback />}><Analytics /></Suspense>} />
                    <Route path="broadcast" element={<Suspense fallback={<PageFallback />}><Broadcast /></Suspense>} />
                    <Route path="audit-log" element={<Suspense fallback={<PageFallback />}><AuditLog /></Suspense>} />
                  </Route>
                </Routes>
              </ToastProvider>
            </AdminProvider>
          </OtpProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
