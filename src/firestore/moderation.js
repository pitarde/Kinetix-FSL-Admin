import {
  collection, collectionGroup, query, where, orderBy, onSnapshot, getDocs, getDoc,
  doc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp, increment,
} from 'firebase/firestore'
import { db } from '../firebase'
import { deleteR2Objects, storageKeyOf, postStorageKeys } from '../lib/r2'

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
//
// Targets the new nested inbox users/{uid}/notifications (Phase 4); the mobile
// app reads both paths merged, so an updated client sees it.
export async function notifyUser(uid, admin, message) {
  if (!uid || !message) return
  try {
    await addDoc(collection(db, 'users', uid, 'notifications'), {
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
  // Account status is migrating from accountStatus/{uid} (old root) to
  // users/{uid}/status/moderation (new nested). Dual-write both during Phase 2
  // so mobile clients reading either path enforce the disable/penalty. Both
  // reads are new-first with an old fallback, so this is version-safe. The
  // learner's profile still exists here (this is a disable/penalty/enable, not a
  // wipe), so the nested write creates no ghost. Phase 5 drops the root write.
  const payload = {
    ...status,
    reason,
    updatedBy: admin?.email || admin?.uid || '',
    updatedAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'users', uid, 'status', 'moderation'), payload, { merge: true })
  // OLD PATH (Phase 5: remove).
  await setDoc(doc(db, 'accountStatus', uid), payload, { merge: true })
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
// someone else's uid. Wipes the learner's whole footprint:
//   • their posts (+ comment/vote/share subtrees) and the R2 media on them
//   • communities they created (+ every post inside, members, and R2 avatar/banner)
//   • comments and votes they left on OTHER people's posts, correcting each
//     post's commentCount / upvoteCount / downvoteCount / score
//   • their memberships (memberCount fixed) and their follow edges in both
//     directions (follower/following counts fixed)
//   • direct messages they sent (+ chat media in R2), and any thread whose
//     other participant is also gone
//   • notifications, progress, every users/{uid} subcollection, and the
//     public profile doc (+ its R2 avatar/banner)
//
// IMPORTANT LIMITATION: with no Cloud Function / Admin SDK here, the Firebase
// *Auth* record can't be removed from the console. Step 6 writes a `purgeAuth`
// marker that the app acts on at next sign-in (a user may always delete their
// own Auth record — the free path). The account is left un-banned.

async function deleteAll(q) {
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
  return snap.size
}

// Free a post's R2 media (its own files + any image on its comments) while the
// documents still exist — the Worker verifies each key against them — then take
// the comment/vote/share subtree and the post itself down.
async function deletePostTree(postRef, result = { r2: 0, errors: [] }) {
  try {
    const [postSnap, commentsSnap] = await Promise.all([
      getDoc(postRef),
      getDocs(collection(postRef, 'comments')),
    ])
    const keys = postStorageKeys(
      postSnap.data() || {},
      commentsSnap.docs.map((d) => d.data()),
    )
    if (keys.length && await deleteR2Objects({ postId: postRef.id }, keys)) {
      result.r2 += keys.length
    }
  } catch (e) { result.errors.push('post media: ' + e.message) }

  await deleteAll(collection(postRef, 'comments'))
  await deleteAll(collection(postRef, 'votes'))
  await deleteAll(collection(postRef, 'shares'))
  await deleteDoc(postRef)
}

// Deterministic first pass: consume the deletion manifest
// (users/{uid}/authored). Each row names a document this learner wrote into
// someone else's subtree — a comment, a vote, a share, or an outgoing
// notification — so we can delete exactly those without relying on
// collection-group indexes, then repair the post-scoped counters by RECOUNTING
// the surviving children. Follower/member counters are left to the dedicated
// steps below (which decrement once) to avoid double-counting; manifest rows of
// those types only delete their target document. Idempotent with steps 3–4,
// which stay as a fallback for anything the manifest missed. See §4.2 of
// FIRESTORE_RESTRUCTURE.md.
async function deleteViaManifest(uid, result) {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'authored'))
    const toRepair = new Map() // parentPath -> type
    for (const m of snap.docs) {
      const d = m.data() || {}
      const path = d.path
      const type = d.type || ''
      const parentPath = d.parentPath
      if (typeof path === 'string' && path) {
        try { await deleteDoc(doc(db, path)) } catch { /* already gone */ }
        if (type === 'comment') result.comments++
        else if (type === 'vote' || type === 'commentVote') result.votes++
      }
      if (parentPath && ['comment', 'vote', 'commentVote', 'share'].includes(type)) {
        toRepair.set(parentPath, type)
      }
      try { await deleteDoc(m.ref) } catch { /* ignore */ }
    }

    for (const [parentPath, type] of toRepair) {
      const parentRef = doc(db, parentPath)
      try {
        if (type === 'comment') {
          const left = await getDocs(collection(parentRef, 'comments'))
          await updateDoc(parentRef, { commentCount: left.size })
        } else if (type === 'share') {
          const left = await getDocs(collection(parentRef, 'shares'))
          await updateDoc(parentRef, { shareCount: left.size })
        } else if (type === 'vote' || type === 'commentVote') {
          const left = await getDocs(collection(parentRef, 'votes'))
          let up = 0, down = 0
          left.forEach((d) => { const dir = d.data()?.direction; if (dir === 'up') up++; else if (dir === 'down') down++ })
          await updateDoc(parentRef, { upvoteCount: up, downvoteCount: down, score: up - down })
        }
      } catch { /* parent gone */ }
    }
  } catch (e) { result.errors.push('manifest: ' + e.message) }
}

export async function deleteAccountData(uid, admin, { label = '', reason = '' } = {}) {
  const result = {
    posts: 0, communities: 0, comments: 0, votes: 0,
    messages: 0, conversations: 0, r2: 0, errors: [],
  }

  // 0. Manifest pass — deterministic cross-user cleanup (see above). Runs first
  //    so the collection-group fallbacks in steps 3–4 have little left to do.
  await deleteViaManifest(uid, result)

  // 1. Their own posts (+ subtrees + R2 media).
  try {
    const own = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid)))
    for (const p of own.docs) { await deletePostTree(p.ref, result); result.posts++ }
  } catch (e) { result.errors.push('posts: ' + e.message) }

  // 2. Communities they created (+ every post inside, by any author, + members,
  //    + the community's own avatar/banner in R2).
  try {
    const comms = await getDocs(query(collection(db, 'communities'), where('creatorId', '==', uid)))
    for (const c of comms.docs) {
      const cd = c.data() || {}
      const cKeys = [cd.avatarUrl, cd.bannerUrl, cd.avatarUrlPrev, cd.bannerUrlPrev]
        .map(storageKeyOf).filter(Boolean)
      if (cKeys.length && await deleteR2Objects({ communityId: c.id }, cKeys)) result.r2 += cKeys.length

      const inside = await getDocs(query(collection(db, 'posts'), where('communityId', '==', c.id)))
      for (const p of inside.docs) await deletePostTree(p.ref, result)
      await deleteAll(collection(c.ref, 'members'))
      await deleteDoc(c.ref)
      result.communities++
    }
  } catch (e) { result.errors.push('communities: ' + e.message) }

  // 3. Comments they left on OTHER people's posts. Free any attached image
  //    (still authorised while the comment exists), delete the comment, and
  //    drop the surviving post's commentCount by one.
  try {
    const cg = await getDocs(query(collectionGroup(db, 'comments'), where('authorId', '==', uid)))
    for (const cm of cg.docs) {
      const postRef = cm.ref.parent.parent
      const imgKey = storageKeyOf(cm.data()?.imageUrl)
      if (imgKey && postRef && await deleteR2Objects({ postId: postRef.id }, [imgKey])) result.r2++
      if (postRef) {
        try { await updateDoc(postRef, { commentCount: increment(-1) }) } catch { /* post gone */ }
      }
      await deleteDoc(cm.ref)
      result.comments++
    }
  } catch (e) { result.errors.push('comments-everywhere: ' + e.message) }

  // 4. Votes they cast on OTHER people's posts. Delete each, then RECOUNT the
  //    post from the votes still under it (same as the app's AccountEraser) so
  //    a lost decrement can't leave the tally wrong.
  try {
    const cg = await getDocs(query(collectionGroup(db, 'votes'), where('userId', '==', uid)))
    const byPost = new Map()
    for (const v of cg.docs) {
      const postRef = v.ref.parent.parent
      if (postRef) byPost.set(postRef.path, postRef)
      await deleteDoc(v.ref)
      result.votes++
    }
    for (const postRef of byPost.values()) {
      try {
        const left = await getDocs(collection(postRef, 'votes'))
        let up = 0, down = 0
        left.forEach((d) => { const dir = d.data()?.direction; if (dir === 'up') up++; else if (dir === 'down') down++ })
        await updateDoc(postRef, { upvoteCount: up, downvoteCount: down, score: up - down })
      } catch { /* post gone */ }
    }
  } catch (e) { result.errors.push('votes-everywhere: ' + e.message) }

  // 5. Communities they merely joined: drop the member marker and the count.
  try {
    const joined = await getDocs(collection(db, 'users', uid, 'joinedCommunities'))
    for (const j of joined.docs) {
      const cRef = doc(db, 'communities', j.id)
      try { await deleteDoc(doc(cRef, 'members', uid)) } catch { /* already gone */ }
      try { await updateDoc(cRef, { memberCount: increment(-1) }) } catch { /* community gone */ }
    }
  } catch (e) { result.errors.push('joined-communities: ' + e.message) }

  // 6. Follow graph, both directions — so no surviving account is left
  //    following, or listed as followed by, this one.
  try {
    const following = await getDocs(collection(db, 'users', uid, 'following'))
    for (const f of following.docs) {
      const t = doc(db, 'users', f.id)
      try { await deleteDoc(doc(t, 'followers', uid)) } catch { /* gone */ }
      try { await updateDoc(t, { followerCount: increment(-1) }) } catch { /* gone */ }
    }
    const followers = await getDocs(collection(db, 'users', uid, 'followers'))
    for (const f of followers.docs) {
      const t = doc(db, 'users', f.id)
      try { await deleteDoc(doc(t, 'following', uid)) } catch { /* gone */ }
      try { await updateDoc(t, { followingCount: increment(-1) }) } catch { /* gone */ }
    }
  } catch (e) { result.errors.push('follow-graph: ' + e.message) }

  // 7. Direct messages. Free chat media from R2, delete the messages this user
  //    sent, and take the whole thread down when its other participant has also
  //    deleted their account (a ghost nobody can open).
  try {
    const threads = await getDocs(
      query(collection(db, 'conversations'), where('participants', 'array-contains', uid)),
    )
    for (const t of threads.docs) {
      const parts = Array.isArray(t.data()?.participants) ? t.data().participants : []
      const otherUid = parts.find((p) => p !== uid)
      let otherGone = !otherUid
      if (otherUid) {
        try { otherGone = !(await getDoc(doc(db, 'users', otherUid))).exists() } catch { otherGone = false }
      }

      const msgs = await getDocs(collection(t.ref, 'messages'))
      const toDelete = msgs.docs.filter((m) => otherGone || m.data()?.senderId === uid)
      const keys = toDelete.flatMap((m) => [
        storageKeyOf(m.data()?.mediaUrl), storageKeyOf(m.data()?.thumbUrl),
      ]).filter(Boolean)
      if (keys.length && await deleteR2Objects({ conversationId: t.id }, keys)) result.r2 += keys.length
      await Promise.all(toDelete.map((m) => deleteDoc(m.ref)))
      result.messages += toDelete.length

      if (otherGone) { await deleteDoc(t.ref); result.conversations++ }
    }
  } catch (e) { result.errors.push('conversations: ' + e.message) }

  // 8. Notifications inbox — new nested path and old root path (Phase 4).
  try { await deleteAll(collection(db, 'users', uid, 'notifications')) }
  catch (e) { result.errors.push('notifications (nested): ' + e.message) }
  // OLD PATH (Phase 5: remove).
  try { await deleteAll(collection(db, 'notifications', uid, 'items')) }
  catch (e) { result.errors.push('notifications (root): ' + e.message) }

  // 9. Progress doc — lives at users/{uid}/progress/current (the restructure's
  //    Phase 3 target). The old-root delete was removed once the database was
  //    confirmed free of any pre-migration data to carry forward.
  try { await deleteDoc(doc(db, 'users', uid, 'progress', 'current')) }
  catch (e) { result.errors.push('progress: ' + e.message) }

  // 10. The profile's own avatar/banner in R2 (while users/{uid} still exists),
  //     then every subcollection under the user, then the profile doc itself.
  try {
    const meSnap = await getDoc(doc(db, 'users', uid))
    const md = meSnap.data() || {}
    const pKeys = [md.avatarUrl, md.bannerUrl, md.avatarUrlPrev, md.bannerUrlPrev]
      .map(storageKeyOf).filter(Boolean)
    if (pKeys.length && await deleteR2Objects({ userId: uid }, pKeys)) result.r2 += pKeys.length
  } catch (e) { result.errors.push('profile media: ' + e.message) }

  for (const sub of [
    'joinedCommunities', 'recentCommunities', 'followers', 'following',
    'hiddenPosts', 'blocked', 'blockedBy', 'devices',
    // Restructure additions — the consolidated per-learner subcollections, so a
    // wipe leaves no ghost subtree under users/{uid}. (progress + notifications
    // were cleared in steps 8–9; re-sweeping is a harmless no-op. `status` is
    // swept here rather than left behind — the wipe marker is written to the
    // OLD accountStatus root below, which survives independently and so does not
    // ghost the profile.)
    'authored', 'private', 'progress', 'status', 'notifications',
  ]) {
    try { await deleteAll(collection(db, 'users', uid, sub)) }
    catch (e) { result.errors.push(`${sub}: ${e.message}`) }
  }
  try {
    await deleteDoc(doc(db, 'users', uid))
  } catch {
    try { await setDoc(doc(db, 'users', uid), { displayName: 'Deleted user', avatarUrl: null }, { merge: true }) }
    catch (e) { result.errors.push('profile: ' + e.message) }
  }

  // 11. FREE the account (don't ban it), and stamp a wipe marker. Writing the
  //    doc WITHOUT merge overwrites any prior disable/penalty, so there is no
  //    block — the person can sign in again and start fresh. `wipedAt` is read
  //    by the app on next sign-in to also clear the on-device cache, so the
  //    reset holds even on the same phone. (No `disabled`/`lockedUntil` here,
  //    so this marker never blocks login.)
  //
  //    DELIBERATELY written to the OLD root accountStatus/{uid}, not the nested
  //    users/{uid}/status/moderation: this marker must OUTLIVE the profile we
  //    just deleted, and a doc under users/{uid} would leave the whole
  //    users/{uid} document showing as a ghost (its only surviving child). The
  //    root collection survives independently, and the app's status reads fall
  //    back to it (new-first, old-fallback) precisely because a wiped account
  //    has no nested doc. This is why the accountStatus root can't be fully
  //    retired in Phase 5 without first giving the wipe marker another
  //    always-surviving home. See §4.3.
  try {
    await setDoc(doc(db, 'accountStatus', uid), {
      wipedAt: serverTimestamp(),
      // The app self-deletes its own Firebase Auth record on the next sign-in
      // when it sees this flag (a user may always delete their own account —
      // the same free path the in-app Settings "Delete account" uses). No
      // Admin SDK / Cloud Function / Blaze needed.
      purgeAuth: true,
      reason: reason || 'Account data removed by an administrator.',
      updatedBy: admin?.email || admin?.uid || '',
      updatedAt: serverTimestamp(),
    })
  } catch (e) { result.errors.push('accountStatus: ' + e.message) }

  // No learner notification for a delete: it would just re-create the
  // notifications/{uid} subcollection this wipe cleared in step 8, and the
  // reason already lives in the audit log below. The app tells the person why
  // on their next sign-in from `accountStatus/{uid}.reason` anyway.
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
