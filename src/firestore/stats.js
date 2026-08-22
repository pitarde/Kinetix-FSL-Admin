import { collection, query, where, getCountFromServer, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

// Cheap server-side counts for the Dashboard KPI tiles (no document downloads).

export async function fetchPostsCount() {
  try {
    const snap = await getCountFromServer(collection(db, 'posts'))
    return snap.data().count
  } catch {
    return null
  }
}

export async function fetchOpenReportsCount() {
  try {
    const q = query(collection(db, 'reports'), where('status', '==', 'open'))
    const snap = await getCountFromServer(q)
    return snap.data().count
  } catch {
    return null
  }
}

/**
 * Live open-reports count, so the sidebar badge (and anywhere else) updates
 * the moment a new report is filed or an existing one is resolved/dismissed —
 * without polling. Listens to the actual documents rather than
 * getCountFromServer because that call isn't realtime.
 */
export function subscribeOpenReportsCount(onCount, onError) {
  const q = query(collection(db, 'reports'), where('status', '==', 'open'))
  return onSnapshot(
    q,
    (snap) => onCount(snap.size),
    (err) => onError?.(err),
  )
}

/** Live count of posts awaiting admin validation, for the nav badge + KPI. */
export function subscribePendingValidationCount(onCount, onError) {
  const q = query(collection(db, 'posts'), where('validationStatus', '==', 'pending'))
  return onSnapshot(
    q,
    (snap) => onCount(snap.size),
    (err) => onError?.(err),
  )
}

/** DAU/WAU/MAU + active-streak count derived from the learners array. */
export function activityWindows(learners) {
  const within = (d, n) => d != null && d <= n
  return {
    dau: learners.filter((l) => within(l.daysSinceActive, 1)).length,
    wau: learners.filter((l) => within(l.daysSinceActive, 7)).length,
    mau: learners.filter((l) => within(l.daysSinceActive, 30)).length,
    activeStreaks: learners.filter((l) => l.streakDays > 0 && within(l.daysSinceActive, 1)).length,
  }
}
