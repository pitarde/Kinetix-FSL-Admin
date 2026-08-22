import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { writeAudit } from './moderation'

// Admin-managed overrides layered over the app's built-in FSL catalog. One
// document per category in `contentOverrides/{categoryId}` holding flags the
// app can honour (e.g. hide a module). The catalog itself lives in the app
// (FslSignData); this only toggles/annotates it.
//
// NOTE: the mobile app does not yet READ these overrides — wiring the app to
// hide a disabled module is a follow-up. The admin side is complete and the
// flags persist, so that wiring is a small, isolated change later.

export function subscribeContentOverrides(onData, onError) {
  return onSnapshot(
    collection(db, 'contentOverrides'),
    (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data() })
      onData(map)
    },
    (err) => onError?.(err),
  )
}

export async function setModuleEnabled(categoryId, enabled, admin, { title = '' } = {}) {
  await setDoc(doc(db, 'contentOverrides', categoryId), {
    disabled: !enabled,
    updatedBy: admin?.email || admin?.uid || '',
    updatedAt: serverTimestamp(),
  }, { merge: true })
  await writeAudit(admin, {
    action: enabled ? 'content.enable' : 'content.disable',
    targetLabel: title || categoryId,
    details: { categoryId, enabled },
  })
}

export async function setModuleNote(categoryId, note, admin) {
  await setDoc(doc(db, 'contentOverrides', categoryId), {
    note,
    updatedBy: admin?.email || admin?.uid || '',
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
