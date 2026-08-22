import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './AuthContext'

/**
 * Resolves whether the signed-in user is an admin by checking for their
 * `admins/{uid}` allowlist entry (the mechanism the Firestore rules enforce
 * server-side — see web/firestore.rules → isAdmin()). This client-side check is
 * only for UX (what to render); every privileged read/write is still gated by
 * the rules, so a non-admin who bypassed this would simply get permission
 * errors.
 */
const AdminContext = createContext({ isAdmin: false, checking: true })

export function AdminProvider({ children }) {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!user) {
        if (!cancelled) { setIsAdmin(false); setChecking(false) }
        return
      }
      setChecking(true)
      try {
        const snap = await getDoc(doc(db, 'admins', user.uid))
        if (!cancelled) setIsAdmin(snap.exists())
      } catch {
        if (!cancelled) setIsAdmin(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [user])

  return (
    <AdminContext.Provider value={{ isAdmin, checking }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  return useContext(AdminContext)
}
