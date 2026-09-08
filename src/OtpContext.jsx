import { createContext, useContext, useState } from 'react'
import { doc, deleteDoc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import emailjs from '@emailjs/browser'
import { db } from './firebase'
import { generateOtp, hashOtp, otpExpiryDate, OTP_MAX_ATTEMPTS } from './otp'

const OtpContext = createContext(null)

const SESSION_KEY_PREFIX = 'kinetix_otp_verified_'

// OTP is migrating from the root collection otp_codes/{uid} to a subcollection
// users/{uid}/private/otp (Phase 1 of FIRESTORE_RESTRUCTURE.md). Codes are
// hashed and expire in minutes, so there is no backfill — we write and read the
// new path, and only fall back to the old one so a code issued by the previous
// deployment can still be verified while it drains. Phase 5 removes the fallback.
function otpDocRef(uid) {
  return doc(db, 'users', uid, 'private', 'otp')
}

// OLD PATH (Phase 5: remove).
function legacyOtpDocRef(uid) {
  return doc(db, 'otp_codes', uid)
}

export function OtpProvider({ children }) {
  const [sending, setSending] = useState(false)

  async function sendOtp(user) {
    setSending(true)
    try {
      const code = generateOtp()
      const hash = await hashOtp(code)

      await setDoc(otpDocRef(user.uid), {
        hash,
        attempts: 0,
        expiresAt: Timestamp.fromDate(otpExpiryDate()),
        createdAt: Timestamp.now(),
      })

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          to_email: user.email,
          otp_code: code,
        },
        { publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY }
      )
    } finally {
      setSending(false)
    }
  }

  async function verifyOtp(user, codeEntered) {
    // Read the new nested path first, then fall back to the old root path for a
    // code issued by the previous deployment. `ref` tracks whichever holds the
    // code, so attempt-count updates and the final delete hit the right doc.
    let ref = otpDocRef(user.uid)
    let snap = await getDoc(ref)
    if (!snap.exists()) {
      const legacyRef = legacyOtpDocRef(user.uid)
      const legacySnap = await getDoc(legacyRef)
      if (legacySnap.exists()) { ref = legacyRef; snap = legacySnap }
    }

    if (!snap.exists()) {
      return { ok: false, reason: 'expired' }
    }

    const { hash, attempts, expiresAt } = snap.data()

    if (expiresAt.toDate() < new Date()) {
      await deleteDoc(ref)
      return { ok: false, reason: 'expired' }
    }

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await deleteDoc(ref)
      return { ok: false, reason: 'locked' }
    }

    const enteredHash = await hashOtp(codeEntered.trim())

    if (enteredHash !== hash) {
      await setDoc(ref, { attempts: attempts + 1 }, { merge: true })
      const remaining = OTP_MAX_ATTEMPTS - (attempts + 1)
      return { ok: false, reason: 'mismatch', remaining }
    }

    await deleteDoc(ref)
    sessionStorage.setItem(SESSION_KEY_PREFIX + user.uid, 'true')
    return { ok: true }
  }

  function isOtpVerified(user) {
    if (!user) return false
    return sessionStorage.getItem(SESSION_KEY_PREFIX + user.uid) === 'true'
  }

  function clearOtpVerification(user) {
    if (!user) return
    sessionStorage.removeItem(SESSION_KEY_PREFIX + user.uid)
  }

  return (
    <OtpContext.Provider
      value={{ sending, sendOtp, verifyOtp, isOtpVerified, clearOtpVerification }}
    >
      {children}
    </OtpContext.Provider>
  )
}

export function useOtp() {
  return useContext(OtpContext)
}
