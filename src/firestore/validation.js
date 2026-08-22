import {
  collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { writeAudit, notifyUser } from './moderation'

// Content Validation queue: posts whose author asked (from the app's create/
// edit composer) to have the post reviewed. An admin approves → the post gets a
// "Validated" badge in the app; or rejects → it leaves the queue with no badge.

export function subscribeValidationQueue(onData, onError) {
  const q = query(
    collection(db, 'posts'),
    where('validationStatus', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err),
  )
}

export async function validatePost(post, admin) {
  await updateDoc(doc(db, 'posts', post.id), {
    validationStatus: 'validated',
    validatedBy: admin?.email || admin?.uid || '',
    validatedAt: serverTimestamp(),
  })
  await notifyUser(post.authorId, admin,
    `Your post "${post.title || 'your post'}" has been validated by an admin — it now shows a Validated badge.`)
  await writeAudit(admin, {
    action: 'post.validate',
    targetUserId: post.authorId,
    targetLabel: post.authorName || '',
    details: { postId: post.id },
  })
}

export async function rejectValidation(post, admin, reason = '') {
  await updateDoc(doc(db, 'posts', post.id), {
    validationStatus: '',
    validatedBy: null,
    validatedAt: null,
  })
  await notifyUser(post.authorId, admin,
    `Your post "${post.title || 'your post'}" was reviewed but not validated.${reason ? ` Reason: ${reason}` : ''}`)
  await writeAudit(admin, {
    action: 'post.reject',
    targetUserId: post.authorId,
    targetLabel: post.authorName || '',
    reason,
    details: { postId: post.id },
  })
}
