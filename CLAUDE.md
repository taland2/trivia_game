# Trivia Game — Project Guide for Claude

## What this project is
A free, playful, Hebrew-first multiplayer trivia mobile game (codename **"Trivia"**) for
real friend groups: async 1v1 duels, daily challenge, weekly friends leaderboard — later
real-time modes, tournaments, and UGC packs. Solo product owner + AI-assisted development.

## Project status
**Planning complete, no code yet.** The full spec suite lives in `docs/00`–`docs/14` and is
the **source of truth** — read the relevant doc before designing or implementing anything.
**Execution follows `docs/15-implementation-plan.md`** — walking-skeleton phases, one phase
per session, each ending playable + committed. Check its Progress Tracker for the current
phase, and follow its Session Protocol at the start and end of every implementation session.

## Working conventions (user preferences — follow these)
- **Chat with the user in Hebrew. All project artifacts (docs, code, comments, commits) in English.**
- Decisions are made by the user via `AskUserQuestion` rounds — present options with a
  recommended choice. Don't decide product questions unilaterally; don't re-litigate
  decisions already recorded in the docs without new evidence.
- The user prefers deep planning before building, and accepts scope phasing when tradeoffs
  are explained.
- Update the relevant doc in `docs/` whenever a decision changes — docs and reality must not drift.

## The document suite (read before touching the related area)
| Doc | Area |
|---|---|
| `docs/01-product-vision.md` | Audience, differentiators, KPIs (north star: **D7 ≥ 20%**), staged roadmap, non-goals |
| `docs/02-game-design-document.md` | **All game rules.** If a rule isn't there, it doesn't exist. ⚖️ marks remote-config balance values |
| `docs/03-content-strategy.md` | Question sourcing (AI+review, OpenTDB, manual), 800 Q/lang at launch, difficulty recalibration |
| `docs/04-ux-ui-spec.md` | Screens, design system, question-screen spec, RTL rules, a11y |
| `docs/05-onboarding-retention.md` | FTUE (guest-first), notification types N1–N10 + caps |
| `docs/06-system-architecture.md` | Stack, sensitivity boundary, envs, cost model |
| `docs/07-api-spec.md` | Callable function contracts, error codes, idempotency |
| `docs/08-data-model.md` | Firestore collections, projections, retention, migrations |
| `docs/09-security-privacy.md` | Anti-cheat table, rules policy, privacy flows |
| `docs/10-analytics-spec.md` | Event taxonomy, funnels F1–F4, content feedback loop |
| `docs/11-mvp-roadmap.md` | MoSCoW scope, Gates A–E exit criteria, **build order** |
| `docs/12-test-plan.md` | Test pyramid, golden paths, edge-case matrix |
| `docs/13-devops-release.md` | Repo layout, CI/CD, monitoring, store ops |
| `docs/14-liveops-plan.md` | Operating rhythm, runbook, support |
| `docs/15-implementation-plan.md` | **Active execution plan**: phases 0–12, session protocol, progress tracker |

## Key decisions (locked — full list in docs)
- **Stack:** Flutter (Dart) + Firebase (Auth, Firestore, Functions in TypeScript, FCM,
  Remote Config, GA4 + BigQuery, Crashlytics). Region `me-west1`. Min OS: Android 10 / iOS 16.
- **Monorepo** (`app/`, `functions/`, `packages/`, `content-tools/`, `firebase/`, `docs/`),
  3 Firebase envs (dev/staging/prod; staging pipeline activates at Gate C). Trunk-based, conventional commits.
- **MVP scope:** async 1v1 duel (best-of-5 rounds, 3Q/round, category modes pick/spin/auto),
  daily challenge (per-user local midnight) + streaks, weekly friends leaderboard (Monday,
  Asia/Jerusalem), XP/levels, friends via invite-link/@username/QR, emotes (no chat),
  notifications, HE+EN with full RTL. Stranger queue built but flag-gated until soft launch.
- **Out of MVP:** realtime modes (v1.0), tournaments (v1.1), UGC (v1.2), power-ups,
  achievements, global boards, monetization (none in v1, pay-to-win never).
- **Game rules anchors:** timers 10/15/20s by difficulty; score = base × (1 + 0.5 × time_remaining/limit);
  36h turn auto-forfeit (12h reminder, 30h warning); no draws; same-language duels only;
  max 20 active duels, 3 per friend pair.

## Hard engineering guardrails (non-negotiable, from docs 06/09)
1. **Integrity writes go through Cloud Functions only** — clients never write matches,
   scores, XP, leaderboards, friendships. Client-direct writes are whitelisted profile/
   preference fields + emotes only. Every new client write must state its boundary side.
2. **The correct answer never reaches the client before the player answers.** Hidden data
   lives in separate function-only docs (`servingsPrivate`), never in "hidden fields".
3. **Server-authoritative timing** — client clocks and client-reported times are display-only.
4. All ⚖️ balance values via Remote Config, never hardcoded.
5. Idempotency keys on every mutating callable; transactions for match resolution.
6. No secrets in the client or repo; no new third-party services without updating doc 06 §9.
7. Every GDD §11 edge-case row needs an automated test (doc 12 §3).
8. Analytics events only via the typed contract package; no PII in event params.

## Memory
Persistent memory (auto-loaded index) holds the planning-decision summary and user profile.
Keep it updated when major decisions or milestones change: update
`trivia-game-planning-decisions.md` there rather than duplicating state into this file.
