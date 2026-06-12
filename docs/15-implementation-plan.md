# 15 — Implementation Plan (Phases to Gate C)

> Status: **Active** · Depends on: [11-mvp-roadmap.md](11-mvp-roadmap.md) (gates + MoSCoW), [06-system-architecture.md](06-system-architecture.md)
> Method decisions (made 2026-06-12): **walking skeleton** sequencing · **design in code**
> (no Figma) · **one phase = one session milestone**, each ending playable/demoable +
> committed. Dev machine: Windows, starting from zero tooling.
>
> This is the living execution doc: each phase gets a ✅ + date + commit hash when done.
> If scope shifts mid-phase, update this file in the same commit.

---

## Session Protocol (every implementation session)

**Start:** read `CLAUDE.md` → memory status → this doc's current phase section → the
spec docs that phase references. **End:** all tests green → commit (conventional message)
→ tick the phase checklist here → update memory `project-status` if the milestone moved.

Definition of Done for every phase: exit checkpoint demonstrably works · tests for new
logic pass · no ⚖️ value hardcoded (config/constants module from day one) · docs updated
if any decision changed.

---

## Phase 0 — Tooling & Monorepo Scaffold
*Refs: doc 06 §1/§8, doc 13 §1–2*

Install & verify (Windows): Flutter SDK + Android Studio + one emulator AVD (+ enable
virtualization if needed) · Node.js LTS + Java 17 (Firebase emulators) · Firebase CLI ·
`flutter doctor` clean (Android toolchain; iOS expected red on Windows — see §Risks).

Scaffold: `app/` (Flutter project, flavors dev/staging/prod) · `functions/` (TypeScript,
ESLint, Vitest) · `packages/api_contract` (zod schemas + Dart codegen stub) ·
`content-tools/` (empty CLI skeleton) · `firebase/` (default-deny `firestore.rules`,
`firebase.json` with full emulator suite) · `.github/workflows/ci.yml` (analyze + test
both stacks) · root README with one-command dev startup script.

Firebase: create `trivia-dev` project only (staging/prod names reserved, created at Gate C).
Everything through Phase 6 runs on **emulators** — no Blaze plan needed yet.

**Exit checkpoint:** `flutter run` (dev flavor) shows a hello screen on the emulator;
`firebase emulators:start` serves Auth+Firestore+Functions; CI green.

## Phase 1 — Walking Skeleton 🦴
*Refs: doc 02 §3.3, doc 06 §4, doc 07 §2.2*

The thinnest playable thing: anonymous auth → one Flutter screen with a question + 4
buttons → real `v1_submitAnswer` callable → server checks against `servingsPrivate`,
computes the real scoring formula (base × speed bonus) → client shows ✓/✗ + points.
One hardcoded seeded question. Ugly is fine. Includes: idempotency key plumbing,
`api_contract` round-trip (zod → Dart), error-code surface.

**Exit checkpoint:** tap an answer, the score comes back **from the server** with the
speed bonus visibly varying by answer time.

## Phase 2 — Full Round Engine
*Refs: doc 02 §3, doc 03 §6, doc 08 servings split*

Serving engine (random pick by language+category+difficulty, `servings`/`servingsPrivate`
split, answer-order shuffle) · per-difficulty timers (10/15/20s + network grace) · a round
= 1E+1M+1H · timeout = 0 pts · round score + result screen (plain UI) · seed bank: ~50
dev-only questions per language (quick AI batch, unreviewed, marked `source: dev-seed`).
Tests: scoring unit suite (the GDD formula table) + emulator serve/submit/timeout paths.

**Exit checkpoint:** play a complete 3-question round with real timers; round score correct.

## Phase 3 — Duels: Turns & Resolution
*Refs: doc 02 §4.1–4.2, doc 08 match/round docs*

Match + round documents · `v1_createDuel`/accept · turn flow (both play same questions,
locked at first serve) · recap projection written only when both finish (reveal rule) ·
best-of-5 resolution · rematch · `matchList` home projection. Tests: not-your-turn,
double-submit, both-finish-same-second transaction, reveal-leak attempt via rules test.

**Exit checkpoint:** two emulator accounts complete a full duel including round-by-round
comparison reveal.

## Phase 4 — Full Duel Rules → **GATE A** 🎯
*Refs: doc 02 §4.3–4.8, §7–8 (engine side), doc 11 Gate A*

Category modes pick/spin/auto (server-decided spin) · same-language rule · round-tie →
total-time → replay · turn deadlines + forfeit sweep job (36h) · weekly-points + XP
grants on resolution (engine only, no UI) · concurrency caps · stranger-queue functions
(flag-gated, default off). Tests: every applicable GDD §11 row + tie matrix + forfeit
sweep racing in-flight submit.

**Exit checkpoint:** doc 11 Gate A criteria all green. *(Planning doc says "UI may be ugly" — it will be.)*

## Phase 5 — Design System & Question-Screen Juice
*Refs: doc 04 §1, §4–8*

Design-in-code: semantic token pairs (light values final, dark drafted) · font bake-off
in-app (Heebo/Rubik/Assistant side-by-side, pick one) · question screen per doc 04 §4:
ring timer with color shift, lock/reveal animations, points fly-up, haptics, SFX set ·
category colors · RTL correctness on the question screen · reduced-motion support.
Iterate by screenshots/builds together — this phase is interactive by design.

**Exit checkpoint:** the question screen feels properly juicy on a real Android device,
in Hebrew and English.

## Phase 6 — App Shell & Home
*Refs: doc 04 §2–3*

4-tab navigation · Home (pending turns list, daily card placeholder, weekly card
placeholder) · new-duel flow (friend picker UI against seeded friends, category-mode
picker, wheel animation) · match lobby/recap screens with emotes · profile + settings
skeleton (language switch, sound/haptics toggles) · empty/loading/error state pattern
established once, reused everywhere.

**Exit checkpoint:** the full duel loop is playable through real navigation, no debug screens.

## Phase 7 — Daily, Streaks, Weekly Race, XP (full stack)
*Refs: doc 02 §5, §7–8, doc 08 weekly/daily collections*

Daily sets + per-user local-midnight unlock (±14h window) · one-attempt + streak logic ·
friends-today board (post-play visibility rule) · weekly leaderboard projections +
Monday reset job + podium screen · XP bar / level ring UI. **First real deploy to
`trivia-dev` (Blaze upgrade)** — scheduled jobs need a real project; verify cost ≈ $0.

**Exit checkpoint:** a day-rollover and a week-rollover both simulated end-to-end; daily
streak and weekly podium visible in UI.

## Phase 8 — Identity & Friends
*Refs: doc 05 §1, doc 02 §10.1, doc 07 §2.1/§4*

Google + Apple sign-in, guest merge (XP/matches/friendships survive) · registration
prompts at the doc 05 trigger moments · invite-link service (Hosting redirect + deferred
deep link, Android install-referrer path first) · @username claim/search · QR add ·
block/unfriend cascade. Device-tested install path — this is the flakiest feature
(doc 11 risk), budget real time.

**Exit checkpoint:** a fresh phone installs via an invite link and lands auto-friended
in a ready duel vs. the inviter.

## Phase 9 — Notifications
*Refs: doc 05 §3, doc 07 §3*

FCM wiring + token lifecycle · `notify` module: N1–N6, N8–N9 (N7 if cheap) · caps, quiet
hours, per-type settings · deep-link routing from notification tap · turn-reminder/
forfeit-warning scheduled sweeps. Real-device matrix (Android + iOS).

**Exit checkpoint:** full async loop works phone-to-phone: play turn → friend's phone
buzzes → tap → lands in match → plays → your phone buzzes.

## Phase 10 — Content Pipeline & Bank Build-up
*Refs: doc 03 (all) — **parallel track**, start alongside Phases 5–9*

`content-tools`: generation prompts per category×difficulty×language · review CLI
(approve/edit/reject, throughput-optimized) · OpenTDB importer with re-review queue ·
publisher (draft→live) · bank linter (dupes, lengths, concept_id pairs) · daily-set
curation queue ≥14 days. Then the grind: **reach 800 approved/language** (~16–27h human
review — schedule it across weeks, not one heroic weekend).

**Exit checkpoint:** 800×2 approved questions live in dev; daily queue filled; dev-seed
questions purged.

## Phase 11 — Onboarding & Polish → **GATE B** 🎯
*Refs: doc 05 §1–2, doc 04 §3 states, doc 11 Gate B*

FTUE (taste round → invite sheet → home) · all empty/error/offline states real · sound
pass · celebration animations · RTL audit across every screen · analytics events F1–F4
wired via `analytics_contract` · Crashlytics · operator dogfood: 20 real matches on
personal devices for a week.

**Exit checkpoint:** doc 11 Gate B criteria green; you'd show it to friends without apologizing.

## Phase 12 — Beta Readiness → **GATE C** 🎯
*Refs: doc 11 Gate C, doc 13 §3–4, doc 09 §6*

Create `trivia-staging`/`trivia-prod` + activate staging pipeline · **name decision** +
domain + app ids · store listings HE/EN + privacy policy + data-safety forms · App Check ·
security-review pass (rules matrix, deletion flow E2E) · dashboards (ops + product) ·
TestFlight + Play internal tracks · **iOS build path** (see Risks) · beta cohort invited.

**Exit checkpoint:** doc 11 Gate C criteria green → closed beta begins (Gate D is an
operating period, not a build phase).

---

## Dependency Notes
- Phases 0→4 are strictly sequential (each thickens the skeleton).
- Phase 10 (content) runs parallel from Phase 5 onward; its only hard deadline is Gate C.
- Phase 5 can swap with 6 if design energy is low; 7–9 are interchangeable in order but
  all precede 11.

## Known Risks Specific to Execution
| Risk | Plan |
|---|---|
| **iOS builds need macOS** — dev machine is Windows | Develop Android-first locally; add iOS via CI macOS runner (GitHub Actions + fastlane) or Codemagic free tier at Phase 12; budget an extra session for iOS-only issues (sign-in with Apple, APNs, universal links) |
| Blaze plan required from Phase 7 | Budget alert at $10 configured the same day; emulators remain the default dev loop forever |
| Content review fatigue (Phase 10) | Review CLI UX is a first-class deliverable; track approved-count in this doc per session |
| Walking skeleton accumulates "temporary" shortcuts | Each phase's DoD includes deleting the shortcuts it replaced; `dev-seed` content purge is an explicit Phase 10 item |

## Progress Tracker
| Phase | Status | Date | Commit |
|---|---|---|---|
| 0 — Tooling & scaffold | ☐ | | |
| 1 — Walking skeleton | ☐ | | |
| 2 — Round engine | ☐ | | |
| 3 — Duels | ☐ | | |
| 4 — Gate A | ☐ | | |
| 5 — Design system | ☐ | | |
| 6 — App shell | ☐ | | |
| 7 — Daily/weekly/XP | ☐ | | |
| 8 — Identity & friends | ☐ | | |
| 9 — Notifications | ☐ | | |
| 10 — Content (parallel) | ☐ | | |
| 11 — Gate B | ☐ | | |
| 12 — Gate C | ☐ | | |
