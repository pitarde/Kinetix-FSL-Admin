import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { TOTAL_SIGNS } from './signCatalog'

// One learner = one document in the `progress/{uid}` collection, which the
// mobile app mirrors from local state (ProgressRepository.buildSyncDocument).
// Each doc carries flat summary fields plus an `activityJson` blob holding the
// full per-day / per-category / per-sign event log the analytics is built from.

const MS_PER_DAY = 86_400_000

/** How recently a learner must have practiced to count as "active". */
export const ACTIVE_WINDOW_DAYS = 7

function epochDayToDate(epochDay) {
  if (epochDay == null || epochDay < 0) return null
  return new Date(epochDay * MS_PER_DAY)
}

function safeParse(json) {
  if (!json || typeof json !== 'string') return {}
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function sumValues(obj) {
  if (!obj) return 0
  return Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0)
}

/**
 * Normalises one raw Firestore progress doc into the shape the whole admin
 * app consumes. Everything is defensive — a half-populated doc from an
 * early-stage learner must never throw.
 */
export function normalizeLearner(id, data) {
  const activity = safeParse(data.activityJson)

  const categories = Array.isArray(data.categories) ? data.categories : []
  const learnedTotal = categories.reduce((n, c) => n + (Number(c.learned) || 0), 0)
  const signsTotal = categories.reduce((n, c) => n + (Number(c.total) || 0), 0) || TOTAL_SIGNS

  const signsLearned = Number(data.signsLearned) || learnedTotal
  const overallProgress = signsTotal > 0 ? Math.min(1, signsLearned / signsTotal) : 0

  // Accuracy = correct answers / attempts, aggregated over every category.
  const catCorrect = sumValues(activity.categoryCorrect)
  const catAttempts = sumValues(activity.categoryAttempts)
  const accuracy = catAttempts > 0 ? catCorrect / catAttempts : null

  // Study time: total seconds across all logged days.
  const studySeconds = sumValues(activity.dailyStudySeconds)
  const activeDayCount = Array.isArray(activity.activeDays) ? activity.activeDays.length : 0
  const avgSessionMinutes = activeDayCount > 0 ? studySeconds / 60 / activeDayCount : 0

  const lastActive = epochDayToDate(Number(data.lastActiveEpochDay))
  const daysSinceActive = lastActive
    ? Math.floor((Date.now() - lastActive.getTime()) / MS_PER_DAY)
    : null
  const isActive = daysSinceActive != null && daysSinceActive <= ACTIVE_WINDOW_DAYS

  return {
    uid: id,
    displayName: data.displayName || '(no name)',
    email: data.email || '',
    level: Number(data.level) || 0,
    accountXp: Number(data.accountXp) || 0,
    rank: data.rank || 'Novice Signer',
    streakDays: Number(data.streakDays) || 0,
    bestStreak: Number(data.bestStreak) || 0,
    signsLearned,
    signsTotal,
    quizLevelsCleared: Number(data.quizLevelsCleared) || 0,
    achievementsUnlocked: Number(data.achievementsUnlocked) || 0,
    overallProgress,
    accuracy,
    studySeconds,
    avgSessionMinutes,
    activeDayCount,
    lastActive,
    daysSinceActive,
    isActive,
    categories,
    activity,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
  }
}

/** One-shot fetch of every learner. */
export async function fetchLearners() {
  const snap = await getDocs(collection(db, 'progress'))
  return snap.docs.map((d) => normalizeLearner(d.id, d.data()))
}

/** Live subscription; returns an unsubscribe fn. Calls back with (learners, error). */
export function subscribeLearners(onData, onError) {
  return onSnapshot(
    collection(db, 'progress'),
    (snap) => onData(snap.docs.map((d) => normalizeLearner(d.id, d.data()))),
    (err) => onError?.(err),
  )
}
