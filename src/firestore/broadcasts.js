import {
  collection, addDoc, query, orderBy, onSnapshot,
  doc, deleteDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { writeAudit } from './moderation'
import { fetchLearners } from './learners'

// Announcements. Each broadcast is recorded in the `broadcasts` collection AND
// fanned out into recipients' notification inboxes so it shows up in-app with
// no mobile change — the same schema NotificationRepository writes, with type
// "announcement".
//
// The inbox is migrating from notifications/{uid}/items to
// users/{uid}/notifications (Phase 4). Per the plan, all writers target the new
// nested path; the mobile app reads both paths merged, so an updated client sees
// these. (A learner on a pre-Phase-4 build won't see new-path notifications
// until they update — the accepted Phase 4 tradeoff.)

export const AUDIENCES = [
  { value: 'all', label: 'All learners' },
  { value: 'Novice Signer', label: 'Novice Signers (Lv 1–5)' },
  { value: 'Skilled Signer', label: 'Skilled Signers (Lv 6–10)' },
  { value: 'Expert Signer', label: 'Expert Signers (Lv 11–15)' },
  { value: 'Master Signer', label: 'Master Signers (Lv 16–20)' },
]

async function recipientUids(audience) {
  // fetchLearners() reads the `progress` collection group and de-dupes by uid,
  // so this targets learners correctly across the Phase 3 migration window.
  const learners = await fetchLearners()
  return learners
    .filter((l) => audience === 'all' || (l.rank || '') === audience)
    .map((l) => l.uid)
}

/**
 * Composes an announcement: records it, then writes one notification into each
 * targeted learner's inbox. Returns the recipient count.
 */
export async function createBroadcast(admin, { title, body, audience }) {
  const uids = await recipientUids(audience)

  const ref = await addDoc(collection(db, 'broadcasts'), {
    title,
    body,
    audience,
    recipientCount: uids.length,
    createdBy: admin?.email || admin?.uid || '',
    createdById: admin?.uid || '',
    createdAt: serverTimestamp(),
  })

  // Fan out. Best-effort per recipient so one failure doesn't sink the rest.
  let delivered = 0
  await Promise.all(uids.map(async (uid) => {
    try {
      await addDoc(collection(db, 'users', uid, 'notifications'), {
        type: 'announcement',
        fromUserId: admin.uid,
        fromUserName: title,
        fromUserPhoto: null,
        targetId: '',
        message: body,
        isRead: false,
        createdAt: Timestamp.now(),
      })
      delivered++
    } catch { /* skip */ }
  }))

  await writeAudit(admin, {
    action: 'broadcast.create',
    reason: title,
    details: { broadcastId: ref.id, audience, recipientCount: uids.length, delivered },
  })
  return { id: ref.id, recipientCount: uids.length, delivered }
}

export function subscribeBroadcasts(onData, onError) {
  const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err),
  )
}

export async function deleteBroadcast(id, admin) {
  await deleteDoc(doc(db, 'broadcasts', id))
  await writeAudit(admin, { action: 'broadcast.delete', details: { broadcastId: id } })
}
