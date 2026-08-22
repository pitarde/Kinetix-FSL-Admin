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
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Users from './pages/Users'
import Reports from './pages/Reports'
import AuditLog from './pages/AuditLog'
import Content from './pages/Content'
import Broadcast from './pages/Broadcast'
import Validation from './pages/Validation'

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
                    <Route index element={<Dashboard />} />
                    <Route path="validation" element={<Validation />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="content" element={<Content />} />
                    <Route path="users" element={<Users />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="broadcast" element={<Broadcast />} />
                    <Route path="audit-log" element={<AuditLog />} />
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
