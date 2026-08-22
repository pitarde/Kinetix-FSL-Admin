/*
 * ─────────────────────────────────────────────────────────────────────────
 *  DEV-ONLY SEED SCRIPT — never run this against production Firestore.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The security rules (correctly) forbid the client SDK from writing another
 * user's progress/{uid} doc, so this seeds the FIRESTORE EMULATOR, where rules
 * are permissive. It populates fake learners, a couple of reports and an admin
 * allowlist entry so every admin screen has something to render locally.
 *
 * Usage:
 *   1. In Kinetix-FSL/web:  firebase emulators:start --only firestore
 *   2. In Kinetix-FSL-Admin: node scripts/seed.mjs
 *
 * The admin app itself does NOT use the emulator (it talks to real Firestore);
 * this script is purely for eyeballing the UI with data. Point the app at the
 * emulator too (connectFirestoreEmulator in firebase.js) if you want to see it.
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator, doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'

const app = initializeApp({ projectId: 'kinetixfsl-73d88' })
const db = getFirestore(app)
connectFirestoreEmulator(db, '127.0.0.1', 8080)

const today = Math.floor(Date.now() / 86_400_000)

function activityJson(seed) {
  const dailyLearned = {}
  const dailyStudySeconds = {}
  const activeDays = []
  // Spread activity over the last `seed.spanDays` days.
  for (let i = 0; i < seed.spanDays; i++) {
    const day = today - i
    if (Math.random() < seed.consistency) {
      activeDays.push(day)
      dailyLearned[day] = Math.floor(Math.random() * 3)
      dailyStudySeconds[day] = 300 + Math.floor(Math.random() * 1200)
    }
  }
  return JSON.stringify({
    dailyLearned,
    dailyStudySeconds,
    activeDays,
    hourHistogram: Array(24).fill(0),
    signLastPracticed: {},
    lessonsStarted: { alphabet: 8, numbers: 5, greetings: 3, emergency: 2 },
    lessonsCompleted: { alphabet: 6, numbers: 4, greetings: 2, emergency: 1 },
    mistakes: seed.mistakes,
    hourCorrect: Array(24).fill(0),
    hourAttempts: Array(24).fill(0),
    categoryCorrect: seed.categoryCorrect,
    categoryAttempts: seed.categoryAttempts,
    cameraErrors: { handshape: seed.hand, motion: seed.motion, timing: seed.timing },
  })
}

const LEARNERS = [
  { uid: 'seed_maria', displayName: 'Maria Santos', email: 'maria@example.com', level: 12, rank: 'Expert Signer', streak: 9, signs: 34, spanDays: 30, consistency: 0.7,
    categoryCorrect: { alphabet: 40, numbers: 18, greetings: 6 }, categoryAttempts: { alphabet: 50, numbers: 22, greetings: 12 },
    hand: 8, motion: 3, timing: 2, mistakes: [{ t: 'alpha_m', tw: 'M', c: 'N', d: today - 2 }, { t: 'alpha_n', tw: 'N', c: 'M', d: today - 3 }] },
  { uid: 'seed_juan', displayName: 'Juan Dela Cruz', email: 'juan@example.com', level: 6, rank: 'Skilled Signer', streak: 2, signs: 18, spanDays: 20, consistency: 0.4,
    categoryCorrect: { alphabet: 20, numbers: 8 }, categoryAttempts: { alphabet: 35, numbers: 20 },
    hand: 12, motion: 6, timing: 4, mistakes: [{ t: 'num_6', tw: '6', c: '9', d: today - 1 }, { t: 'num_9', tw: '9', c: '6', d: today - 4 }] },
  { uid: 'seed_ana', displayName: 'Ana Reyes', email: 'ana@example.com', level: 3, rank: 'Novice Signer', streak: 0, signs: 7, spanDays: 25, consistency: 0.15,
    categoryCorrect: { alphabet: 6 }, categoryAttempts: { alphabet: 18 },
    hand: 5, motion: 2, timing: 1, mistakes: [{ t: 'alpha_b', tw: 'B', c: 'D', d: today - 10 }] },
  { uid: 'seed_carlo', displayName: 'Carlo Aquino', email: 'carlo@example.com', level: 17, rank: 'Master Signer', streak: 21, signs: 52, spanDays: 40, consistency: 0.85,
    categoryCorrect: { alphabet: 55, numbers: 25, greetings: 10, emergency: 6 }, categoryAttempts: { alphabet: 60, numbers: 28, greetings: 12, emergency: 8 },
    hand: 3, motion: 1, timing: 1, mistakes: [] },
  { uid: 'seed_bea', displayName: 'Bea Lim', email: 'bea@example.com', level: 1, rank: 'Novice Signer', streak: 0, signs: 2, spanDays: 45, consistency: 0.05,
    categoryCorrect: { alphabet: 2 }, categoryAttempts: { alphabet: 15 },
    hand: 9, motion: 4, timing: 3, mistakes: [{ t: 'alpha_c', tw: 'C', c: 'O', d: today - 30 }] },
]

async function run() {
  // Admin allowlist entry — replace with your real admin uid to test the console.
  await setDoc(doc(db, 'admins', 'REPLACE_WITH_ADMIN_UID'), { email: 'admin@kinetixfsl.com', addedAt: serverTimestamp() })

  for (const l of LEARNERS) {
    const catTotals = { alphabet: 28, numbers: 10, greetings: 4, emergency: 4 }
    const categories = Object.entries(catTotals).map(([id, total]) => ({
      id, name: id, total, learned: Math.min(total, Math.round((l.signs / 58) * total)),
    }))
    await setDoc(doc(db, 'progress', l.uid), {
      uid: l.uid, displayName: l.displayName, email: l.email,
      level: l.level, accountXp: l.level * 400, rank: l.rank,
      streakDays: l.streak, bestStreak: l.streak + 3, signsLearned: l.signs,
      quizLevelsCleared: Math.floor(l.signs / 6), achievementsUnlocked: Math.floor(l.level / 3),
      lastActiveEpochDay: l.consistency > 0.2 ? today - Math.floor(Math.random() * 3) : today - 12,
      categories, activityJson: activityJson(l), progressJson: '{}', quizJson: '{}',
      updatedAt: serverTimestamp(),
    })
    console.log('seeded learner', l.uid)
  }

  await addDoc(collection(db, 'reports'), {
    contentType: 'post', postId: 'seed_post_1', reportedUserId: 'seed_juan', reportedUserName: 'Juan Dela Cruz',
    reporterId: 'seed_maria', reporterName: 'Maria Santos', reason: 'Spam or misleading — posting the same link repeatedly',
    status: 'open', createdAt: serverTimestamp(),
    contentSnapshot: { title: 'Buy followers cheap!!', body: 'Click here to get 10k followers instantly →', imageUrl: '' },
  })
  await addDoc(collection(db, 'reports'), {
    contentType: 'comment', postId: 'seed_post_2', commentId: 'seed_c1', reportedUserId: 'seed_bea', reportedUserName: 'Bea Lim',
    reporterId: 'seed_ana', reporterName: 'Ana Reyes', reason: 'Harassment or bullying',
    status: 'open', createdAt: serverTimestamp(),
    contentSnapshot: { body: 'That sign is completely wrong, are you even trying?', imageUrl: '' },
  })
  console.log('seeded reports')
  console.log('\nDone. Remember to set the admins/{uid} entry to your real admin uid.')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
