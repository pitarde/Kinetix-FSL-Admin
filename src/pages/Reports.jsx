import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import {
  subscribeReports, resolveReportGroup, dismissReportGroup,
  deletePost, deleteComment, disableAccount, penalizeAccount, deleteAccountData, REASON_PRESETS,
} from '../firestore/moderation'
import {
  Card, PageHeader, Spinner, EmptyState, Badge, Btn, Modal, useToast, cn, ReasonSelect,
} from '../components/ui'
import { formatDate, num } from '../lib/format'

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
]

/**
 * The key that makes several reports "the same complaint": the same post, the
 * same comment, or the same reported user (for chat reports, which have no
 * post/comment to key off). Grouping by this is what turns "100 people
 * reported this post" into one card instead of 100 rows.
 */
function groupKey(r) {
  if (r.contentType === 'post') return `post:${r.postId}`
  if (r.contentType === 'comment') return `comment:${r.postId}:${r.commentId}`
  return `chat:${r.reportedUserId}`
}

function toMillis(ts) {
  return ts?.toMillis ? ts.toMillis() : 0
}

/** Clusters reports into groups, newest report first within each group, and
 *  ranks the groups by report count so the worst-hit content surfaces first. */
function groupReports(reports) {
  const map = new Map()
  for (const r of reports) {
    const key = groupKey(r)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(r)
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      return { key, reports: sorted, latest: sorted[0], count: sorted.length }
    })
    .sort((a, b) => b.count - a.count || toMillis(b.latest.createdAt) - toMillis(a.latest.createdAt))
}

export default function Reports() {
  const [filter, setFilter] = useState('open')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeReports(
      filter,
      (data) => { setReports(data); setLoading(false); setError(null) },
      (err) => { setError(err); setLoading(false) },
    )
    return unsub
  }, [filter])

  const groups = useMemo(() => groupReports(reports), [reports])

  return (
    <div>
      <PageHeader
        title="Reports & Moderation"
        subtitle="Community reports, grouped by what they're reporting — 50 people flagging the same post is one card, not 50."
      />

      <div className="flex gap-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg font-medium',
              filter === f.id ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
            )}
          >
            {f.label}
          </button>
        ))}
        {groups.length > 0 && (
          <span className="text-sm text-slate-400 dark:text-slate-500 ml-auto self-center">
            {num(groups.length)} {groups.length === 1 ? 'item' : 'items'} · {num(reports.length)} {reports.length === 1 ? 'report' : 'reports'}
          </span>
        )}
      </div>

      {loading ? <Spinner label="Loading reports…" />
        : error ? <EmptyState title="Couldn't load reports" hint={error.message} />
        : groups.length === 0 ? <EmptyState title="Nothing here" hint={filter === 'open' ? 'No open reports — the queue is clear.' : `No ${filter} reports.`} />
        : <div className="space-y-4">{groups.map((g) => <ReportGroupCard key={g.key} group={g} />)}</div>}
    </div>
  )
}

function typeTone(t) {
  return t === 'post' ? 'indigo' : t === 'comment' ? 'amber' : 'red'
}

function countTone(count) {
  if (count >= 10) return 'red'
  if (count >= 3) return 'amber'
  return 'slate'
}

function ReportGroupCard({ group }) {
  const { user: admin } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState(null) // 'deleteContent' | 'disable' | 'penalize' | 'deleteUser'
  const [showAllReporters, setShowAllReporters] = useState(false)
  const [penaltyValue, setPenaltyValue] = useState(24)
  const [penaltyUnit, setPenaltyUnit] = useState('hours')
  const [reason, setReason] = useState('')

  const report = group.latest
  const reportIds = group.reports.map((r) => r.id)
  const snap = report.contentSnapshot || {}
  const isOpen = report.status === 'open'
  const visibleReporters = showAllReporters ? group.reports : group.reports.slice(0, 4)

  async function act(fn, msg) {
    setBusy(true)
    try {
      await fn()
      toast(msg, 'success')
      setAction(null)
    } catch (e) {
      toast(e.message || 'Action failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const combinedReason = group.reports.map((r) => r.reason).filter(Boolean).join(' · ')

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={typeTone(report.contentType)}>{report.contentType}</Badge>
          <Badge tone={countTone(group.count)}>
            {group.count === 1 ? 'Reported by 1 person' : `Reported by ${num(group.count)} people`}
          </Badge>
          {report.status !== 'open' && (
            <Badge tone={report.status === 'resolved' ? 'green' : 'slate'}>{report.status}</Badge>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">Latest {formatDate(report.createdAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reported content */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">Reported content</p>
          {snap.title && <p className="font-medium text-slate-800 dark:text-slate-100">{snap.title}</p>}
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
            {snap.body || (report.contentType === 'chat' ? '(direct-message conversation)' : '(no text)')}
          </p>
          {snap.imageUrl && (
            <img src={snap.imageUrl} alt="" className="mt-2 rounded-md max-h-40 object-cover" />
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            By <span className="font-medium">{report.reportedUserName || report.reportedUserId}</span>
            {report.communityName ? ` · in ${report.communityName}` : ''}
          </p>
        </div>

        {/* Reporters */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
            {group.count === 1 ? 'Reporter' : `Reporters (${num(group.count)})`}
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {visibleReporters.map((r) => (
              <div key={r.id} className="text-sm border-b border-slate-200/60 dark:border-slate-700/60 last:border-0 pb-2 last:pb-0">
                <p className="font-medium text-slate-700 dark:text-slate-200">{r.reporterName || r.reporterId}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">{r.reason || '(no reason given)'}</p>
              </div>
            ))}
          </div>
          {group.count > 4 && (
            <button
              onClick={() => setShowAllReporters((v) => !v)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2"
            >
              {showAllReporters ? 'Show fewer' : `Show all ${group.count}`}
            </button>
          )}
          {report.status !== 'open' && report.actionTaken && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">Action: {report.actionTaken}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {isOpen && (
        <div className="mt-4 flex flex-wrap gap-2">
          {report.contentType === 'post' && report.postId && (
            <Btn variant="danger" size="sm" disabled={busy}
              onClick={() => act(async () => {
                await deletePost(report.postId, admin, { reason: combinedReason })
                await resolveReportGroup(reportIds, admin, { actionTaken: 'Post deleted' })
              }, `Post deleted & ${num(group.count)} report${group.count === 1 ? '' : 's'} resolved`)}>
              Delete post
            </Btn>
          )}
          {report.contentType === 'comment' && report.postId && report.commentId && (
            <Btn variant="danger" size="sm" disabled={busy}
              onClick={() => act(async () => {
                await deleteComment(report.postId, report.commentId, admin, { reason: combinedReason })
                await resolveReportGroup(reportIds, admin, { actionTaken: 'Comment deleted' })
              }, `Comment deleted & ${num(group.count)} report${group.count === 1 ? '' : 's'} resolved`)}>
              Delete comment
            </Btn>
          )}
          <Btn variant="danger" size="sm" disabled={busy} onClick={() => { setReason(''); setAction('disable') }}>Disable user</Btn>
          <Btn variant="warn" size="sm" disabled={busy} onClick={() => { setReason(''); setAction('penalize') }}>Penalize user</Btn>
          <Btn variant="danger" size="sm" disabled={busy} onClick={() => { setReason(''); setAction('deleteUser') }}>Delete user</Btn>
          <Btn variant="outline" size="sm" disabled={busy}
            onClick={() => act(() => resolveReportGroup(reportIds, admin, { actionTaken: 'Reviewed — no action' }),
              `${num(group.count)} report${group.count === 1 ? '' : 's'} marked resolved`)}>
            Resolve (no action)
          </Btn>
          <Btn variant="ghost" size="sm" disabled={busy}
            onClick={() => act(() => dismissReportGroup(reportIds, admin),
              `${num(group.count)} report${group.count === 1 ? '' : 's'} dismissed`)}>
            Dismiss
          </Btn>
        </div>
      )}

      {/* Account action confirmations */}
      <Modal open={action === 'disable'} onClose={() => setAction(null)} title="Disable this user?"
        footer={<>
          <Btn variant="ghost" onClick={() => setAction(null)}>Cancel</Btn>
          <Btn variant="danger" disabled={busy || !reason}
            onClick={() => act(async () => {
              await disableAccount(report.reportedUserId, admin, { reason, label: report.reportedUserName })
              await resolveReportGroup(reportIds, admin, { actionTaken: 'Account disabled' })
            }, `User disabled & ${num(group.count)} report${group.count === 1 ? '' : 's'} resolved`)}>Disable</Btn>
        </>}>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          {report.reportedUserName} will be signed out and blocked from signing in until unrestricted.
        </p>
        <ReasonSelect presets={REASON_PRESETS.disable} value={reason} onChange={setReason} />
      </Modal>

      <Modal open={action === 'penalize'} onClose={() => setAction(null)} title="Time-penalty this user"
        footer={<>
          <Btn variant="ghost" onClick={() => setAction(null)}>Cancel</Btn>
          <Btn variant="warn" disabled={busy || !reason}
            onClick={() => act(async () => {
              const hours = penaltyUnit === 'days' ? penaltyValue * 24 : penaltyValue
              await penalizeAccount(report.reportedUserId, hours, admin, { reason, label: report.reportedUserName })
              await resolveReportGroup(reportIds, admin, { actionTaken: `Locked ${penaltyValue} ${penaltyUnit}` })
            }, `User penalized & ${num(group.count)} report${group.count === 1 ? '' : 's'} resolved`)}>Apply</Btn>
        </>}>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Lock {report.reportedUserName}'s sign-in for:</p>
        <div className="flex items-center gap-2 mb-3">
          <input type="number" min={1} value={penaltyValue}
            onChange={(e) => setPenaltyValue(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
          <select value={penaltyUnit} onChange={(e) => setPenaltyUnit(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
        </div>
        <ReasonSelect presets={REASON_PRESETS.penalize} value={reason} onChange={setReason} />
      </Modal>

      <Modal open={action === 'deleteUser'} onClose={() => setAction(null)} title="Delete this user's account?"
        footer={<>
          <Btn variant="ghost" onClick={() => setAction(null)}>Cancel</Btn>
          <Btn variant="danger" disabled={busy || !reason}
            onClick={() => act(async () => {
              const r = await deleteAccountData(report.reportedUserId, admin, { reason, label: report.reportedUserName })
              await resolveReportGroup(reportIds, admin, { actionTaken: 'Account deleted' })
              if (r.errors.length) throw new Error(`Partial: ${r.errors.join('; ')}`)
            }, `Account data deleted & ${num(group.count)} report${group.count === 1 ? '' : 's'} resolved`)}>Delete everything</Btn>
        </>}>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Wipes {report.reportedUserName}'s posts, comments, communities, progress and profile — like the app's own Delete Account — and blocks sign-in. This cannot be undone.
        </p>
        <ReasonSelect presets={REASON_PRESETS.delete} value={reason} onChange={setReason} />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Note: the Firebase Auth record can't be removed without a Cloud Function, so the account is disabled to fully block access. The reason is shown to the user at sign-in.
        </p>
      </Modal>
    </Card>
  )
}
