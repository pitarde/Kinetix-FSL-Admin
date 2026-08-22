import { categoryTitle, SIGN_NAME, SIGN_CATEGORY, CATEGORIES } from './signCatalog'

// Aggregates the per-learner activity (normalised in learners.js) into the four
// analytics levels the Insights view renders. The per-learner formulas mirror
// the mobile app's own ProfileAnalytics.kt (accuracy = correct/attempts,
// confusion pairs by frequency, linear signs-learned projection, decay by days
// since practice); here they're summed across ALL learners for the admin.
//
// Everything degrades gracefully: an empty Firestore yields zeros and empty
// lists, never a throw and never fabricated numbers.

const MS_PER_DAY = 86_400_000
const todayEpochDay = () => Math.floor(Date.now() / MS_PER_DAY)

function mean(nums) {
  const xs = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n))
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function addInto(map, key, n) {
  map.set(key, (map.get(key) || 0) + n)
}

// ── DESCRIPTIVE ───────────────────────────────────────────────────────────

function descriptive(learners) {
  const total = learners.length
  const active = learners.filter((l) => l.isActive).length
  const withAccuracy = learners.filter((l) => l.accuracy != null)
  const avgAccuracy = mean(withAccuracy.map((l) => l.accuracy))
  const avgSessionMinutes = mean(learners.filter((l) => l.avgSessionMinutes > 0).map((l) => l.avgSessionMinutes))

  // Monthly learner growth: bucket each learner by the month of their EARLIEST
  // recorded activity day (a join proxy — the progress doc carries no signup
  // date), then present it cumulatively.
  const firstMonth = new Map()
  for (const l of learners) {
    const days = Array.isArray(l.activity.activeDays) ? l.activity.activeDays : []
    if (!days.length) continue
    const earliest = Math.min(...days)
    const d = new Date(earliest * MS_PER_DAY)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    addInto(firstMonth, key, 1)
  }
  const months = [...firstMonth.keys()].sort()
  let running = 0
  const monthlyGrowth = months.map((key) => {
    running += firstMonth.get(key)
    const [y, m] = key.split('-')
    const label = new Date(Number(y), Number(m) - 1, 1)
      .toLocaleString(undefined, { month: 'short', year: '2-digit' })
    return { key, label, newLearners: firstMonth.get(key), cumulative: running }
  })

  return {
    totalLearners: total,
    activeLearners: active,
    inactiveLearners: total - active,
    avgAccuracy,
    avgSessionMinutes,
    monthlyGrowth,
  }
}

// ── DIAGNOSTIC ────────────────────────────────────────────────────────────

function diagnostic(learners) {
  const correct = new Map()
  const attempts = new Map()
  const started = new Map()
  const completed = new Map()
  const learnersPerCat = new Map()
  const confusion = new Map()
  const errorTotals = { handshape: 0, motion: 0, timing: 0 }

  for (const l of learners) {
    const a = l.activity
    for (const [cat, n] of Object.entries(a.categoryCorrect || {})) addInto(correct, cat, Number(n) || 0)
    for (const [cat, n] of Object.entries(a.categoryAttempts || {})) addInto(attempts, cat, Number(n) || 0)
    for (const [cat, n] of Object.entries(a.lessonsStarted || {})) { addInto(started, cat, Number(n) || 0); addInto(learnersPerCat, cat, 1) }
    for (const [cat, n] of Object.entries(a.lessonsCompleted || {})) addInto(completed, cat, Number(n) || 0)
    for (const m of a.mistakes || []) {
      const pair = [m.tw, m.c].sort().join('  ↔  ')
      if (m.tw && m.c) addInto(confusion, pair, 1)
    }
    errorTotals.handshape += Number(a.cameraErrors?.handshape) || 0
    errorTotals.motion += Number(a.cameraErrors?.motion) || 0
    errorTotals.timing += Number(a.cameraErrors?.timing) || 0
  }

  // One row per module, ranked hardest-first (lowest accuracy).
  const perCategory = CATEGORIES.map((c) => {
    const att = attempts.get(c.id) || 0
    const cor = correct.get(c.id) || 0
    const start = started.get(c.id) || 0
    const comp = completed.get(c.id) || 0
    const engaged = learnersPerCat.get(c.id) || 0
    return {
      id: c.id,
      title: c.title,
      accuracy: att > 0 ? cor / att : null,
      attempts: att,
      avgAttemptsPerLearner: engaged > 0 ? start / engaged : 0,
      started: start,
      completed: comp,
      completionRate: start > 0 ? Math.min(1, comp / start) : null,
      learnersEngaged: engaged,
    }
  }).sort((x, y) => (x.accuracy ?? 2) - (y.accuracy ?? 2))

  const confusionPairs = [...confusion.entries()]
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const errTotal = errorTotals.handshape + errorTotals.motion + errorTotals.timing
  const errorBreakdown = errTotal > 0
    ? [
        { type: 'Handshape', value: errorTotals.handshape, pct: errorTotals.handshape / errTotal },
        { type: 'Motion', value: errorTotals.motion, pct: errorTotals.motion / errTotal },
        { type: 'Timing', value: errorTotals.timing, pct: errorTotals.timing / errTotal },
      ]
    : []

  return { perCategory, confusionPairs, errorBreakdown, errTotal }
}

// ── PREDICTIVE ────────────────────────────────────────────────────────────

function predictive(learners) {
  // Platform-wide signs-learned per day (dated), bucketed into the last 8 weeks
  // then projected 4 weeks forward with a linear (average-of-recent) slope.
  const perDay = new Map()
  for (const l of learners) {
    for (const [day, n] of Object.entries(l.activity.dailyLearned || {})) {
      addInto(perDay, Number(day), Number(n) || 0)
    }
  }
  const today = todayEpochDay()
  const WEEKS_BACK = 8
  const weeks = []
  for (let w = WEEKS_BACK - 1; w >= 0; w--) {
    const end = today - w * 7
    let sum = 0
    for (let d = end - 6; d <= end; d++) sum += perDay.get(d) || 0
    weeks.push(sum)
  }
  // Cumulative actual.
  let acc = 0
  const actual = weeks.map((n, i) => {
    acc += n
    return { week: i + 1, learned: acc, projected: null }
  })
  const slope = mean(weeks)
  const lastVal = actual.length ? actual[actual.length - 1].learned : 0
  const projected = []
  for (let i = 1; i <= 4; i++) {
    projected.push({ week: WEEKS_BACK + i, learned: null, projected: Math.round(lastVal + slope * i) })
  }
  // Stitch: the last actual point also carries the projected value so the two
  // lines meet on the chart.
  if (actual.length) actual[actual.length - 1].projected = lastVal
  const forecast = [...actual, ...projected]

  // Per-learner churn risk: recency + frequency-drop, both explainable.
  const churn = learners.map((l) => {
    const days = Array.isArray(l.activity.activeDays) ? l.activity.activeDays : []
    const recent = days.filter((d) => d > today - 14).length
    const prior = days.filter((d) => d > today - 28 && d <= today - 14).length
    const recencyRisk = l.daysSinceActive == null ? 0.5 : Math.min(1, l.daysSinceActive / 14)
    const freqDrop = prior > 0 ? Math.max(0, (prior - recent) / prior) : (recent === 0 ? 0.4 : 0)
    const score = Math.min(1, 0.6 * recencyRisk + 0.4 * freqDrop)
    let reason
    if (l.daysSinceActive == null) reason = 'No recent activity on record'
    else if (recencyRisk >= 0.8) reason = `Inactive ${l.daysSinceActive} days`
    else if (freqDrop >= 0.5) reason = `Practice frequency dropped (${prior}→${recent} days/2wk)`
    else reason = 'Engaged'
    return { uid: l.uid, name: l.displayName, score, reason, daysSinceActive: l.daysSinceActive }
  }).sort((a, b) => b.score - a.score)

  const atRisk = churn.filter((c) => c.score >= 0.6)
  return { forecast, slope, churn, atRiskCount: atRisk.length }
}

// ── PRESCRIPTIVE ──────────────────────────────────────────────────────────

function prescriptive(diag, pred) {
  // "Signs needing action": rank modules by low accuracy AND high attempts,
  // then surface individual confused signs underneath.
  const signsNeedingAction = diag.perCategory
    .filter((c) => c.accuracy != null && c.attempts > 0)
    .map((c) => ({
      ...c,
      // Higher = more urgent: mostly-wrong plus lots of attempts.
      priority: (1 - c.accuracy) * Math.log10(c.attempts + 10),
    }))
    .sort((a, b) => b.priority - a.priority)

  const confusedSigns = diag.confusionPairs.slice(0, 5).map((p) => ({
    label: p.pair,
    count: p.count,
    action: `Add a side-by-side "spot the difference" drill for ${p.pair}`,
  }))

  // Per-learner recommended review (for the most at-risk learners).
  const learnerActions = pred.churn.slice(0, 8).map((c) => ({
    uid: c.uid,
    name: c.name,
    risk: c.score,
    action: c.score >= 0.6
      ? 'Send a re-engagement nudge; suggest a short 3-min refresher'
      : 'On track — keep the streak going',
  }))

  return { signsNeedingAction, confusedSigns, learnerActions }
}

// ── LESSONS ANALYTICS (Figs 29–31 table) ──────────────────────────────────

/**
 * Per-lesson breakdown. NOTE on grain: the app syncs accuracy/attempts at the
 * category (module) level, not per individual sign, so each row here is a
 * module. Where per-sign signal exists (confusion mistakes), it feeds the
 * "signs needing action" list instead of inventing per-sign accuracy.
 */
function lessons(diag) {
  return diag.perCategory.map((c) => ({
    id: c.id,
    lesson: c.title,
    accuracy: c.accuracy,
    avgAttempts: c.avgAttemptsPerLearner,
    completionRate: c.completionRate,
    learnersEngaged: c.learnersEngaged,
  }))
}

export function computeAnalytics(learners) {
  const desc = descriptive(learners)
  const diag = diagnostic(learners)
  const pred = predictive(learners)
  const pres = prescriptive(diag, pred)
  return {
    descriptive: desc,
    diagnostic: diag,
    predictive: pred,
    prescriptive: pres,
    lessons: lessons(diag),
  }
}

export { categoryTitle, SIGN_NAME, SIGN_CATEGORY }
