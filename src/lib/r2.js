// Cloudflare R2 media cleanup, via the same upload Worker the mobile app uses.
//
// The account wipe (see firestore/moderation.js -> deleteAccountData) has to
// free a learner's images and videos from the bucket, not just their Firestore
// documents — otherwise every deleted account leaves its post photos, chat
// clips and avatars behind forever.
//
// The Worker's /delete-media endpoint refuses any key that isn't referenced by
// the owning document (post / user / community) or, for chat, isn't under a
// thread participant's folder — so even though the shared secret ships in the
// bundle, this can't be turned into "delete anything in the bucket". Same
// contract as the app's R2MediaUploader.

const WORKER_URL =
  import.meta.env.VITE_UPLOAD_WORKER_URL ||
  'https://kinetix-upload.pitardeken2024.workers.dev'

// Must match DELETE_SECRET on the Worker and the app's R2MediaUploader.
const DELETE_SECRET =
  import.meta.env.VITE_R2_DELETE_SECRET || 'kinetix-delete-2026'

/**
 * A public media URL -> its R2 bucket key.
 *   "https://host/images/123.webp"    -> "images/123.webp"
 *   "https://host/f/uid/images/1.webp" -> "uid/images/1.webp"
 * Media is served through the Worker under "/f/", which is NOT part of the key.
 * Mirrors storageKeyOf() in the app and keyFromUrl() in the Worker.
 */
export function storageKeyOf(url) {
  if (!url || typeof url !== 'string') return null
  let path
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }
  path = path.replace(/^\/+/, '')
  if (!path) return null
  return path.replace(/^f\//, '')
}

/**
 * Asks the Worker to delete [keys] from R2, authorised against one owner.
 * Pass exactly one of postId / userId / communityId / conversationId.
 * Best-effort: resolves false on any failure, never throws — a leftover file
 * is untidy but must not abort the account wipe.
 */
export async function deleteR2Objects(owner, keys) {
  const clean = [...new Set((keys || []).filter(Boolean))]
  if (clean.length === 0) return true
  try {
    const res = await fetch(`${WORKER_URL}/delete-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kinetix-key': DELETE_SECRET,
      },
      body: JSON.stringify({ ...owner, keys: clean }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Every R2 key a post owns: its own media plus any image on its comments. */
export function postStorageKeys(postData, commentDatas = []) {
  const urls = [postData?.imageUrl, postData?.videoUrl, postData?.previewUrl]
  for (const m of postData?.media || []) {
    urls.push(m?.url, m?.thumbUrl)
  }
  for (const c of commentDatas) {
    urls.push(c?.imageUrl)
  }
  return urls.map(storageKeyOf).filter(Boolean)
}
