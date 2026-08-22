import { useEffect, useMemo, useState } from 'react'
import { subscribeAuditLog } from '../firestore/moderation'
import { Card, PageHeader, Spinner, EmptyState, Badge } from '../components/ui'
import { formatDate, num } from '../lib/format'

const ACTION_TONE = {
  'account.disable': 'red', 'account.delete': 'red', 'account.penalize': 'amber',
  'account.enable': 'green', 'post.delete': 'red', 'comment.delete': 'red',
  'report.resolve': 'green', 'report.dismiss': 'slate',
  'broadcast.create': 'indigo', 'broadcast.delete': 'slate',
  'content.disable': 'amber', 'content.enable': 'green',
  'post.validate': 'green', 'post.reject': 'amber',
}

const DATE_RANGES = [
  { id: 'all', label: 'All time', ms: null },
  { id: '1', label: 'Today', ms: 86_400_000 },
  { id: '7', label: 'Last 7 days', ms: 7 * 86_400_000 },
  { id: '30', label: 'Last 30 days', ms: 30 * 86_400_000 },
]

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [range, setRange] = useState('all')

  useEffect(() => {
    const unsub = subscribeAuditLog(
      (data) => { setEntries(data); setLoading(false); setError(null) },
      (err) => { setError(err); setLoading(false) },
    )
    return unsub
  }, [])

  // Distinct actions actually present, for the action dropdown.
  const actionOptions = useMemo(
    () => [...new Set(entries.map((e) => e.action).filter(Boolean))].sort(),
    [entries],
  )

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase()
    const rangeMs = DATE_RANGES.find((r) => r.id === range)?.ms
    const cutoff = rangeMs ? Date.now() - rangeMs : null
    return entries.filter((e) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false
      if (cutoff != null) {
        const when = e.createdAt?.toMillis ? e.createdAt.toMillis() : 0
        if (when < cutoff) return false
      }
      if (t) {
        const hay = `${e.action || ''} ${e.adminEmail || ''} ${e.targetLabel || ''} ${e.targetUserId || ''}`.toLowerCase()
        if (!hay.includes(t)) return false
      }
      return true
    })
  }, [entries, search, actionFilter, range])

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Every admin action, append-only. Who disabled, penalized, deleted or moderated — and when."
      />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search admin or target…"
          className="px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        >
          <option value="all">All actions</option>
          {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        >
          {DATE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        {(actionFilter !== 'all' || range !== 'all' || search) && (
          <button
            onClick={() => { setSearch(''); setActionFilter('all'); setRange('all') }}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-sm text-slate-400 dark:text-slate-500 ml-auto">{num(rows.length)} entries</span>
      </div>

      {loading ? <Spinner label="Loading audit log…" />
        : error ? <EmptyState title="Couldn't load the log" hint={error.message} />
        : rows.length === 0 ? <EmptyState title="No admin actions recorded yet" />
        : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                    <th className="py-3 px-4 font-medium">When</th>
                    <th className="py-3 px-4 font-medium">Admin</th>
                    <th className="py-3 px-4 font-medium">Action</th>
                    <th className="py-3 px-4 font-medium">Target</th>
                    <th className="py-3 px-4 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(e.createdAt)}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">{e.adminEmail || e.adminId}</td>
                      <td className="py-3 px-4"><Badge tone={ACTION_TONE[e.action] || 'slate'}>{e.action}</Badge></td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        {e.targetLabel || e.targetUserId || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{e.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
    </div>
  )
}
