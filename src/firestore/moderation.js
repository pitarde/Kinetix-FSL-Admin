import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

// Default reason choices, so an admin can pick a standard reason instead of
// typing one every time (they can still add a custom note). These strings are
// shown to the learner (via the notification and the sign-in block message).
export const REASON_PRESETS = {
  disable: [
    'Repeated harassment of other learners',
    'Posting spam or misleading content',
    'Sharing inappropriate or offensive content',
    'Impersonation or a fake account',
    'Repeatedly violating community guidelines',
  ],
  penalize: [
    'Temporary cool-down after heated behavior',
    'Repeated minor rule violations',
    'Spamming the community feed',
    'Inappropriate comments — first warning',
  ],
  delete: [
    'Severe or repeated violations of community guidelines',
    'Confirmed spam or bot account',
    'Account created for abuse or impersonation',
    'Permanent removal at the user’s request',
  ],
}

// Writes an in-app notification into a learner's inbox (the same schema the
// mobile app renders, type "system"). Best-effort — a failure here must never
// abort the moderation action that triggered it.
export async function notifyUser(uid, admin, message) {
  if (!uid || !message) return
  try {
    await addDoc(collection(db, 'notifications', uid, 'items'), {
      type: 'system',
      fromUserId: admin?.uid || '',
      fromUserName: 'Kinetix Moderation',
      fromUserPhoto: null,
      targetId: '',
      message,
      isRead: false,
      createdAt: Timestamp.now(),
    })
  } catch { /* best-effort */ }
}

// ── Audit log (accountability trail) ───────────────────────────────────────
//
// Every privileged action funnels through here so there is one immutable record
// of who did what to whom. The Firestore rules make auditLog append-only and
// require adminId == the signed-in admin, so an entry can't be forged or edited.

export async function writeAudit(admin, { action, targetUserId = '', targetLabel = '', reason = '', details = {} }) {
  if (!admin?.uid) return
  await addDoc(collection(db, 'auditLog'), {
    action,
    targetUserId,
    targetLabel,
    reason,
    details,
    adminId: admin.uid,
    adminEmail: admin.email || '',
    createdAt: serverTimestamp(),
  })
}

export function subscribeAuditLog(onData, onError, max = 200) {
  const q = query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.slice(0, max).map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err),
  )
}

// ── Reports queue ───────────────────────────────────────────────────────────

export function subscribeReports(status, onData, onError) {
  const base = collection(db, 'reports')
  const q = status && status !== 'all'
    ? query(base, where('status', '==', status), orderBy('createdAt', 'desc'))
    : query(base, orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err),
  )
}

// Reports are grouped in the UI by the content/user they target (see
// groupReports() in pages/Reports.jsx) — a post reported by 50 people is one
// card, not 50. These act on every report id behind a group in one call, so
// resolving the card clears all of them instead of leaving 49 duplicates open.

export async function resolveReportGroup(reportIds, admin, { actionTaken, note = '' }) {
  await Promise.all(reportIds.map((id) => updateDoc(doc(db, 'reports', id), {
    status: 'resolved',
    actionTaken,
    resolutionNote: note,
    resolvedBy: admin?.email || admin?.uid || '',
    resolvedAt: serverTimestamp(),
  })))
  await writeAudit(admin, {
    action: 'report.resolve',
    reason: note,
    details: { reportIds, count: reportIds.length, actionTaken },
  })
}

export async function dismissReportGroup(reportIds, admin, note = '') {
  await Promise.all(reportIds.map((id) => updateDoc(doc(db, 'reports', id), {
    status: 'dismissed',
    resolutionNote: note,
    resolvedBy: admin?.email || admin?.uid || '',
    resolvedAt: serverTimestamp(),
  })))
  await writeAudit(admin, {
    action: 'report.dismiss',
    reason: note,
    details: { reportIds, count: reportIds.length },
  })
}

// ── Account status (disable / time-penalty / unrestrict) ────────────────────

export async function setAccountStatus(uid, status, admin, { reason = '', label = '' } = {}) {
  await setDoc(doc(db, 'accountStatus', uid), {
    ...status,
    reason,
    updatedBy: admin?.email || admin?.uid || '',
    updatedAt: serverTimestamp(),
  }, { merge: true })
  await writeAudit(admin, {
    action: status.disabled ? 'account.disable'
      : status.lockedUntil ? 'account.penalize'
      : 'account.enable',
    targetUserId: uid,
    targetLabel: label,
    reason,
    details: {
      disabled: !!status.disabled,
      lockedUntil: status.lockedUntil ? status.lockedUntil.toDate().toISOString() : null,
    },
  })
}

export async function disableAccount(uid, admin, opts = {}) {
  await setAccountStatus(uid, { disabled: true, lockedUntil: null }, admin, opts)
  const reason = opts.reason ? ` Reason: ${opts.reason}.` : ''
  await notifyUser(uid, admin,
    `Your account has been disabled by a moderator.${reason} Contact support if you think this is a mistake.`)
}

export async function enableAccount(uid, admin, opts = {}) {
  await setAccountStatus(uid, { disabled: false, lockedUntil: null }, admin, opts)
  await notifyUser(uid, admin, 'Your account has been unrestricted. Welcome back!')
}

/** Lock sign-in for [hours] from now (a time penalty). */
export async function penalizeAccount(uid, hours, admin, opts = {}) {
  const until = Timestamp.fromDate(new Date(Date.now() + hours * 3_600_000))
  await setAccountStatus(uid, { disabled: false, lockedUntil: until }, admin, opts)
  const reason = opts.reason ? ` Reason: ${opts.reason}.` : ''
  const untilStr = until.toDate().toLocaleString()
  await notifyUser(uid, admin,
    `Your account has been temporarily restricted until ${untilStr}.${reason}`)
}

// ── Server-side (admin-triggered) account deletion ──────────────────────────
//
// The direct-SDK equivalent of the app's AccountEraser, run by an admin against
// someone else's uid. It wipes the learner's Firestore footprint (posts +
// their comment/vote/share subtrees, communities they created + every post
// inside, notifications, progress, and their public profile).
//
// IMPORTANT LIMITATION: with no Cloud Function / Admin SDK in this deployment,
// the Firebase *Auth* record itself cannot be removed from here. So this also
// marks the account disabled, which is what actually stops the person using the
// app (AuthRepository refuses a disabled sign-in). Surface that in the UI.

async function deleteAll(q) {
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
  return snap.size
}

async function deletePostTree(postRef) {
  await deleteAll(collection(postRef, 'comments'))
  await deleteAll(collection(postRef, 'votes'))
  await deleteAll(collection(postRef, 'shares'))
  await deleteDoc(postRef)
}

export async function deleteAccountData(uid, admin, { label = '', reason = '' } = {}) {
  const result = { posts: 0, communities: 0, errors: [] }

  // 1. Their own posts (+ subtrees).
  try {
    const own = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid)))
    for (const p of own.docs) { await deletePostTree(p.ref); result.posts++ }
  } catch (e) { result.errors.push('posts: ' + e.message) }

  // 2. Communities they created (+ every post inside, by any author, + members).
  try {
    const comms = await getDocs(query(collection(db, 'communities'), where('creatorId', '==', uid)))
    for (const c of comms.docs) {
      const inside = await getDocs(query(collection(db, 'posts'), where('communityId', '==', c.id)))
      for (const p of inside.docs) await deletePostTree(p.ref)
      await deleteAll(collection(c.ref, 'members'))
      await deleteDoc(c.ref)
      result.communities++
    }
  } catch (e) { result.errors.push('communities: ' + e.message) }

  // 3. Notifications inbox.
  try { await deleteAll(collection(db, 'notifications', uid, 'items')) }
  catch (e) { result.errors.push('notifications: ' + e.message) }

  // 4. Progress doc.
  try { await deleteDoc(doc(db, 'progress', uid)) }
  catch (e) { result.errors.push('progress: ' + e.message) }

  // 5. Public profile — delete, falling back to anonymise if the delete is
  //    blocked for any reason.
  try {
    await deleteAll(collection(db, 'users', uid, 'joinedCommunities'))
    await deleteDoc(doc(db, 'users', uid))
  } catch {
    try { await setDoc(doc(db, 'users', uid), { displayName: 'Deleted user', avatarUrl: null }, { merge: true }) }
    catch (e) { result.errors.push('profile: ' + e.message) }
  }

  // 6. FREE the account (don't ban it), and stamp a wipe marker. Writing the
  //    doc WITHOUT merge overwrites any prior disable/penalty, so there is no
  //    block — the person can sign in again and start fresh. `wipedAt` is read
  //    by the app on next sign-in to also clear the on-device cache, so the
  //    reset holds even on the same phone. (No `disabled`/`lockedUntil` here,
  //    so this marker never blocks login.)
  try {
    await setDoc(doc(db, 'accountStatus', uid), {
      wipedAt: serverTimestamp(),
      reason: reason || 'Account data removed by an administrator.',
      updatedBy: admin?.email || admin?.uid || '',
      updatedAt: serverTimestamp(),
    })
  } catch (e) { result.errors.push('accountStatus: ' + e.message) }

  // 7. Leave a single note so the person learns why, next time they sign in.
  await notifyUser(uid, admin,
    `Your account data was removed by a moderator${reason ? ` (reason: ${reason})` : ''}. You can keep using the app, but you're starting over from scratch.`)

  await writeAudit(admin, {
    action: 'account.delete',
    targetUserId: uid,
    targetLabel: label,
    reason,
    details: result,
  })
  return result
}

// ── Direct content moderation ───────────────────────────────────────────────

/** Delete a single reported post (and its comment/vote/share subtree). */
export async function deletePost(postId, admin, { reason = '' } = {}) {
  await deletePostTree(doc(db, 'posts', postId))
  await writeAudit(admin, { action: 'post.delete', reason, details: { postId } })
}

/** Delete a single reported comment. */
export async function deleteComment(postId, commentId, admin, { reason = '' } = {}) {
  await deleteDoc(doc(db, 'posts', postId, 'comments', commentId))
  await writeAudit(admin, { action: 'comment.delete', reason, details: { postId, commentId } })
}
