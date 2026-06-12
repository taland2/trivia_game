# 06 — System Architecture

> Status: **Draft v1** · Depends on: [01-product-vision.md](01-product-vision.md), [02-game-design-document.md](02-game-design-document.md)
> Binding constraint (vision §9): one person must be able to verify, deploy, and operate
> everything. Managed services over self-hosted, boring over clever.

---

## 1. Stack Decision Summary

| Layer | Choice | Rationale |
|---|---|---|
| Client | **Flutter** (Dart) | Animation-heavy playful UI, first-class RTL, identical rendering on Android+iOS, strong AI-codegen support |
| Backend | **Firebase** (GCP) | Auth + Firestore + Functions + FCM + Remote Config + Analytics + Crashlytics in one managed platform; generous free tier fits the no-monetization constraint |
| Server logic | **Mixed by sensitivity** (§4) | Functions where integrity matters, direct Firestore access where it doesn't |
| Realtime (v1.0) | Firestore listeners first; dedicated realtime evaluated at a defined gate (§6) | Don't build websocket infra the MVP doesn't need |
| Repo | **Monorepo**: `app/`, `functions/`, `content-tools/`, `docs/` | One person, one history, atomic cross-layer changes |
| Environments | **dev / staging / prod** = 3 separate Firebase projects | Release discipline from day one (user decision) |

**Minimum supported OS (decision): Android 10 (API 29) + iOS 16.** Slightly newer than the
maximal-reach option — accepted loss of a few % of very old devices in exchange for a
testing matrix one person can carry (doc 12 §5 updated accordingly).

Accepted tradeoff: Firebase lock-in. Mitigation: domain logic lives in pure Dart/TS modules
with thin Firebase adapters; the data model (doc 08) avoids Firestore-only exotica.

---

## 2. High-Level Architecture

```
┌─────────────── Flutter app (Android / iOS) ───────────────┐
│  UI layer (screens, design system)                         │
│  Domain layer (pure Dart: rules, scoring display, state)   │
│  Data layer (repositories → Firebase adapters)             │
└───┬───────────────┬───────────────┬───────────────┬───────┘
    │ Auth SDK      │ Firestore SDK │ Callable Fns  │ FCM
    ▼               ▼               ▼               ▼
┌────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐
│Firebase│  │  Firestore   │  │Cloud Functions│  │   FCM   │
│  Auth  │  │ (+ security  │  │ (TypeScript)  │  │  push   │
│(anon + │  │   rules)     │  │ - game engine │  └─────────┘
│Google/ │  └──────┬───────┘  │ - matchmaking │  ┌─────────┐
│ Apple) │         │          │ - scheduled   │  │ Remote  │
└────────┘         │          │   jobs        │  │ Config  │
                   │          └──────┬───────┘  └─────────┘
                   ▼                 ▼          ┌──────────────────┐
            (clients listen)   (functions are   │ Analytics +      │
             realtime updates   the ONLY match  │ Crashlytics      │
             via snapshots)     writers)        └──────────────────┘
```

Internal tooling (not shipped): `content-tools/` — CLI/scripts for question generation,
import, review, and publishing into Firestore (doc 03 pipeline).

---

## 3. Service Breakdown (Cloud Functions, TypeScript)

| Module | Responsibilities |
|---|---|
| `match` | Create duel, accept, serve round questions, **submit answer (scoring + server timing)**, round/match resolution, tiebreakers, forfeit job, async stranger queue (Remote Config-gated until Gate E — GDD §4.8) |
| `daily` | Publish daily set (scheduled), accept daily submissions, daily friend-board |
| `leaderboard` | Weekly point awards (transactional with match results), Monday reset job, podium snapshot |
| `social` | Friend request/accept/block, invite-code issue & redemption, username registry (uniqueness) |
| `notify` | All FCM sends; caps/quiet-hours policy from doc 05 enforced here, in one place |
| `content` | Serving engine: question selection w/ repeat-exclusion; flag handling; difficulty recalibration job (doc 03 §5) |
| `account` | Guest→registered merge, account deletion (GDPR-style flow, doc 09) |
| (v1.0) `live` | Realtime room lifecycle — see §6 gate |
| (v1.1) `tournament` | Bracket lifecycle, deadlines, advancement |

Scheduled jobs (Cloud Scheduler): turn-timeout sweep (hourly), daily-set publish (per
calendar date, sets published ahead — unlock is per-user local midnight, GDD §5), weekly
reset (Mon 00:00 Asia/Jerusalem), recalibration (nightly), guest purge (weekly),
stale-queue sweep (stranger matchmaking, hourly once enabled).

---

## 4. The Sensitivity Boundary (mixed model — discipline rules)

**Through Cloud Functions only (server-authoritative):**
- Answer submission & scoring (server timestamps both question-serve and answer-receive;
  client-reported times are display-only)
- Question serving (correct answer **never** leaves the server before the player answers —
  the served payload contains text + 4 shuffled answers, no correct flag)
- Match state transitions, round/match resolution, forfeits, tiebreakers
- Weekly points, XP grants, leaderboard writes
- Friendship mutations, invite redemption, username claims

**Direct Firestore access (guarded by security rules):**
- **Reads + realtime listeners**: own profile, friends' public profiles, own matches,
  leaderboards, match recaps (reveal-safe projections only — §5)
- **Writes**: own profile fields (display name, avatar, settings), emote sends
  (rules: rate-limited, enum-validated), notification preferences

**Rule of thumb:** anything that affects points, progression, ranking, or money-equivalents
goes through a function. Anything cosmetic/preferential writes direct. Every PR that adds a
client write must state which side of the boundary it's on (checklist in doc 13).

### Answer-submission flow (canonical)
```
client taps answer (t≈0, instant local lock animation)
  → callable fn submitAnswer(matchId, roundIx, qIx, answerIx, idempotencyKey)
  → fn validates: is player's turn · question was served · not already answered
  → score = f(correct, server_serve_ts, server_receive_ts)   // GDD §3.3
  → transactional write: answer record + round state (+ resolution if last answer)
  → response: correct answer index + points  → client plays reveal
```
Latency budget ≤ 300ms p95 (hidden by the reveal animation, doc 04 §4). Network-loss
behavior: submission retried with same idempotency key; reveal blocks on confirmation.

---

## 5. Data Visibility & Anti-Leak Design

- Firestore documents that clients can read **never contain unanswered questions' correct
  answers**. Match docs store question refs + per-player answer records; the question bank
  collection is function-readable only.
- Served-question payloads are written to a per-player subcollection (`servings/`) readable
  only by that player, containing the shuffled answer order **without** the correct index.
- Opponent's per-question results become readable only after the reader has finished the
  same round (GDD §4.2's reveal rule) — enforced by projection docs written by functions,
  not by client-side filtering.

---

## 6. Realtime Strategy

- **MVP (async only): no realtime infrastructure.** Firestore snapshot listeners give
  "live enough" updates (your-turn appears in seconds) at zero extra moving parts.
- **v1.0 live modes:** first implementation attempt uses Firestore listeners + a `live`
  functions module (room docs, per-question fan-out, server countdowns via scheduled
  question-advance). 20-player rooms × snapshot fan-out is within Firestore's comfort zone;
  the risk is **reveal-synchronization jitter** (players seeing results 0.5–2s apart).
- **Evaluation gate (decide with a prototype, before building v1.0 UI):** build a 20-client
  room simulation; if p95 question-reveal skew > ⚖️ 800ms or per-match cost is unacceptable,
  switch the live modes to a managed websocket layer (candidates: Firebase RTDB for
  ephemeral room state, or a small Cloud Run websocket service). The async stack is
  unaffected either way.
- Presence ("friend is online" for live challenges): Firebase RTDB presence pattern (the
  standard hack) — added only in v1.0.

---

## 7. Offline & Degraded-Network Behavior

- Round content is prefetched at round start (doc 04 §9): once a round begins, answering
  works through flaky network; submissions queue with idempotency keys and reconcile.
  **Server scoring uses receive-time** — extended offline mid-question scores as timeout
  (GDD §11 'app killed' rule applies); the client warns before starting a round offline.
- Fully offline app launch: Home renders from Firestore's local cache (stale banners shown);
  daily challenge requires connectivity (server-scored), solo content otherwise none in MVP.
- Live modes (v1.0) require a connection by definition; disconnect rules are GDD §6.3.

---

## 8. Environments & Configuration

| Env | Firebase project | Purpose | Data |
|---|---|---|---|
| dev | `trivia-dev` | Daily development, emulator-first (Auth/Firestore/Functions emulators locally) | Synthetic + seeded question subset |
| staging | `trivia-staging` | Pre-release validation, beta builds (TestFlight/internal track) point here | Production-shaped, real beta users |
| prod | `trivia-prod` | Public | Real |

- Flutter flavors (`dev`/`staging`/`prod`) select the Firebase project; no runtime switching.
- All three projects are created up front (names reserved, config in repo), but the
  **staging deploy pipeline activates only at Gate C** — before there are beta users,
  staging deploys are ceremony with no audience (doc 13 §3).
- All ⚖️ balance values from the GDD live in **Remote Config**, per environment.
- Secrets: none in the client (Firebase client keys are not secrets); function secrets via
  Google Secret Manager. Content-tools use service accounts per environment.

---

## 9. Third-Party Inventory (complete list — additions require updating this doc)

| Service | Use |
|---|---|
| Firebase Auth | Anonymous guests, Google & Apple sign-in, account merge |
| Cloud Firestore | Primary datastore + realtime listeners |
| Cloud Functions + Scheduler | All server logic + jobs |
| FCM | Push notifications |
| Remote Config | Balance values, feature flags, kill switches |
| Firebase Analytics (GA4) | Event telemetry (doc 10) |
| Crashlytics | Crash reporting |
| Firebase App Distribution / TestFlight / Play internal track | Beta delivery |
| Firebase Dynamic Links **alternative** | ⚠️ Dynamic Links is deprecated — invite deep links use a self-hosted redirect (Cloud Run/Hosting + custom domain) with deferred-deep-link via install referrer (Android) / clipboard-pasteboard pattern (iOS). Spec in doc 07 |
| Anthropic API (content-tools only, not in app) | Question generation pipeline (doc 03) |

---

## 10. Scale & Cost Model

Design point: ⚖️ 10k MAU / 1.5k DAU (success for a friends-circle launch).

- Firestore: dominated by match reads + listener snapshots. Mitigations baked in:
  recap projections (one doc per round, not per answer), home screen backed by ⚖️ ≤ 5
  listeners, leaderboard as a single weekly doc per friend-group view.
- Functions: ~15–25 invocations per duel (rounds × answers + lifecycle) — well inside free
  tier at design point.
- FCM, Auth, Remote Config, Analytics: free at any realistic scale.
- **Fixed costs (complete list):** Apple Developer $99/yr, Google Play $25 once,
  invite-link domain ~$12/yr, Claude API for question generation ~$5–20 one-off per
  content sprint (content-tools only). Region `me-west1` runs ~10–15% above `us-central1`
  unit prices — negligible at our volumes; kept for latency.
- **Cold-start policy (decision):** launch with `min-instances=0` everywhere ($0). If the
  p95 `submitAnswer` SLO (≤300ms, doc 13 §6) is violated by cold starts in practice,
  enable `min-instances=1` on that single function (~$5–10/month) — an ops lever, not a
  default expense.
- **Estimated cost at design point: ~$0–25/month** + fixed costs above. Realtime v1.0
  modes are the first real cost risk — measured at the §6 gate before commitment.
- Monthly cost review is a standing LiveOps task (doc 14); budget alert at ⚖️ $50/month.

---

## 11. Architectural Risks

| Risk | Mitigation |
|---|---|
| Reveal-sync jitter makes live modes feel bad | §6 prototype gate before v1.0 UI work |
| Firestore listener costs surprise at scale | Projection-doc pattern; cost alert; load test in doc 12 |
| Functions cold starts inflate answer latency | Start at min-instances=0; SLO-triggered upgrade to 1 on `match.submitAnswer` only (§10); latency monitored per doc 13 |
| Solo bus-factor on ops | Everything-as-code (IaC via firebase.json + scripts); runbook in doc 14 |
| Dynamic Links deprecation breaks invites | Self-hosted redirect from day one (§9) — no dependency to migrate off |
