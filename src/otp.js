const OTP_LENGTH = 6
const OTP_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_ATTEMPTS = 5

export function generateOtp() {
  const digits = new Uint32Array(OTP_LENGTH)
  crypto.getRandomValues(digits)
  return Array.from(digits, (d) => d % 10).join('')
}

export async function hashOtp(code) {
  const data = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function otpExpiryDate() {
  return new Date(Date.now() + OTP_TTL_MS)
}

export const OTP_MAX_ATTEMPTS = MAX_ATTEMPTS
