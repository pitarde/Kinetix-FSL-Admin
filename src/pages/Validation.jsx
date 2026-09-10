import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { subscribeValidationQueue, validatePost, rejectValidation } from '../firestore/validation'
import {
  Card, PageHeader, Spinner, EmptyState, Badge, Btn, Modal, useToast, ReasonSelect,
} from '../components/ui'
import { formatDate } from '../lib/format'
import { mediaSrc } from '../lib/r2'

/**
 * Every photo/clip on a post, newest scheme first — mirrors the app's
 * `Post.mediaItems`. New posts carry a `media` array of `{ url, type, thumbUrl }`;
 * older ones only have the legacy single `imageUrl` / `videoUrl` fields.
 */
function mediaItemsOf(post) {
  if (Array.isArray(post.media) && post.media.length) {
    return post.media.map((m) => ({
      url: m?.url || m?.thumbUrl || '',
      type: m?.type === 'video' ? 'video' : 'image',
      poster: m?.thumbUrl || post.previewUrl || '',
    }))
  }
  if (post.videoUrl) return [{ url: post.videoUrl, type: 'video', poster: post.previewUrl || '' }]
  if (post.imageUrl) return [{ url: post.imageUrl, type: 'image', poster: '' }]
  return []
}

/**
 * The media on a post awaiting validation — the admin needs to actually watch
 * the video and see the photos to make a call, not just a grey placeholder.
 * Videos play inline with controls; tapping a photo opens it full size.
 */
function ValidationMedia({ post }) {
  const items = mediaItemsOf(post).filter((it) => it.url)
  const [zoom, setZoom] = useState(null)
  if (items.length === 0) return null

  return (
    <div className="lg:w-72 shrink-0 space-y-2">
      {items.map((item, i) => (
        item.type === 'video' ? (
          <video
            key={i}
            src={mediaSrc(item.url)}
            poster={item.poster ? mediaSrc(item.poster) : undefined}
            controls
            playsInline
            preload="metadata"
            className="w-full rounded-lg bg-black max-h-72"
          />
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => setZoom(mediaSrc(item.url))}
            className="block w-full"
          >
            <img
              src={mediaSrc(item.url)}
              alt=""
              className="w-full rounded-lg object-cover max-h-72 hover:opacity-90 transition"
            />
          </button>
        )
      ))}

      <Modal open={!!zoom} onClose={() => setZoom(null)} wide>
        {zoom && <img src={zoom} alt="" className="w-full rounded-lg" />}
      </Modal>
    </div>
  )
}

const REJECT_REASONS = [
  'Content doesn’t meet validation criteria',
  'Sign shown is incorrect',
  'Needs clearer video / demonstration',
  'Not related to FSL learning',
]

export default function Validation() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsub = subscribeValidationQueue(
      (data) => { setPosts(data); setLoading(false); setError(null) },
      (err) => { setError(err); setLoading(false) },
    )
    return unsub
  }, [])

  return (
    <div>
      <PageHeader
        title="Content Validation"
        subtitle="Posts learners submitted for review. Validate to give the post a “Validated” badge in the app, or reject it."
      />
      {loading ? <Spinner label="Loading validation queue…" />
        : error ? <EmptyState title="Couldn't load the queue" hint={error.message} />
        : posts.length === 0 ? <EmptyState title="Nothing to validate" hint="Posts learners submit for validation show up here." />
        : <div className="space-y-4">{posts.map((p) => <ValidationCard key={p.id} post={p} />)}</div>}
    </div>
  )
}

function ValidationCard({ post }) {
  const { user: admin } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  async function act(fn, msg) {
    setBusy(true)
    try {
      await fn()
      toast(msg, 'success')
      setRejecting(false)
    } catch (e) {
      toast(e.message || 'Action failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Badge tone="amber">Pending validation</Badge>
        <span className="text-xs text-slate-400 dark:text-slate-500">Submitted {formatDate(post.createdAt)}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="min-w-0 flex-1">
          {post.title && <p className="font-semibold text-slate-900 dark:text-white">{post.title}</p>}
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mt-1">{post.body || '(no text)'}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            By <span className="font-medium">{post.authorName || post.authorId}</span>
            {post.communityName ? ` · in ${post.communityName}` : ' · Home Feed'}
          </p>
        </div>
        <ValidationMedia post={post} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn variant="primary" size="sm" disabled={busy}
          onClick={() => act(() => validatePost(post, admin), 'Post validated')}>
          Mark validated
        </Btn>
        <Btn variant="ghost" size="sm" disabled={busy} onClick={() => { setReason(''); setRejecting(true) }}>
          Reject
        </Btn>
      </div>

      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Reject this post?"
        footer={<>
          <Btn variant="ghost" onClick={() => setRejecting(false)}>Cancel</Btn>
          <Btn variant="danger" disabled={busy || !reason}
            onClick={() => act(() => rejectValidation(post, admin, reason), 'Post rejected')}>Reject</Btn>
        </>}>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          The post stays visible but won't get a Validated badge. The author is notified.
        </p>
        <ReasonSelect presets={REJECT_REASONS} value={reason} onChange={setReason} label="Reason (shown to the learner)" />
      </Modal>
    </Card>
  )
}
