# KinetixFSL Admin — Analytics & Moderation: Cowork Prompt Pack

Two ready-to-paste prompts for building the admin analytics + community-moderation feature, plus the grounding I gathered from your actual repos and manuscript so both prompts are accurate instead of generic.

- **Section 2 (Full Prompt)** — use for the first real build session. More context, fewer wrong guesses, fewer clarifying round-trips.
- **Section 3 (Lean Prompt)** — same scope, ~40% the length. Use for a follow-up session, a retry, or when you want to spend fewer tokens.

Paste one prompt as the *first message* of a fresh Cowork/Claude Code session opened on both repos. Don't paste both.

---

## 1. What I found before writing these (read once — not part of either prompt)

**Admin app is not Electron.** The manuscript (Fig. 2.2, and the dev-phase text) describes the admin panel as an Electron.js desktop app. The actual code in `Kinetix-FSL-Admin` is a **React 19 + Vite + Tailwind 4 + Firebase 12 + react-router-dom 7 web app** — same mismatch pattern as the Figure 1 Cloudflare-R2-vs-Firebase-Storage note already in your sprint plan. Both prompts below tell Cowork to build for what's actually there and flag the manuscript for a documentation fix, rather than migrate a working app to Electron this late. Say if you want it the other way.

**The nav already anticipates this feature.** `Layout.jsx` already has `NAV_ITEMS` wired for `/reports` (labeled "Reports & Moderation"), `/users`, `/analytics`, `/content`, `/validation`, `/broadcast`, `/audit-log` — all currently rendering `Placeholder.jsx` ("Coming soon"). `Dashboard.jsx` already has a KPI grid with placeholder cards including **Pending Reports** and **Total Posts**. You're filling in scaffolding that's already there, not inventing new screens.

**Firestore has no moderation or admin-role plumbing yet.** I read `web/firestore.rules` in full: it defines `posts`, `users`, `communities`, `notifications`, `conversations` — and ends with `match /{document=**} { allow read, write: if false; }`. There is no `reports` collection, no admin-role check (no custom claims, no `admins` allowlist) anywhere in the rules. This means:
- The report button's write target doesn't exist server-side yet — it has to be designed, not just wired up.
- Nothing today lets an admin account disable/delete/penalize *someone else's* account or post — every current rule only lets a user write their own data. This is the actual hard part of the task, not the charts.

**Existing code to reuse, not duplicate.** The mobile app already computes learner-facing analytics client-side under `app/src/main/java/com/example/kinetixfsl/profile/`: `ProfileAnalytics.kt`, `AnalyticsCommon.kt`, `AnalyticsForecast.kt`, `AnalyticsProgress.kt`, `AnalyticsWeakSpots.kt`, `AnalyticsCoach.kt`. These likely already contain the accuracy/attempt/forecast formulas your manuscript describes — the admin's platform-wide analytics should reuse that logic (aggregated across users) rather than re-derive it from scratch.

**Full file map both prompts point Cowork to** — already confirmed to exist:
```
Kinetix-FSL-Admin/
  src/firebase.js, AuthContext.jsx, OtpContext.jsx, ThemeContext.jsx,
      ProtectedRoute.jsx, Layout.jsx
  src/pages/Dashboard.jsx, Login.jsx, VerifyOtp.jsx, Placeholder.jsx
  package.json (react 19, firebase 12, react-router-dom 7, tailwind 4 — no chart lib yet)

Kinetix-FSL/
  web/firestore.rules, web/firestore.indexes.json
  app/src/main/java/com/example/kinetixfsl/
    community/  (Post.kt, Comment.kt, UserProfile.kt, CommunityRepository.kt,
                 PostActionsSheet.kt, CommunityFeedViewModel.kt)
    progress/   (ProgressRepository.kt, ProgressModels.kt, ProgressSync.kt,
                 ProgressSyncWorker.kt, ActivityLog.kt, XpEngine.kt)
    data/local/ (KinetixDatabase.kt, ProgressEntities.kt, ActivityEntities.kt)
    profile/    (ProfileAnalytics.kt, AnalyticsCommon.kt, AnalyticsForecast.kt,
                 AnalyticsProgress.kt, AnalyticsWeakSpots.kt, AnalyticsCoach.kt)
    account/    (AccountEraser.kt)
    auth/       (AuthRepository.kt)
```

Manuscript sections worth reading directly if Cowork wants the original spec: **Objective 5** (four-level analytics definitions), **Figures 27–31** (Login/Insights/Users Analytics/Lessons Analytics admin screens), and the **Level‑1 DFD / Administrator data-flow paragraph** (Account Management Actions, Aggregate Usage Metrics, Detection Log Analytics, User and Lesson Reports).

---

## 2. Full Prompt (paste into Cowork)

```
You're building the admin-side analytics and community-moderation feature for
KinetixFSL, a Filipino Sign Language learning app. Two repos are open in this
project: Kinetix-FSL (Android/Kotlin mobile app) and Kinetix-FSL-Admin (React
19 + Vite + Tailwind + Firebase web admin panel — NOT Electron, despite what
the manuscript says; build for the web app that's actually there and flag the
manuscript mismatch instead of migrating).

READ FIRST, before writing any code:
1. Kinetix-FSL-Admin/src/firebase.js, AuthContext.jsx, Layout.jsx,
   ProtectedRoute.jsx, pages/Dashboard.jsx, pages/Placeholder.jsx,
   package.json — this is the current admin scaffold. Layout.jsx already
   defines nav routes for /reports, /users, /analytics, /content,
   /validation, /broadcast, /audit-log, all rendering Placeholder.jsx right
   now. Dashboard.jsx already has a KPI grid with placeholder values
   including "Pending Reports" and "Total Posts". Build INTO this scaffold —
   don't restructure the nav or invent new routes for what's asked below.
2. Kinetix-FSL/web/firestore.rules and firestore.indexes.json — the current
   security rules. There is currently NO reports collection, NO admin-role
   check, and the ruleset ends with a catch-all deny. Any admin write
   (disable account, delete account, penalize account, resolve a report,
   delete someone else's post) needs new rules and you must design the
   admin-authorization mechanism (Firebase custom claims set via Admin SDK,
   or an `admins/{uid}` allowlist collection checked in rules — pick one,
   state which and why, and use it consistently). Do not silently assume
   Firestore rules alone can cover this if an action truly needs privileged
   access — a Cloud Function using the Firebase Admin SDK is the correct
   place for anything a normal user's own rules can't safely allow. We are
   staying on direct Firebase SDK calls / Cloud Functions, not a custom
   Node REST layer.
3. Kinetix-FSL/app/src/main/java/com/example/kinetixfsl/community/ —
   Post.kt, Comment.kt, UserProfile.kt, CommunityRepository.kt,
   PostActionsSheet.kt, CommunityFeedViewModel.kt. Find the existing report
   button/flow (if one is already stubbed) and its current data shape.
4. Kinetix-FSL/app/src/main/java/com/example/kinetixfsl/progress/ and
   data/local/ — ProgressRepository.kt, ProgressModels.kt, ProgressSync.kt,
   ProgressSyncWorker.kt, KinetixDatabase.kt, ProgressEntities.kt,
   ActivityEntities.kt. Confirm what Firestore collection(s), if any,
   progress/detection-log data currently syncs TO. Don't assume a
   collection name — verify it from this sync code.
5. Kinetix-FSL/app/src/main/java/com/example/kinetixfsl/profile/ —
   ProfileAnalytics.kt, AnalyticsCommon.kt, AnalyticsForecast.kt,
   AnalyticsProgress.kt, AnalyticsWeakSpots.kt, AnalyticsCoach.kt. These
   already compute per-learner accuracy/attempt/forecast metrics
   client-side. Reuse this logic's definitions (aggregated across all
   users) for the admin analytics below instead of inventing new formulas.
6. account/AccountEraser.kt and auth/AuthRepository.kt — the existing
   self-service delete-account and auth flow, which the admin-triggered
   disable/delete/penalty actions below need to extend consistently with
   (same data cleanup on delete; login flow must honor an admin-set
   disabled/penalized state).

THE FOUR-LEVEL ANALYTICS MODULE (Insights view, from manuscript Objective 5
and Figures 28–31 — build these as real Firestore-backed views replacing the
Dashboard.jsx KPI placeholders and the /analytics Placeholder route):

- Descriptive: total active/inactive learners, average detection accuracy,
  average session duration, monthly learner growth (line chart).
- Diagnostic: per-sign accuracy rates, average attempts per lesson (bar
  chart), average completion time, ranked by lesson category/individual
  sign difficulty.
- Predictive: detection-accuracy forecast over time (line chart) and a
  per-learner churn-risk score flagging disengagement risk. A lightweight,
  explainable heuristic (trend/moving-average for the forecast; a rule-based
  score from session recency + frequency drop for churn) is sufficient for
  this MVP — don't build or train a new ML model for this unless you have a
  specific reason to and say so.
- Prescriptive: a "Signs needing Action" ranked list (low accuracy + high
  attempts) surfaced to the admin, and per-learner recommended review
  actions based on their weak-spot pattern.

Also build, matching Figures 29–31's exact table columns:
- Users Analytics table (/users route): User, Rank Tier, Level, Last
  Active, Overall Progress — filterable, this is the admin's "monitor every
  user's progress and status" view.
- Lessons Analytics (within /analytics or a dedicated view): all-lessons
  summary plus a per-lesson breakdown table (Sign, Accuracy/Confidence,
  Average Attempts, Average Time).

ADMIN ACCOUNT-MANAGEMENT POWERS (the actual "power of the admin" — wire
these into the Users Analytics table and the Reports view):
- Disable an account (blocks login until re-enabled).
- Remove/delete an account (server-side equivalent of AccountEraser.kt,
  triggered by the admin instead of the user).
- Time-penalty an account: lock login for N hours/days set by the admin.
  The mobile app's login/auth check must read this state and block sign-in
  with a clear "you're temporarily restricted until <time>" message —
  this is a cross-repo change, not admin-side only.

REPORTS & MODERATION (/reports route — the community report button flow):
- Design the `reports` Firestore collection: which post/comment was
  reported, the reporter's uid, their stated reason/opinion text, status
  (open/resolved/dismissed), timestamp. Wire the mobile app's report
  button (in community/) to write to it if it isn't wired yet.
- Admin view: list open reports with the reported content and the
  reporter's note, each with actions — delete the post, disable / penalize
  (with a duration picker) / delete the offending account, or dismiss the
  report. Mark reports resolved after action.

ADMIN FEATURE IDEAS — since /content, /broadcast, and /audit-log are
already scaffolded as empty nav routes, propose (don't necessarily build
all of) what belongs on each: lesson content management, an announcement/
broadcast tool, and an audit log of admin actions (who disabled/deleted/
penalized whom and when — this matters for accountability given how much
power these actions have). Give me a short list of ideas per route before
building anything beyond what's requested above, so I can pick scope.

CONSTRAINTS:
- No chart library is installed yet (`package.json` has none) — pick a
  lightweight one (e.g. Recharts), note why, add it.
- Don't fabricate demo data in the shipped UI. Handle the empty-Firestore
  case gracefully; a small optional seed script for local testing is fine
  if you flag it as dev-only.
- Confirm the actual Firestore progress/detection-log collection name from
  the sync code (step 4 above) before writing any analytics query against
  it — do not guess a collection name.
- End with: a short summary of what you built vs. what you're proposing as
  ideas only, and the admin-authorization mechanism you chose and why.
```

---

## 3. Lean Prompt (paste into Cowork — same scope, fewer tokens)

```
KinetixFSL admin feature. Repos: Kinetix-FSL (Android/Kotlin) +
Kinetix-FSL-Admin (React19/Vite/Tailwind/Firebase web — NOT Electron,
despite manuscript; flag mismatch, don't migrate).

READ FIRST (don't guess these):
- Admin/src/{firebase.js,AuthContext.jsx,Layout.jsx,ProtectedRoute.jsx,
  pages/Dashboard.jsx,pages/Placeholder.jsx,package.json} — nav already has
  /reports /users /analytics /content /validation /broadcast /audit-log,
  all Placeholder.jsx now. Dashboard.jsx has placeholder KPIs incl.
  "Pending Reports". Fill this scaffold, don't restructure it.
- Kinetix-FSL/web/firestore.rules + indexes.json — NO reports collection,
  NO admin-role check exists, rules end in catch-all deny. You must add:
  a `reports` collection + rules, and an admin-auth mechanism (custom
  claims via Admin SDK, or `admins/{uid}` allowlist in rules — pick one,
  say which). Privileged writes (disable/delete/penalize another user,
  delete their post) that a normal user's own rules can't cover go through
  a Cloud Function w/ Admin SDK. No Node REST layer.
- app/.../community/ (Post.kt, Comment.kt, UserProfile.kt,
  CommunityRepository.kt, PostActionsSheet.kt) — find existing report
  button/flow + data shape.
- app/.../progress/ + data/local/ (ProgressRepository.kt, ProgressSync.kt,
  ProgressSyncWorker.kt, ProgressEntities.kt, ActivityEntities.kt) — verify
  actual Firestore collection progress/detection data syncs to; don't
  assume a name.
- app/.../profile/ (ProfileAnalytics.kt, AnalyticsCommon.kt,
  AnalyticsForecast.kt, AnalyticsProgress.kt, AnalyticsWeakSpots.kt) —
  reuse these formulas aggregated platform-wide instead of new ones.
- account/AccountEraser.kt, auth/AuthRepository.kt — extend consistently
  for admin-triggered delete/disable/penalty; mobile login must honor
  admin-set disabled/penalized state.

BUILD — 4-level analytics (replace Dashboard.jsx KPIs + /analytics route,
per manuscript Figs 28-31):
- Descriptive: active/inactive learners, avg detection accuracy, avg
  session time, monthly learner growth (line chart).
- Diagnostic: per-sign accuracy, avg attempts/lesson (bar chart), avg
  completion time, difficulty ranking by category/sign.
- Predictive: accuracy forecast (line chart, trend/moving-avg is enough —
  no new ML model needed unless justified) + per-learner churn-risk score
  (rule-based from recency/frequency drop).
- Prescriptive: "Signs needing Action" ranked list (low accuracy + high
  attempts) + per-learner recommended review actions.
- Users Analytics table (/users): User, Rank Tier, Level, Last Active,
  Overall Progress, filterable.
- Lessons Analytics: all-lessons summary + per-lesson table (Sign,
  Accuracy/Confidence, Avg Attempts, Avg Time).

BUILD — admin powers on Users table + Reports view: disable account,
delete account (server-side AccountEraser equivalent), time-penalty
(admin sets duration; mobile login blocks + shows restriction message —
cross-repo change).

BUILD — Reports & Moderation (/reports): `reports` collection (post/
comment id, reporterId, reason/opinion text, status, timestamp); wire
mobile report button to it if unwired; admin view lists open reports w/
content + reporter note, actions = delete post / disable-penalize-delete
account / dismiss; mark resolved after action.

PROPOSE (don't build yet, just list ideas): what goes on /content,
/broadcast, /audit-log — audit log of admin actions especially, given the
power granted above.

CONSTRAINTS: no chart lib installed yet, pick a light one + say why; no
fake demo data in shipped UI, handle empty Firestore gracefully; confirm
real progress collection name before querying it. End with a short summary
of built-vs-proposed and the admin-auth mechanism chosen + why.
```

---

## 4. Notes

- Both prompts assume you're pasting into a Cowork session with both `Kinetix-FSL` and `Kinetix-FSL-Admin` connected/open, same as this session.
- The admin-authorization design (custom claims vs. allowlist collection, Cloud Function vs. rules-only) is the one decision I deliberately left for Cowork to make and report back, rather than picking for you sight-unseen — it depends on choices in your Firebase project (whether you're comfortable deploying Cloud Functions on your current plan) that I can't see from here.
- Doing this now means the admin feature (originally Sprint 6, descriptive-only MVP per the project's sprint plan) is being pulled forward and expanded to the full four-tier scope. Worth a quick pass over the sprint schedule once this lands, so Sprint 6 doesn't double-book the same work — say the word if you want that updated.
