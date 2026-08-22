import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLearners } from '../hooks/useLearners'
import { computeAnalytics } from '../firestore/analytics'
import { activityWindows, fetchPostsCount, subscribeOpenReportsCount, subscribePendingValidationCount } from '../firestore/stats'
import { Card, PageHeader, SectionTitle, StatCard, Spinner, EmptyState, Badge } from '../components/ui'
import { LineTrend, PALETTE } from '../components/charts'
import { num, pct } from '../lib/format'

export default function Dashboard() {
  const { learners, loading } = useLearners()
  const [postsCount, setPostsCount] = useState(null)
  const [openReports, setOpenReports] = useState(null)
  const [pendingValidations, setPendingValidations] = useState(null)

  useEffect(() => { fetchPostsCount().then(setPostsCount) }, [])
  useEffect(() => subscribeOpenReportsCount(setOpenReports, () => setOpenReports(null)), [])
  useEffect(() => subscribePendingValidationCount(setPendingValidations, () => setPendingValidations(null)), [])

  const analytics = useMemo(() => computeAnalytics(learners), [learners])
  const windows = useMemo(() => activityWindows(learners), [learners])
  const desc = analytics.descriptive

  if (loading) return <Spinner label="Loading learners…" />

  const kpis = [
    { label: 'Total Learners', value: num(desc.totalLearners) },
    { label: 'DAU', value: num(windows.dau), sub: 'active today' },
    { label: 'WAU', value: num(windows.wau), sub: 'active this week' },
    { label: 'MAU', value: num(windows.mau), sub: 'active this month' },
    { label: 'Total Posts', value: postsCount == null ? '—' : num(postsCount) },
    { label: 'Pending Validations', value: pendingValidations == null ? '—' : num(pendingValidations), tone: pendingValidations > 0 ? 'warn' : 'default' },
    { label: 'Pending Reports', value: openReports == null ? '—' : num(openReports), tone: openReports > 0 ? 'warn' : 'default' },
    { label: 'Active Streaks Today', value: num(windows.activeStreaks) },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of Kinetix FSL learners and community health." />

      {desc.totalLearners === 0 && (
        <div className="mb-6">
          <EmptyState
            title="No learner data yet"
            hint="KPIs populate as the mobile app syncs learner progress to Firestore."
          />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => <StatCard key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle hint="Cumulative learners by first recorded activity">Learner growth</SectionTitle>
          {desc.monthlyGrowth.length === 0 ? (
            <EmptyState title="Not enough history yet" />
          ) : (
            <LineTrend
              data={desc.monthlyGrowth}
              xKey="label"
              series={[{ key: 'cumulative', name: 'Total learners', color: PALETTE.indigo }]}
              height={240}
            />
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>At a glance</SectionTitle>
          <div className="space-y-4">
            <Glance label="Avg. detection accuracy" value={pct(desc.avgAccuracy)} />
            <Glance label="Active learners" value={`${num(desc.activeLearners)} / ${num(desc.totalLearners)}`} />
            <Glance
              label="Churn-risk learners"
              value={num(analytics.predictive.atRiskCount)}
              badge={analytics.predictive.atRiskCount > 0 ? <Badge tone="red">needs attention</Badge> : null}
            />
            <div className="pt-2 flex flex-col gap-1 text-sm">
              <Link to="/analytics" className="text-indigo-600 dark:text-indigo-400 hover:underline">Open full analytics →</Link>
              <Link to="/reports" className="text-indigo-600 dark:text-indigo-400 hover:underline">Review reports →</Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Glance({ label, value, badge }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex items-center gap-2">
        {badge}
        <span className="font-semibold text-slate-900 dark:text-white">{value}</span>
      </span>
    </div>
  )
}
