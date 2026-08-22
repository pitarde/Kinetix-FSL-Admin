import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { subscribeValidationQueue, validatePost, rejectValidation } from '../firestore/validation'
import {
  Card, PageHeader, Spinner, EmptyState, Badge, Btn, Modal, useToast, ReasonSelect,
} from '../components/ui'
import { formatDate } from '../lib/format'

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

  const media = post.media?.[0]?.thumbUrl || post.media?.[0]?.url || post.imageUrl || post.previewUrl

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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <div>
          {post.title && <p className="font-semibold text-slate-900 dark:text-white">{post.title}</p>}
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mt-1">{post.body || '(no text)'}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            By <span className="font-medium">{post.authorName || post.authorId}</span>
            {post.communityName ? ` · in ${post.communityName}` : ' · Home Feed'}
          </p>
        </div>
        {media && (
          <img src={media} alt="" className="rounded-lg max-h-40 lg:w-48 object-cover" />
        )}
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
