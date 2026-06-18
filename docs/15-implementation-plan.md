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

> **2026-06-12 — Phase 0 split (user decision):** code-side scaffold done first; SDK
> installs deferred to a dedicated tooling session. Decisions: develop against a
> **physical Android device** (no AVD — dev machine has 8GB RAM / 16.5GB free disk;
> Hyper-V available if ever needed); heavy SDKs to be installed on **drive E:**.
>
> **2026-06-14 — Phase 0 ✅ complete.**
> All tooling installed on E: (Flutter 3.44.2, Android SDK w/ API 29/35/36 + build-tools
> 28.0.3/34.0.0, Java 17 Temurin, Firebase CLI 15.20.0). `flutter doctor` clean.
> `flutter create` scaffolded with dev/staging/prod productFlavors (Kotlin DSL).
> Hello screen (`app/lib/app.dart`) shows "טריוויה / [dev] / Phase 0 ✓".
> `flutter build apk --flavor dev -t lib/main_dev.dart` → `app-dev-release.apk` 40.6 MB ✓.
> Pending (requires user action): `firebase login` + create `trivia-dev` project +
> `firebase emulators:start` first boot. Those are optional for Phase 0 exit; Phase 1
> walking skeleton will need the emulator running.

## Phase 1 — Walking Skeleton 🦴
*Refs: doc 02 §3.3, doc 06 §4, doc 07 §2.2*

The thinnest playable thing: anonymous auth → one Flutter screen with a question + 4
buttons → real `v1_submitAnswer` callable → server checks against `servingsPrivate`,
computes the real scoring formula (base × speed bonus) → client shows ✓/✗ + points.
One hardcoded seeded question. Ugly is fine. Includes: idempotency key plumbing,
`api_contract` round-trip (zod → Dart), error-code surface.

**Exit checkpoint:** tap an answer, the score comes back **from the server** with the
speed bonus visibly varying by answer time.

> **2026-06-14 — Phase 1 ✅ complete.**
> Server: `v1_serveQuestion` (hardcoded Hebrew seed question, stores correctIx in
> `servingsPrivate/{matchId}_0_0`), `v1_submitAnswer` (validates via `SubmitAnswerRequestSchema`,
> server-authoritative timing, idempotency key, scoring via existing engine).
> Client: `QuestionScreen` — anonymous sign-in, calls serveQuestion → visual countdown
> (display-only; server clock authoritative) → submitAnswer → shows ✓/✗ + points.
> Anti-leak: correct answer never in serving payload (`ServingSchema.strict()` + function-only
> `servingsPrivate` collection). 24 unit tests still green.
> **To test:** run `scripts/dev.ps1` (starts emulators + adb reverse), then
> `flutter run --flavor dev -t lib/main_dev.dart`.

## Phase 2 — Full Round Engine
*Refs: doc 02 §3, doc 03 §6, doc 08 servings split*

Serving engine (random pick by language+category+difficulty, `servings`/`servingsPrivate`
split, answer-order shuffle) · per-difficulty timers (10/15/20s + network grace) · a round
= 1E+1M+1H · timeout = 0 pts · round score + result screen (plain UI) · seed bank: ~50
dev-only questions per language (quick AI batch, unreviewed, marked `source: dev-seed`).
Tests: scoring unit suite (the GDD formula table) + emulator serve/submit/timeout paths.

**Exit checkpoint:** play a complete 3-question round with real timers; round score correct.

> **2026-06-14 — Phase 2 ✅ complete.**
> Backend: `v1_serveQuestion` (Phase 1) replaced by `v1_startRound` — picks 1E+1M+1H from
> the question bank, shuffles answer order per serving, writes `servingsPrivate` docs.
> `v1_submitAnswer` updated: `roundDone` is now only true at qIx=2.
> `questionBank.ts`: `pickQuestion` (Firestore query + random pick) + `shuffleAnswers`
> (Fisher-Yates + correctIx remap).
> Seed data: 48 HE + 48 EN dev-seed questions across 8 categories × 3 difficulties;
> `scripts/seed-questions.ts` loads them to the emulator (idempotent).
> Client: `RoundScreen` orchestrates 3 questions, auto-advance 1.5s after each answer;
> `RoundResultScreen` shows total score + per-question breakdown. `QuestionScreen`
> refactored to accept a `Serving` map from the parent.
> Tests: 24 passing (19 scoring formula table + 5 shuffleAnswers unit tests).
> `flutter analyze`: no issues.

## Phase 3 — Duels: Turns & Resolution
*Refs: doc 02 §4.1–4.2, doc 08 match/round docs*

Match + round documents · `v1_createDuel`/accept · turn flow (both play same questions,
locked at first serve) · recap projection written only when both finish (reveal rule) ·
best-of-5 resolution · rematch · `matchList` home projection. Tests: not-your-turn,
double-submit, both-finish-same-second transaction, reveal-leak attempt via rules test.

**Exit checkpoint:** two emulator accounts complete a full duel including round-by-round
comparison reveal.

> **2026-06-17 — Phase 3 ✅ complete.** Backend-only (duel UI deferred to Phase 6 per user
> decision); the exit checkpoint is proven by a functions emulator integration suite driving
> two anonymous users through a full duel.
> Backend: `v1_createDuel` (match + both players' `matchList`), `v1_startRound` rewritten to
> be match-aware (turn-enforced, locks `questionIds` on first serve, idempotent per-player
> servings keyed `${matchId}_${roundIx}_${qIx}_${uid}`), `v1_submitAnswer` rewritten to
> record answers into `rounds/{roundIx}.perPlayer` and **transactionally** resolve the round
> (winner by score → total-time tiebreak), write the `recaps/{roundIx}` reveal, advance/flip
> turn, and resolve the match at 3 round wins. `v1_acceptRematch` (roles swapped). Pure
> `resolveRound` helper (round/match winner). Match-structure ⚖️ values moved to
> `config/balance.ts` (`roundsToWin`/`maxRounds`/`roundComposition`).
> Reveal rule: live `rounds/*` is function-only; `recaps/*` is the participant-readable
> projection written only when both finish — **doc 08 §2 updated** (the original single-doc
> `revealReady`+`recap` plan was unenforceable in Firestore rules). `firestore.rules` now
> grants participant reads on `matches/*` + `recaps/*` and owner reads on `matchList/*`;
> everything else stays default-deny.
> **Region bug fixed:** ESM `export … from` re-exports in `index.ts` are hoisted before
> `setGlobalOptions({region})`, so callables were silently registered at `us-central1`.
> Region is now set per function via `onCall({ region })` (`config/region.ts`).
> Tests: 29 functions unit (incl. 5 `resolveRound`) + 16 api_contract + **13 emulator**
> (7 duel integration: full 3-0 duel, not-your-turn, idempotent/already-answered,
> reveal-leak, concurrent-final-answer resolves once, rematch; 6 rules matrix).
> `npm run test:emulator` runs the emulator suite. `flutter analyze` clean (app untouched;
> the Phase-2 solo `RoundScreen` is now dormant — real duel UI lands in Phase 6).
> **Tooling:** installed JDK 21 at `E:\dev\java\21` (firebase-tools 15.20 needs JDK 21+);
> moved the Firestore emulator to **port 8088** (8080 is held by `PEMHTTPD-x64`, EnterpriseDB
> PEM's Apache) — updated `firebase.json`, `dev.ps1`, `seed-questions.ts`.

## Phase 4 — Full Duel Rules → **GATE A** 🎯
*Refs: doc 02 §4.3–4.8, §7–8 (engine side), doc 07 §2.2, doc 08 §2, doc 11 Gate A*

> **2026-06-17 — Phase 4 planning (user decisions):**
> 1. **Split into 4a + 4b** — the original single phase bundled 7 large feature areas
>    (one unreviewable commit). 4a = core in-match rules (still playable end-to-end);
>    4b = background jobs + economy + stranger queue, ending at Gate A.
> 2. **Same-language source of truth = a minimal `users/{uid}` doc now** (just
>    `language` + `isGuest` + `createdAt`), written client-side at sign-in (profile/
>    preference field, guardrail #1 whitelist). Phase 8 builds the full profile on top;
>    this replaces the hardcoded `match.language: "he"`.
> 3. **Economy write-side built in its real Phase-7 shape now** — `weekly/{weekId}/
>    scores/{uid}` raw buckets (ISO week, Asia/Jerusalem) + `users/{uid}.xp`/`level`,
>    written transactionally with resolution. Phase 7 adds only the Monday reset job,
>    the friend-ranked `boards/{uid}` projection, and all UI. No UI in Phase 4.
> 4. **Category `pick` handshake = single `startRound` callable, two calls.** First call
>    on the pick-turn (no `categoryId`) returns a **locked** 3-category offer persisted on
>    the round doc (no reroll); second call with `categoryId` validates membership and
>    proceeds. No separate `v1_offerCategories`.

### Phase 4a — Core Duel Rules (playable)
*Refs: doc 02 §4.3, §4.5, §4.6, §4.7*

- **Same-language rule (§4.7):** introduce `users/{uid}` (minimal); `firestore.rules`
  grants owner create/update of the whitelisted preference fields only (deny `xp`/`level`/
  `username`/`stats`). `v1_createDuel` reads both profiles → languages differ ⇒
  `failed-precondition`/`language-mismatch`; locks `match.language` from the challenger's
  profile (kills the hardcoded `"he"`).
- **Category modes pick/spin/auto (§4.3):** extract a `selectCategory` module; make
  `v1_startRound` mode-aware. **auto** = pick from the 8 minus `match.usedCategories`,
  reset pool when all used. **spin** = random of the 8, response carries `spinResult` for
  the wheel theater (outcome server-decided). **pick** = the locked two-call offer above;
  starter = `players[roundIx % 2]` already gives §4.3 alternation. Append the chosen
  category to `usedCategories` on lock (all modes).
- **Round-tie → replay (§4.5):** when `resolveRoundWinner` returns `"shared"` (exact
  points-and-time tie), don't advance — flag the round `needsReplay`, flip the turn back to
  the starter, and let the next `v1_startRound` re-deal **fresh** questions at the same
  `roundIx` with `isTiebreaker: true` (question picks stay outside the resolution
  transaction). No round win consumed.
- **Concurrency caps (§4.6 ⚖️):** `v1_createDuel` rejects a 21st active duel
  (`resource-exhausted`/`max-active-duels`) and a 4th active duel vs. the same opponent
  (`max-duels-with-friend`). Caps → `config/balance.ts`.
- **Contract/data-model:** `StartRoundResponse` gains the pick-offer variant
  (`{ needsPick, offered[3] }`) + `spinResult`; `MatchDoc.language` becomes real;
  `MatchDoc` keeps `usedCategories`. Update doc 07 §2.2 startRound row to the two-call pick.

  **Exit checkpoint (4a):** two emulator accounts play full duels in **all three** category
  modes; a forced score-tie resolves on total time, and a forced exact tie replays the round
  with fresh questions; a mixed-language `createDuel` is rejected; the 21st duel / 4th-vs-one
  -friend are rejected.

  > **2026-06-18 — Phase 4a ✅ complete.**
  > Contract (`packages/api_contract`): `CategorySchema` (the 8 launch categories, shared
  > with Dart) + `CATEGORIES`; `StartRoundResponse` is now a union of a served variant
  > (adds optional `spinResult`) and a `needsPick` offer variant; `categoryId` is enum-
  > constrained; `SubmitAnswerResponse` gains `replay?`.
  > Same-language rule: new minimal `users/{uid}` (`functions/src/user/profile.ts`,
  > `{language,isGuest,createdAt}`), written client-side at sign-in; `firestore.rules` grants
  > owner read + a preference-field write whitelist (create bounds keys, update diffs keys so
  > later function-written fields stay locked). `v1_createDuel` reads both profiles → locks
  > `match.language`, rejects mixed-language (`language-mismatch`) and a profileless opponent
  > (`not-found/user`); the hardcoded `"he"` is gone.
  > Category modes: `functions/src/serve/selectCategory.ts` (pure auto-no-repeat / spin /
  > pick-offer). `v1_startRound` is mode-aware — spin returns `spinResult`; auto picks from
  > `usedCategories`-excluded pool; pick is the two-call locked-offer handshake; a chosen
  > category off-offer is `invalid-argument/categoryId`. Categories are appended to
  > `usedCategories` on lock (one match write).
  > Tie replay (GDD §4.5): an exact points-and-time tie flags the round `needsReplay` +
  > flips the turn to the starter (no recap, no win, no round advance); the next
  > `v1_startRound` re-deals fresh questions at the same `roundIx`, bumping `RoundDoc.attempt`
  > (folded into the serving key as `_r{n}`) and setting `isTiebreaker`. The replay branch is
  > checked BEFORE the idempotent-serve guard (which would otherwise return the stale deal).
  > Concurrency caps (GDD §4.6 → `config/balance.ts`): one single-field `matchList` query
  > enforces ≤20 active (`max-active-duels`) and ≤3 per opponent (`max-duels-with-friend`).
  > Tests: 36 functions unit (incl. 7 `selectCategory`) + 24 api_contract + **23 emulator**
  > (17 duel integration — added spin/pick/auto, language mismatch ×2, both caps, score-tie→
  > time, injected exact-tie→replay; 6 rules). `flutter analyze` clean (app untouched);
  > ESLint clean.
  > **Deferred to 4b:** turn deadlines + forfeit sweep, weekly/XP grants, stranger queue,
  > bank ≥100/lang, the remaining GDD §11 rows.

### Phase 4b — Jobs, Economy & Stranger Queue → **GATE A** 🎯
*Refs: doc 02 §4.4, §4.8, §7, §8; doc 08 (weekly/xp/strangerQueue); doc 11 Gate A*

- **Turn deadlines + forfeit sweep (§4.4 ⚖️):** add `MatchDoc.turnDeadline` (= now + 36h),
  re-stamped on every turn flip (create + handoff + round resolution). Pure
  `sweepForfeits(now)` module: `state==active && turnDeadline <= now` ⇒ mark `forfeited`,
  winner = the other player, award the forfeit-win weekly points (§7), result
  `reason: forfeit`, update both `matchList`s. Composite index per doc 08 §3. A
  `scheduledForfeitSweep` pubsub wrapper is **wired but not deployed until Phase 7** (Blaze);
  the emulator suite drives `sweepForfeits` directly. Test: sweep racing an in-flight submit
  (both touch the match doc → transaction must resolve exactly once).
- **Weekly-points + XP grants (§7/§8, write-side real shape):** on resolution (in the submit
  transaction **and** the sweep) increment `weekly/{weekId}/scores/{uid}` with `breakdown`
  (weekId = ISO week, Asia/Jerusalem); XP per §8 (+2/correct on each submit, +20 completed,
  +30 win) → `users/{uid}.xp` + recomputed `level` (`100 × n^1.5`). Record
  `result.weeklyPointsAwarded` for audit + double-grant safety (existing idempotency doc
  guards submit replays; the sweep checks the field). All formulas/curve → `balance.ts`.
  **The friend-ranked `boards/{uid}` projection is deferred to Phase 7** (needs friendships);
  4b writes only the raw `scores/{uid}`.
- **Stranger queue (§4.8), flag-gated default off:** `v1_joinStrangerQueue({categoryMode})`
  / `v1_leaveStrangerQueue`, gated by Remote Config `stranger_queue_enabled` (off ⇒
  `queued: false`). Writes `strangerQueue/{uid}`; on enqueue, attempt to pair with a waiting
  same-language player (closest level) into a standard match (`isStrangerMatch: true`). Test
  with the flag forced on: two compatible enqueues pair; flag off ⇒ no pairing.
- **Bank ≥ 100/lang:** extend dev-seed from 48 → ≥100 per language (quick AI batch,
  `source: dev-seed`); update `scripts/seed-questions.ts`.
- **GDD §11 edge-case tests (in-scope rows):** app-killed-mid-question (0 pts, resume next q),
  double-submit idempotent, clock-manipulation irrelevant, repeat-exclusion (light — full
  90-day/500-served window lands in Phase 10). **Deferred to Phase 8** (need friends/deletion):
  unfriend/block mid-match cancel, account-deleted forfeit — noted here so Gate A stays honest.

**Exit checkpoint (4b = Gate A):** doc 11 Gate A criteria all green — two emulator accounts
complete full duels in all 3 modes, scoring formula verified by tests, tiebreakers + replay,
forfeit sweep, weekly points awarded; bank ≥ 100/lang. *(Planning doc says "UI may be ugly" — it will be.)*

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
| 0 — Tooling & scaffold | ✅ | 2026-06-14 | abf37a8 |
| 1 — Walking skeleton | ✅ | 2026-06-14 | bfeaaf0 |
| 2 — Round engine | ✅ | 2026-06-14 | afd89a5 |
| 3 — Duels | ✅ | 2026-06-17 | 883da14 |
| 4a — Core duel rules | ✅ | 2026-06-18 | (this commit) |
| 4b — Jobs/economy → Gate A | ☐ | | |
| 5 — Design system | ☐ | | |
| 6 — App shell | ☐ | | |
| 7 — Daily/weekly/XP | ☐ | | |
| 8 — Identity & friends | ☐ | | |
| 9 — Notifications | ☐ | | |
| 10 — Content (parallel) | ☐ | | |
| 11 — Gate B | ☐ | | |
| 12 — Gate C | ☐ | | |
