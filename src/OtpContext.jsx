import { createContext, useContext, useState } from 'react'
import { doc, deleteDoc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import emailjs from '@emailjs/browser'
import { db } from './firebase'
import { generateOtp, hashOtp, otpExpiryDate, OTP_MAX_ATTEMPTS } from './otp'

const OtpContext = createContext(null)

const SESSION_KEY_PREFIX = 'kinetix_otp_verified_'

function otpDocRef(uid) {
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
    const ref = otpDocRef(user.uid)
    const snap = await getDoc(ref)

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
