import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { useLearners } from '../hooks/useLearners'
import { subscribeUserProfiles } from '../firestore/profiles'
import { categoryTitle } from '../firestore/signCatalog'
import {
  disableAccount, enableAccount, penalizeAccount, deleteAccountData, REASON_PRESETS,
} from '../firestore/moderation'
import {
  Card, PageHeader, Spinner, EmptyState, Badge, ProgressBar, Btn, Modal, useToast, cn,
  Avatar, RankBadge, ReasonSelect,
} from '../components/ui'
import { num, pct, relativeDays, formatDate } from '../lib/format'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'restricted', label: 'Restricted' },
]

function useAccountStatuses() {
  const [map, setMap] = useState({})
  useEffect(() => {
    return onSnapshot(collection(db, 'accountStatus'), (snap) => {
      const m = {}
      snap.docs.forEach((d) => { m[d.id] = d.data() })
      setMap(m)
    }, () => setMap({}))
  }, [])
  return map
}

function statusOf(uid, statuses) {
  const s = statuses[uid]
  if (!s) return { kind: 'ok' }
  if (s.disabled) return { kind: 'disabled', reason: s.reason }
  const until = s.lockedUntil?.toDate ? s.lockedUntil.toDate() : null
  if (until && until > new Date()) return { kind: 'locked', until, reason: s.reason }
  return { kind: 'ok' }
}

export default function Users() {
  const { learners, loading } = useLearners()
  const statuses = useAccountStatuses()
  const [profiles, setProfiles] = useState({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [manage, setManage] = useState(null)
  const [viewing, setViewing] = useState(null)

  useEffect(() => subscribeUserProfiles(setProfiles, () => setProfiles({})), [])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return learners
      .map((l) => ({ ...l, profile: profiles[l.uid] || null }))
      .filter((l) => {
        if (term && !l.displayName.toLowerCase().includes(term) && !l.email.toLowerCase().includes(term)) return false
        const st = statusOf(l.uid, statuses)
        if (filter === 'active') return l.isActive && st.kind === 'ok'
        if (filter === 'inactive') return !l.isActive
        if (filter === 'restricted') return st.kind !== 'ok'
        return true
      })
      .sort((a, b) => (b.lastActive?.getTime() || 0) - (a.lastActive?.getTime() || 0))
  }, [learners, profiles, statuses, search, filter])

  if (loading) return <Spinner label="Loading learners…" />

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Monitor every learner's progress and status — and act on accounts that need it."
      />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg font-medium',
                filter === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-400 dark:text-slate-500 ml-auto">{num(rows.length)} learners</span>
      </div>

      <Card className="p-0 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No learners match" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                  <th className="py-3 px-4 font-medium">User</th>
                  <th className="py-3 px-4 font-medium">Rank Tier</th>
                  <th className="py-3 px-4 font-medium">Level</th>
                  <th className="py-3 px-4 font-medium">Last Active</th>
                  <th className="py-3 px-4 font-medium">Overall Progress</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const st = statusOf(l.uid, statuses)
                  return (
                    <tr key={l.uid} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <button onClick={() => setViewing(l)} className="flex items-center gap-3 text-left group">
                          <Avatar name={l.displayName} url={l.profile?.avatarUrl} size={38} />
                          <span>
                            <p className="font-medium text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{l.displayName}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{l.email || l.uid}</p>
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-4"><RankBadge rank={l.rank} /></td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">Lv {l.level}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{relativeDays(l.daysSinceActive)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <ProgressBar fraction={l.overallProgress} />
                          <span className="text-slate-600 dark:text-slate-300 w-10">{pct(l.overallProgress)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4"><StatusBadge st={st} /></td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Btn size="sm" variant="ghost" onClick={() => setViewing(l)}>View</Btn>
                        <Btn size="sm" variant="outline" onClick={() => setManage(l)}>Manage</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {viewing && (
        <ViewProfileModal
          learner={viewing}
          status={statusOf(viewing.uid, statuses)}
          onClose={() => setViewing(null)}
          onManage={() => { setManage(viewing); setViewing(null) }}
        />
      )}

      {manage && (
        <ManageUserModal
          learner={manage}
          status={statusOf(manage.uid, statuses)}
          onClose={() => setManage(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ st }) {
  if (st.kind === 'disabled') return <Badge tone="red">Disabled</Badge>
  if (st.kind === 'locked') return <Badge tone="amber">Locked</Badge>
  return <Badge tone="green">Active</Badge>
}

// ── View profile ────────────────────────────────────────────────────────────

function ViewProfileModal({ learner, status, onClose, onManage }) {
  const p = learner.profile
  const joined = p?.joinedCommunityIds?.length || 0
  return (
    <Modal open onClose={onClose} title="Learner profile" wide
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <Btn variant="primary" onClick={onManage}>Manage account</Btn>
      </>}>
      {/* Banner: the cover photo when there is one, otherwise a plain solid
          colour — same layout either way so the header never shifts. Flush to
          the modal edges and behind the avatar. */}
      <div className="-mx-6 -mt-5 h-40 relative">
        {p?.bannerUrl
          ? <img src={p.bannerUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-indigo-500 dark:bg-indigo-600" />}
      </div>
      {/* Avatar overlaps the banner and paints IN FRONT (relative z-10), with a
          ring so it reads clearly against either the photo or the solid colour. */}
      <div className="relative z-10 -mt-12 ml-1 mb-2 w-fit rounded-full ring-4 ring-white dark:ring-slate-900">
        <Avatar name={learner.displayName} url={p?.avatarUrl} size={88} />
      </div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white text-lg leading-tight truncate">{learner.displayName}</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 truncate">{learner.email || learner.uid}</p>
        </div>
        <RankBadge rank={learner.rank} size={20} pill />
      </div>

      {status.kind !== 'ok' && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300 mb-4">
          {status.kind === 'disabled' ? 'This account is disabled — the learner cannot sign in.' : `Locked until ${formatDate(status.until)}.`}
          {status.reason && <span className="block text-xs mt-1 opacity-80">Reason: {status.reason}</span>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Field label="Level" value={`Lv ${learner.level}`} />
        <Field label="Progress" value={pct(learner.overallProgress)} />
        <Field label="Signs learned" value={`${num(learner.signsLearned)}/${num(learner.signsTotal)}`} />
        <Field label="Accuracy" value={pct(learner.accuracy)} />
        <Field label="Streak" value={`${num(learner.streakDays)}d (best ${num(learner.bestStreak)})`} />
        <Field label="Quizzes" value={num(learner.quizLevelsCleared)} />
        <Field label="Achievements" value={num(learner.achievementsUnlocked)} />
        <Field label="Followers" value={num(p?.followerCount ?? 0)} />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400 dark:text-slate-500 mb-4">
        <span>Following: {num(p?.followingCount ?? 0)}</span>
        <span>Communities: {num(joined)}</span>
        <span>Study time: {learner.studySeconds ? `${Math.round(learner.studySeconds / 60)}m` : '—'}</span>
        <span>Last active: {learner.lastActive ? formatDate(learner.lastActive) : 'never'}</span>
      </div>

      {/* Per-category progress */}
      {learner.categories?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Module progress</p>
          <div className="space-y-2">
            {learner.categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-slate-700 dark:text-slate-200">{categoryTitle(c.id)}</span>
                <div className="flex-1"><ProgressBar fraction={c.total ? c.learned / c.total : 0} /></div>
                <span className="w-14 text-right text-slate-500 dark:text-slate-400">{num(c.learned)}/{num(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Manage user modal (the admin powers) ────────────────────────────────────

function ManageUserModal({ learner, status, onClose }) {
  const { user: admin } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [penaltyValue, setPenaltyValue] = useState(24)
  const [penaltyUnit, setPenaltyUnit] = useState('hours')
  const [reason, setReason] = useState('')

  const label = learner.displayName
  const presetKey = confirm === 'delete' ? 'delete' : confirm === 'penalize' ? 'penalize' : 'disable'

  async function run(fn, successMsg) {
    setBusy(true)
    try {
      await fn()
      toast(successMsg, 'success')
      setConfirm(null)
      onClose()
    } catch (e) {
      toast(e.message || 'Action failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const isRestricted = status.kind !== 'ok'

  return (
    <Modal open onClose={onClose} title={`Manage · ${label}`} wide
      footer={<Btn variant="ghost" onClick={onClose}>Close</Btn>}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar name={label} url={learner.profile?.avatarUrl} size={44} />
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">{label}</p>
            <RankBadge rank={learner.rank} size={18} />
          </div>
        </div>

        {isRestricted && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
            {status.kind === 'disabled'
              ? 'This account is currently disabled — the learner cannot sign in.'
              : `Locked until ${formatDate(status.until)}.`}
            {status.reason && <span className="block text-xs mt-1 opacity-80">Reason: {status.reason}</span>}
          </div>
        )}

        {/* Reason picker with default choices — only when an action is staged. */}
        {confirm && (
          <ReasonSelect presets={REASON_PRESETS[presetKey]} value={reason} onChange={setReason} />
        )}

        {confirm === null && (
          <div className="flex flex-wrap gap-2">
            {isRestricted ? (
              <Btn variant="primary" disabled={busy}
                onClick={() => run(() => enableAccount(learner.uid, admin, { reason: '', label }), 'Account unrestricted')}>
                Unrestrict account
              </Btn>
            ) : (
              <>
                <Btn variant="warn" disabled={busy} onClick={() => { setReason(''); setConfirm('penalize') }}>Time-penalty</Btn>
                <Btn variant="danger" disabled={busy} onClick={() => { setReason(''); setConfirm('disable') }}>Disable account</Btn>
              </>
            )}
            <Btn variant="danger" disabled={busy} onClick={() => { setReason(''); setConfirm('delete') }}>Delete account</Btn>
          </div>
        )}

        {confirm === 'penalize' && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Lock sign-in for how long?</p>
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={penaltyValue}
                onChange={(e) => setPenaltyValue(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
              <select value={penaltyUnit} onChange={(e) => setPenaltyUnit(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Btn variant="warn" disabled={busy || !reason}
                onClick={() => run(
                  () => penalizeAccount(learner.uid, penaltyUnit === 'days' ? penaltyValue * 24 : penaltyValue, admin, { reason, label }),
                  `Locked for ${penaltyValue} ${penaltyUnit}`,
                )}>
                Apply penalty
              </Btn>
              <Btn variant="ghost" onClick={() => setConfirm(null)}>Cancel</Btn>
            </div>
          </div>
        )}

        {confirm === 'disable' && (
          <ConfirmBlock
            text="Disable this account? The learner will be signed out and blocked from signing in until unrestricted."
            confirmLabel="Disable"
            busy={busy}
            disabled={!reason}
            onCancel={() => setConfirm(null)}
            onConfirm={() => run(() => disableAccount(learner.uid, admin, { reason, label }), 'Account disabled')}
          />
        )}

        {confirm === 'delete' && (
          <ConfirmBlock
            text="Delete this learner's account? This wipes everything — posts, comments, communities they created, progress, and their profile — exactly like the app's own Delete Account, and blocks sign-in. This cannot be undone."
            note="Note: without a Cloud Function, the Firebase Auth record itself can't be removed from here, so the account is also disabled to fully block access. The reason above is shown to the user at sign-in."
            confirmLabel="Delete everything"
            busy={busy}
            disabled={!reason}
            onCancel={() => setConfirm(null)}
            onConfirm={() => run(async () => {
              const r = await deleteAccountData(learner.uid, admin, { reason, label })
              if (r.errors.length) throw new Error(`Partial: ${r.errors.join('; ')}`)
            }, 'Account fully deleted & sign-in blocked')}
          />
        )}
      </div>
    </Modal>
  )
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-100 dark:bg-slate-800/70 p-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900 dark:text-white text-lg mt-0.5">{value}</p>
    </div>
  )
}

function ConfirmBlock({ text, note, confirmLabel, onConfirm, onCancel, busy, disabled }) {
  return (
    <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/20 p-4 space-y-3">
      <p className="text-sm text-rose-800 dark:text-rose-200">{text}</p>
      {note && <p className="text-xs text-rose-600/80 dark:text-rose-300/70">{note}</p>}
      {disabled && <p className="text-xs text-rose-500">Pick a reason above first.</p>}
      <div className="flex gap-2">
        <Btn variant="danger" disabled={busy || disabled} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Btn>
      </div>
    </div>
  )
}
