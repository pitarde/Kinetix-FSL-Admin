import { useMemo, useState } from 'react'
import { useLearners } from '../hooks/useLearners'
import { computeAnalytics } from '../firestore/analytics'
import { Card, PageHeader, SectionTitle, StatCard, Spinner, EmptyState, Badge, ProgressBar, cn } from '../components/ui'
import { LineTrend, BarSeries, DonutBreakdown, PALETTE } from '../components/charts'
import { num, pct, minutes } from '../lib/format'

// Named after the app's own analytics tabs (ProfileAnalytics*), which each map
// to one analytics level: Progress = descriptive, Weak Spots = diagnostic,
// Forecast = predictive, Coach's Picks = prescriptive.
const TABS = [
  { id: 'descriptive', label: 'Progress', hint: 'What happened' },
  { id: 'diagnostic', label: 'Weak Spots', hint: 'Why it happened' },
  { id: 'predictive', label: 'Forecast', hint: "What's likely next" },
  { id: 'prescriptive', label: "Coach's Picks", hint: 'What to do' },
  { id: 'lessons', label: 'Lessons', hint: 'Per-module breakdown' },
]

export default function Analytics() {
  const { learners, loading } = useLearners()
  const [tab, setTab] = useState('descriptive')
  const a = useMemo(() => computeAnalytics(learners), [learners])

  if (loading) return <Spinner label="Crunching learner analytics…" />

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Four-level insights across every learner, computed live from synced progress."
      />

      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              tab === t.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {learners.length === 0 && (
        <EmptyState title="No learner data yet" hint="Analytics populate as the mobile app syncs progress." />
      )}

      {tab === 'descriptive' && <Descriptive d={a.descriptive} />}
      {tab === 'diagnostic' && <Diagnostic d={a.diagnostic} />}
      {tab === 'predictive' && <Predictive d={a.predictive} />}
      {tab === 'prescriptive' && <Prescriptive d={a.prescriptive} />}
      {tab === 'lessons' && <Lessons rows={a.lessons} />}
    </div>
  )
}

// ── Descriptive ─────────────────────────────────────────────────────────────

function Descriptive({ d }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active learners" value={num(d.activeLearners)} sub={`of ${num(d.totalLearners)} total`} tone="good" />
        <StatCard label="Inactive learners" value={num(d.inactiveLearners)} sub="7+ days idle" tone={d.inactiveLearners > 0 ? 'warn' : 'default'} />
        <StatCard label="Avg. detection accuracy" value={pct(d.avgAccuracy)} />
        <StatCard label="Avg. session duration" value={minutes(d.avgSessionMinutes)} />
      </div>
      <Card className="p-5">
        <SectionTitle hint="Cumulative learners by first recorded activity (join-date proxy)">Monthly learner growth</SectionTitle>
        {d.monthlyGrowth.length === 0 ? <EmptyState title="Not enough history yet" /> : (
          <LineTrend
            data={d.monthlyGrowth}
            xKey="label"
            series={[
              { key: 'cumulative', name: 'Total learners', color: PALETTE.indigo },
              { key: 'newLearners', name: 'New that month', color: PALETTE.green },
            ]}
            height={280}
          />
        )}
      </Card>
    </div>
  )
}

// ── Diagnostic ──────────────────────────────────────────────────────────────

function Diagnostic({ d }) {
  const accData = d.perCategory
    .filter((c) => c.accuracy != null)
    .map((c) => ({ name: c.title, accuracy: Math.round(c.accuracy * 100) }))
  const attemptsData = d.perCategory
    .filter((c) => c.avgAttemptsPerLearner > 0)
    .map((c) => ({ name: c.title, attempts: Math.round(c.avgAttemptsPerLearner * 10) / 10 }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle hint="Correct ÷ attempts, ranked hardest-first">Per-module accuracy</SectionTitle>
          {accData.length === 0 ? <EmptyState title="No quiz attempts yet" /> : (
            <BarSeries data={accData} xKey="name" barKey="accuracy" name="Accuracy %" color={PALETTE.green} horizontal height={280} yFormatter={(v) => `${v}%`} />
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle hint="Average lesson attempts per engaged learner">Average attempts per lesson</SectionTitle>
          {attemptsData.length === 0 ? <EmptyState title="No lessons started yet" /> : (
            <BarSeries data={attemptsData} xKey="name" barKey="attempts" name="Avg attempts" color={PALETTE.indigo} horizontal height={280} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle hint="Sign pairs learners most often mix up (all learners)">Most-confused sign pairs</SectionTitle>
          {d.confusionPairs.length === 0 ? <EmptyState title="No mix-ups logged yet" /> : (
            <ul className="space-y-2">
              {d.confusionPairs.map((p) => (
                <li key={p.pair} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200 font-medium">{p.pair}</span>
                  <Badge tone="red">{num(p.count)} mix-ups</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle hint="Camera-practice failure reasons (all learners)">Error type breakdown</SectionTitle>
          {d.errorBreakdown.length === 0 ? <EmptyState title="No camera errors logged yet" /> : (
            <DonutBreakdown
              data={d.errorBreakdown.map((e, i) => ({
                name: e.type, value: e.value,
                color: [PALETTE.red, PALETTE.amber, PALETTE.yellow][i],
              }))}
              height={240}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Predictive ──────────────────────────────────────────────────────────────

function Predictive({ d }) {
  const topRisk = d.churn.slice(0, 12)
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle hint="Platform signs-learned per week, with a linear projection (dashed)">
          Signs-learned forecast
        </SectionTitle>
        <LineTrend
          data={d.forecast}
          xKey="week"
          series={[
            { key: 'learned', name: 'Actual (cumulative)', color: PALETTE.green },
            { key: 'projected', name: 'Projected', color: PALETTE.green, dashed: true },
          ]}
          height={280}
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Heuristic forecast (moving-average slope) — no ML model, matching the MVP scope.
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle hint="Rule-based: recency + practice-frequency drop">Churn-risk learners</SectionTitle>
          <Badge tone={d.atRiskCount > 0 ? 'red' : 'green'}>{num(d.atRiskCount)} at risk</Badge>
        </div>
        {topRisk.length === 0 ? <EmptyState title="No learners yet" /> : (
          <div className="space-y-2">
            {topRisk.map((c) => (
              <div key={c.uid} className="flex items-center gap-4 text-sm">
                <span className="w-40 truncate text-slate-700 dark:text-slate-200 font-medium">{c.name}</span>
                <div className="flex-1"><ProgressBar fraction={c.score} tone={c.score >= 0.6 ? 'red' : c.score >= 0.35 ? 'amber' : 'green'} /></div>
                <span className="w-12 text-right font-semibold text-slate-600 dark:text-slate-300">{pct(c.score)}</span>
                <span className="w-56 text-xs text-slate-400 dark:text-slate-500 truncate">{c.reason}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Prescriptive ────────────────────────────────────────────────────────────

function Prescriptive({ d }) {
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle hint="Low accuracy + high attempts = highest priority">Signs needing action</SectionTitle>
        {d.signsNeedingAction.length === 0 ? <EmptyState title="Nothing flagged yet" /> : (
          <div className="space-y-2">
            {d.signsNeedingAction.map((c, i) => (
              <div key={c.id} className="flex items-center gap-4 text-sm p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="w-6 h-6 shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">{c.title}</span>
                <Badge tone="amber">{pct(c.accuracy)} acc</Badge>
                <Badge tone="slate">{num(c.attempts)} attempts</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle>Recommended content fixes</SectionTitle>
          {d.confusedSigns.length === 0 ? <EmptyState title="No confusion data yet" /> : (
            <ul className="space-y-3">
              {d.confusedSigns.map((s) => (
                <li key={s.label} className="text-sm">
                  <p className="font-medium text-slate-700 dark:text-slate-200">{s.label} <span className="text-slate-400">· {num(s.count)}×</span></p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{s.action}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle hint="Per-learner review actions for the most at-risk">Recommended outreach</SectionTitle>
          {d.learnerActions.length === 0 ? <EmptyState title="No learners yet" /> : (
            <ul className="space-y-3">
              {d.learnerActions.map((l) => (
                <li key={l.uid} className="text-sm flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">{l.name}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{l.action}</p>
                  </div>
                  <Badge tone={l.risk >= 0.6 ? 'red' : 'green'}>{pct(l.risk)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Lessons Analytics table ─────────────────────────────────────────────────

function Lessons({ rows }) {
  return (
    <Card className="p-5">
      <SectionTitle hint="Grain note: the app syncs accuracy/attempts per module, not per individual sign.">
        Lessons analytics
      </SectionTitle>
      {rows.length === 0 ? <EmptyState title="No lesson data yet" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 pr-4 font-medium">Lesson</th>
                <th className="py-2 px-4 font-medium">Accuracy / Confidence</th>
                <th className="py-2 px-4 font-medium">Avg. attempts</th>
                <th className="py-2 px-4 font-medium">Completion</th>
                <th className="py-2 pl-4 font-medium">Learners</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">{r.lesson}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <ProgressBar fraction={r.accuracy ?? 0} tone={(r.accuracy ?? 0) >= 0.7 ? 'green' : (r.accuracy ?? 0) >= 0.4 ? 'amber' : 'red'} />
                      <span className="text-slate-600 dark:text-slate-300 w-10">{pct(r.accuracy)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{r.avgAttempts ? r.avgAttempts.toFixed(1) : '—'}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{pct(r.completionRate)}</td>
                  <td className="py-3 pl-4 text-slate-600 dark:text-slate-300">{num(r.learnersEngaged)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
