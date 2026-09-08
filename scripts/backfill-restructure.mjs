/*
 * ─────────────────────────────────────────────────────────────────────────
 *  BACKFILL SCRIPT — Firestore restructure (web/FIRESTORE_RESTRUCTURE.md)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * One-off, idempotent migrations run LOCALLY with the Firebase Admin SDK. The
 * Admin SDK running from a developer machine needs only a service-account key —
 * it does NOT require the paid Blaze plan (that is only for *deployed* Cloud
 * Functions), so this stays within the project's free-Spark constraint.
 *
 * SETUP (once):
 *   1.  npm i -D firebase-admin
 *   2.  Firebase console → Project settings → Service accounts → Generate new
 *       private key. Save the JSON somewhere OUTSIDE the repo.
 *   3.  export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/serviceAccount.json
 *       export FIREBASE_PROJECT_ID=kinetixfsl-73d88     # optional; inferred otherwise
 *
 * USAGE:
 *   node scripts/backfill-restructure.mjs manifest        # Phase 0
 *   node scripts/backfill-restructure.mjs accountStatus   # Phase 2
 *   node scripts/backfill-restructure.mjs progress        # Phase 3
 *   node scripts/backfill-restructure.mjs notifications   # Phase 4
 *   node scripts/backfill-restructure.mjs all             # every phase, in order
 *   ... append  --dry-run  to log what WOULD be written without writing.
 *
 * Every step is idempotent: re-running overwrites the same target docs, so a
 * partial run can simply be run again. Deploy the matching rules + indexes
 * BEFORE running the phase that needs them.
 */

import { readFileSync } from 'node:fs'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const DRY = process.argv.includes('--dry-run')
const CMD = process.argv[2]

// ── Admin SDK init ──────────────────────────────────────────────────────────
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const projectId = process.env.FIREBASE_PROJECT_ID
initializeApp({
  credential: keyPath
    ? cert(JSON.parse(readFileSync(keyPath, 'utf8')))
    : applicationDefault(),
  ...(projectId ? { projectId } : {}),
})
const db = getFirestore()

// Manifest doc-id encoding — MUST match AuthoredManifest.idFor in the app.
const manifestId = (path) => path.replaceAll('/', '~')

let writes = 0
async function commitInChunks(ops) {
  // ops: array of () => (batch) => void ... simpler: array of {ref, data, merge}
  for (let i = 0; i < ops.length; i += 450) {
    const chunk = ops.slice(i, i + 450)
    if (DRY) { writes += chunk.length; continue }
    const batch = db.batch()
    for (const op of chunk) batch.set(op.ref, op.data, { merge: op.merge !== false })
    await batch.commit()
    writes += chunk.length
  }
}

// ── Phase 0: deletion manifest ──────────────────────────────────────────────
//
// Reconstructs users/{uid}/authored rows for the cross-user documents that
// already exist: comments, post votes, comment votes and shares. (Followers and
// community members are cleaned by the app/admin sweeps from the owner's own
// lists, and outgoing notifications only accrue going forward, so none of those
// need a historical backfill — see NotificationRepository / AccountEraser.)
async function backfillManifest() {
  const ops = []
  const posts = await db.collection('posts').get()
  console.log(`manifest: scanning ${posts.size} posts`)

  for (const post of posts.docs) {
    const postPath = post.ref.path

    const comments = await post.ref.collection('comments').get()
    for (const c of comments.docs) {
      const authorId = c.data()?.authorId
      if (authorId) {
        ops.push(manifestOp(authorId, c.ref.path, 'comment', postPath, 'commentCount'))
      }
      // Comment votes.
      const cvotes = await c.ref.collection('votes').get()
      for (const v of cvotes.docs) {
        const uid = v.data()?.userId || v.id
        if (uid) ops.push(manifestOp(uid, v.ref.path, 'commentVote', c.ref.path, null))
      }
    }

    const votes = await post.ref.collection('votes').get()
    for (const v of votes.docs) {
      const uid = v.data()?.userId || v.id
      if (uid) ops.push(manifestOp(uid, v.ref.path, 'vote', postPath, null))
    }

    const shares = await post.ref.collection('shares').get()
    for (const s of shares.docs) {
      const uid = s.id // shares/{uid}
      if (uid) ops.push(manifestOp(uid, s.ref.path, 'share', postPath, 'shareCount'))
    }
  }

  await commitInChunks(ops)
  console.log(`manifest: ${DRY ? 'would write' : 'wrote'} ${ops.length} manifest rows`)
}

function manifestOp(ownerUid, path, type, parentPath, counter) {
  return {
    ref: db.collection('users').doc(ownerUid).collection('authored').doc(manifestId(path)),
    data: { path, type, parentPath, counter, createdAt: FieldValue.serverTimestamp() },
  }
}

// ── Phase 2: accountStatus/{uid} → users/{uid}/status/moderation ────────────
//
// Copies live moderation state to the nested path. SKIPS docs whose user
// profile no longer exists (a wiped account): copying there would leave the
// nested doc as the only child of a non-existent users/{uid}, i.e. a ghost. The
// wipe marker deliberately stays on the root (see moderation.js §4.3).
async function backfillAccountStatus() {
  const snap = await db.collection('accountStatus').get()
  console.log(`accountStatus: scanning ${snap.size} docs`)
  const ops = []
  for (const d of snap.docs) {
    const userSnap = await db.collection('users').doc(d.id).get()
    if (!userSnap.exists) { console.log(`  skip ${d.id} (no profile — wiped account)`); continue }
    ops.push({
      ref: db.collection('users').doc(d.id).collection('status').doc('moderation'),
      data: d.data(),
    })
  }
  await commitInChunks(ops)
  console.log(`accountStatus: ${DRY ? 'would copy' : 'copied'} ${ops.length} docs`)
}

// ── Phase 3: progress/{uid} → users/{uid}/progress/current ──────────────────
async function backfillProgress() {
  const snap = await db.collection('progress').get()
  console.log(`progress: scanning ${snap.size} docs`)
  const ops = snap.docs.map((d) => ({
    ref: db.collection('users').doc(d.id).collection('progress').doc('current'),
    data: d.data(),
  }))
  await commitInChunks(ops)
  console.log(`progress: ${DRY ? 'would copy' : 'copied'} ${ops.length} docs`)
}

// ── Phase 4: notifications/{uid}/items/* → users/{uid}/notifications/* ───────
//
// Preserves the document id so the app's merged read de-dupes a backfilled row
// against any new-path row with the same id.
async function backfillNotifications() {
  const parents = await db.collection('notifications').get()
  console.log(`notifications: scanning ${parents.size} inboxes`)
  const ops = []
  for (const parent of parents.docs) {
    const uid = parent.id
    const items = await parent.ref.collection('items').get()
    for (const it of items.docs) {
      ops.push({
        ref: db.collection('users').doc(uid).collection('notifications').doc(it.id),
        data: it.data(),
      })
    }
  }
  await commitInChunks(ops)
  console.log(`notifications: ${DRY ? 'would copy' : 'copied'} ${ops.length} rows`)
}

// ── Runner ──────────────────────────────────────────────────────────────────
async function run() {
  console.log(`Backfill "${CMD}"${DRY ? ' (DRY RUN)' : ''} on project ${projectId || '(default)'}\n`)
  switch (CMD) {
    case 'manifest': await backfillManifest(); break
    case 'accountStatus': await backfillAccountStatus(); break
    case 'progress': await backfillProgress(); break
    case 'notifications': await backfillNotifications(); break
    case 'all':
      await backfillManifest()
      await backfillAccountStatus()
      await backfillProgress()
      await backfillNotifications()
      break
    default:
      console.error('Usage: node scripts/backfill-restructure.mjs <manifest|accountStatus|progress|notifications|all> [--dry-run]')
      process.exit(1)
  }
  console.log(`\nDone. Total writes: ${writes}${DRY ? ' (dry run — nothing written)' : ''}`)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
