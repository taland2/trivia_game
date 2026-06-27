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
>
> **2026-06-22 — dev-loop hardening.** Added `scripts/run.ps1` — one command that does
> the whole on-device loop: pick a Java 21+ runtime → build functions → start emulators
> (`--only auth,functions,firestore`) → wait for ready → seed → `adb reverse` → `flutter
> run --flavor dev` → tear emulators down on quit. Notes baked in: (1) Firebase CLI now
> requires **Java 21+**; the script auto-detects Android Studio's bundled JBR (machine
> only had JDK 17 at `E:\dev\java\17`). (2) **Pub/Sub emulator is skipped** — it crashed
> on this machine and is only needed for the scheduled forfeit sweep, not manual play.
> (3) Seeders import `firebase-admin` from `functions/node_modules` (no root install), so
> `NODE_PATH` is set; `seed.ps1` updated to match. Common gotcha: plain `flutter run`
> builds the leftover demo `lib/main.dart` and fails the flavored Gradle build — always
> pass `--flavor dev -t lib/main_dev.dart`.
>
> **2026-06-22 — startup resilience hardening.** The app no longer hard-gates the UI on
> the backend (it was showing a dead-end `cloud_off` splash with no retry when Firebase
> was unreachable). Changes: (1) `sessionProvider` now returns **uid-or-null** with
> per-step timeouts + bounded retry and a best-effort (non-blocking) profile write — it
> never throws or hangs, so the app always opens, even offline; a null uid degrades
> gracefully downstream. (2) `app.dart` shows only a brief bounded splash, offers a retry
> on the (now defensive) error branch, and re-invalidates the session on app resume so
> regained connectivity revives the backend screens without a restart. (3) New
> `lib/bootstrap.dart` installs global error handling (`FlutterError.onError`,
> `PlatformDispatcher.onError`, a calm `ErrorWidget.builder`) and a **guarded
> `Firebase.initializeApp`** inside `runZonedGuarded`; all three `main_*.dart` route
> through it. (4) `main_prod`/`main_staging` previously never initialized Firebase and had
> no options — they now fail *honestly* (caught → degraded open) with a Gate-C TODO to run
> `flutterfire configure` + add `firebase_options_{prod,staging}.dart`. (5) Deleted the
> demo `lib/main.dart`. Crashlytics forwarding (TODO in bootstrap) and real connectivity
> detection (`connectivity_plus` feeding `AsyncValueView.isOffline`) remain **Phase 11**.
> `flutter analyze` clean, 16 tests green.

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

> **2026-06-18 — Phase 4b ✅ complete → GATE A reached.** Backend-only (duel UI still
> Phase 6); proven by the functions emulator integration suite.
> **Product decisions (this session):** weekly "match score" = **winning rounds only**
> (new `MatchDoc.scoreTotals`, banked per resolved round to the winner only); a **forfeit
> win earns full XP** (+20 completed +30 win) on top of the flat 100 weekly points; a paired
> **stranger match always runs Spinner** mode. Recorded in GDD §7/§8/§4.8.
> **Turn deadlines + forfeit sweep (§4.4):** `MatchDoc.turnDeadline` (now + `balance.turnDeadlineMs`
> = 36h), stamped in `buildDuelMatch` and re-stamped at every `turnUid` flip in `submitAnswer`
> (handoff, next-round advance, tie-replay), cleared to null on finish (`match/turn.ts`
> `deadlineFrom`). Pure `decideForfeit` + transactional `sweepForfeits`/`forfeitMatchTx`
> (`match/sweepForfeits.ts`): the in-txn match re-read guarantees exactly-once against a
> racing submit. `scheduledForfeitSweep` (`jobs/`, `onSchedule`) is **wired but NOT deployed
> until Phase 7** (Blaze); the suite drives `sweepForfeits` directly. Composite index
> `state+turnDeadline` added to `firestore.indexes.json`.
> **Economy (§7/§8):** `economy/weekId.ts` (hand-rolled ISO-week, Asia/Jerusalem, week-numbering
> year — no date lib) + `economy/grants.ts` (pure formulas + `applyWeeklyPoints` via
> `FieldValue.increment`). Grants fold into `submitAnswer`'s existing transaction (so the
> idempotency-doc short-circuit makes them replay-safe): +2 XP/correct each submit, completion
> XP (+20 both, +30 winner) + weekly `duels` points at finish; level recomputed from total
> (`100×n^1.5`). `boards/{uid}` projection deferred to Phase 7. `MatchResultDoc.weeklyPointsAwarded`
> audit field; contract `MatchResultSchema` gains it (optional).
> **Stranger queue (§4.8), flag-gated OFF:** `config/flags.ts` `isStrangerQueueEnabled`
> (env → `config/flags` doc → false); `match/strangerQueue.ts` `v1_joinStrangerQueue`/
> `v1_leaveStrangerQueue` — same-language closest-level pairing, txn serialized on the
> candidate's queue doc (no double/self-pair), `buildDuelMatch({isStrangerMatch:true})`.
> Contract `stranger.ts`. `strangerQueue/*` stays default-deny.
> **Bank:** dev-seed scaled 96 → **240** (5 per language×category×difficulty cell, 120/lang).
> **Tests:** 56 functions unit (+15: `weekId`/`grants`/`sweepForfeits`) + 18 api_contract +
> **37 emulator** (17 duel, 5 forfeit incl. sweep-vs-submit race, 4 economy + §11 null-answer/
> repeat-exclusion, 5 stranger, 6 rules). `flutter analyze` clean (app untouched); ESLint clean.
> **Deferred to Phase 8** (need friends/deletion): unfriend/block mid-match cancel,
> account-deleted forfeit — Gate A stays honest about these.

## Phase 5 — Design System & Question-Screen Juice
*Refs: doc 04 §1, §4–8*

Design-in-code: semantic token pairs (light values final, dark drafted) · font bake-off
in-app (Heebo/Rubik/Assistant side-by-side, pick one) · question screen per doc 04 §4:
ring timer with color shift, lock/reveal animations, points fly-up, haptics, SFX set ·
category colors · RTL correctness on the question screen · reduced-motion support.
Iterate by screenshots/builds together — this phase is interactive by design.

**Exit checkpoint:** the question screen feels properly juicy on a real Android device,
in Hebrew and English.

> **2026-06-19 — Phase 5 ✅ complete.** Design system established + question screen fully rewritten.
> **Design tokens:** `app/lib/theme/tokens.dart` (`AppColors` with semantic pairs light/dark, `AppSpacing`/`AppRadius`/`AppDurations` constants) + `category_colors.dart` (8 colorblind-safe category accents) + `app_theme.dart` (ThemeData factory for light/dark, Rubik as default font; Heebo & Assistant bundled for bake-off).
> **Audio:** `AudioService` singleton (just_audio wrapper, preload 5 SFX at app init, global mute toggle).
> **Ring timer:** `CountdownRing` CustomPainter (circular arc, color interpolation green→amber→red, last 3s pulse + tick SFX, reduced-motion support).
> **Answer buttons:** `AnswerButton` (flutter_animate: lock scale 0.96, reveal shake + icons, state-driven color/opacity).
> **Points fly-up:** `_PointsFlyUp` overlay (MoveEffect -80px + FadeEffect, reduced-motion skips movement).
> **Question screen rewrite:** 2×2 GridView (not vertical list), category accent top border, haptics on lock/correct/wrong, reveal interstitial 2.5s (tappable to skip), dynamic locale via Directionality.
> **Minor updates:** `RoundScreen` now plays 'whoosh' SFX + wires 2.5s auto-advance; `RoundResultScreen` uses category color for header + plays whoosh on "play again" + haptic feedback.
> **Packages added:** flutter_animate ^4.5.0, just_audio ^0.9.40; fonts bundled (Rubik/Heebo/Assistant).
> **Assets:** placeholder SFX files (silent MP3s) in `assets/sfx/` — production audio sources pending Phase 10.
> All tests still pass (flutter analyze clean). App builds with dev flavor. **Ready to run on Android device for real-world juice verification** (Phase 6 next).

## Phase 6 — App Shell & Home
*Refs: doc 04 §2–3*

4-tab navigation · Home (pending turns list, daily card placeholder, weekly card
placeholder) · new-duel flow (friend picker UI against seeded friends, category-mode
picker, wheel animation) · match lobby/recap screens with emotes · profile + settings
skeleton (language switch, sound/haptics toggles) · empty/loading/error state pattern
established once, reused everywhere.

**Exit checkpoint:** the full duel loop is playable through real navigation, no debug screens.

> **2026-06-23 — Phase 6 split (6a ✅ shipped, 6b planned).** 6a shipped the shell
> skeleton — 4-tab nav, Home (active/pending matches), new-duel flow (friend picker,
> category-mode picker, wheel), the real on-device duel loop (commit `03880d7`). A 47-finding
> code review (`docs/16`) + remediation plan (`docs/17`) then intervened; **WS1 (server
> integrity: H1 out-of-order guard, H2/M1/M2 idempotency + transactional caps) landed**
> (commit `8b98aec`). **6b** completes the *visible* duel loop (recap + match-result +
> emotes + profile/settings) and folds in the review's client-side workstreams (WS2) plus
> the cheap WS3 docs / WS4 cleanup paydown the remediation plan sequences here.
>
> **Product decisions (this session):** (1) **Emotes — full build now**: server-validated
> `v1_sendEmote` callable with a `3/match` cap (⚖️ `balance.ts`), not a client-direct write.
> (2) **Profile — settings screen + real Level/XP**: live language switch + sound/haptics
> toggles (plumbing exists in `settings_providers.dart`) and a real level ring / XP bar read
> from `users/{uid}`; match-history list stays a Phase-7 placeholder.

### Phase 6b — Complete the Duel Loop + Client Truth
*Refs: doc 04 §2–3 (§3 screens 3/6/7/10), doc 02 §10.2 (emotes), docs 16/17 (WS2–WS4)*

**6b-1 — Server result truth → recap + match-result screens (WS2.1 / H7).** Today
`round_screen.dart` re-derives outcomes from a `points > 0` heuristic (`roundResultFrom`)
and just returns Home after a turn — there is no recap or win/loss screen. Fix the data path
first, then build the screens on top of the real projection:
- Extend `AnswerOutcome` to carry `replay`, `roundResult`, `matchResult`; add Dart
  `RoundResult` / `MatchResult` models mirroring `RoundResultSchema` / `MatchResultSchema`
  (parse in `match_controller.dart`, don't re-derive). Delete the `points > 0` heuristic.
- `RoundScreen` branches on `replay` (re-enter `startRound` at the same `roundIx` for the
  §4.5 tie-replay) instead of advancing.
- **Recap screen** (doc 04 §3.3/§3.6): reads the participant-readable `recaps/{roundIx}`
  projection (function-written when both finish — Phase 3 reveal rule) → round-by-round
  side-by-side ✓/✗ + times vs. opponent. Match lobby = round history + `scoreTotals` +
  whose-turn + emote strip.
- **Match-result screen** (doc 04 §3.7): winner celebration (confetti, reduced-motion aware),
  XP gained + weekly points gained (from `matchResult`), `[Rematch]` (calls `acceptRematch`,
  needs the idempotencyKey wiring — not yet in `match_controller`) + `[Share]`.
- *Tests:* widget test with a fake `MatchApi` returning a `matchResult` → result screen
  renders from the projection, not from `points`; replay branch re-enters `startRound`.

**6b-2 — Question-screen correctness (WS2.2/H6, WS2.3/H5, WS2.4/M6).**
- H6: add `basePoints` + `speedBonus` to the `v1_submitAnswer` response + contract; show the
  real split on the fly-up; delete the `base = points ~/ 2` fabrication. Invariant
  `basePoints + speedBonus === points` (server unit test).
- H5: replace hardcoded `'קל'/'בינוני'/'קשה'` with existing `l.difficultyEasy/Medium/Hard`;
  add a `questionProgress(n, total)` key to `app_en.arb` + `app_he.arb`; regenerate. Widget
  test in EN locale asserts no Hebrew in the header.
- M6: wrap answer buttons in `Semantics(button: true, label, selected)`; label the wheel and
  points fly-up. Widget test asserts `SemanticsFlag.isButton` on answer tiles.

**6b-3 — Profile & Settings (doc 04 §2/§3.10, §5/§6).**
- Settings screen: language switch (flips RTL live via `localeProvider`; also mirrors to the
  whitelisted `users/{uid}.language` profile field — guardrail #1), sound + haptics toggles
  (wired to the existing `settingsProvider`). All copy via l10n keys.
- Profile: real level ring + XP bar read from `users/{uid}.xp`/`level` (economy write-side
  exists since 4b). Match-history list = Phase-7 placeholder (empty-state pattern).

**6b-4 — Emotes (full build — doc 02 §10.2).**
- `balance.ts`: `emoteSet` (8 localized emotes ⚖️) + `emotesPerMatch: 3` ⚖️; export via
  `getBalance()`. New `packages/api_contract/src/emote.ts` (`SendEmoteRequest`/`Response`).
- Backend `v1_sendEmote`: validates membership + emote-in-set, enforces the per-sender
  `3/match` cap transactionally, writes to `matches/{matchId}/emotes/*` (function-only write,
  participant-read). Idempotency key like the other mutating callables.
- `firestore.rules`: participant **read** on `matches/*/emotes/*`; **deny** client writes
  (integrity write via the callable). Rules-matrix test for read-allow / write-deny.
- Client: emote strip on the match lobby/recap; send + render. Soft client-side disable at 3.
- *Tests:* send within cap succeeds, 4th rejected (`resource-exhausted`); non-participant
  rejected; off-set emote rejected.

**6b-5 — Review paydown bundled here (WS3 docs, WS4 cleanup, WS1.3 leftover).**
- WS3 (the remediation plan sequences docs *before* WS2): batched docs pass — docs/08 §2
  `matches.scoreTotals` + real `servingsPrivate` fields + idempotency store path; doc 07
  stranger-queue response shapes + `question-expired` reserved; doc 06 §3 forfeit cadence
  (15 min). *(Progress Tracker rows + the 6a completion retro are deliberately left until the
  housekeeping pass — not part of this plan block.)*
- WS4 cleanup: pin `intl` in `app/pubspec.yaml`; add `.where('quarantined','==',false)` in
  `questionBank.ts`; fix `question_screen.dart` reading `serving['category']` (never present
  → accent always defaults); bump `setup-path.ps1` JDK 17→21; clamp timed-out `elapsedMs`.
- WS1.3 leftover: the missing **submit-after-timeout e2e** test (backdate `servedAt` past
  `timeLimitMs + grace`, submit a correct `answerIx` → `points: 0`, `timedOut`).

**Note on size:** this is a large session (UI + a backend callable + review paydown). If it
runs long, split the commit at the 6b-1/6b-2 boundary (client-truth + screens) vs. 6b-3/6b-4
(profile/settings + emotes), keeping each independently reviewable.

**Exit checkpoint (6b):** the full duel loop is playable end-to-end through real navigation —
create duel → play a turn → opponent plays → **recap reveal** → **match-result celebration**
with real XP + weekly points → rematch; **emotes** send (capped 3/match) and appear on the
lobby/recap; **settings** switch language live (RTL flips, no restart) and toggle
sound/haptics; **profile** shows real level/XP; no debug screens. WS2 client gaps closed;
the EN locale is Hebrew-free on the question screen; review docs drift reconciled.

> **2026-06-23 — Phase 6b ✅ complete.**
> **Server truth → screens (WS2.1/H7):** `v1_submitAnswer` response carries the real
> `basePoints`+`speedBonus` (H6) and the existing `replay`/`roundResult`/`matchResult`;
> client `AnswerOutcome` now parses all of it and new Dart models (`RoundResult`/
> `MatchResult`/`RecapPlayer`, `app/lib/models/round_result.dart`) mirror the contract.
> `RoundScreen` routes on server truth — replay → re-deal same round; matchResult →
> `MatchResultScreen`; roundResult → `RecapScreen`; else local summary. The `points > 0`
> heuristic in `roundResultFrom` is gone (per-question ✓/✗ now comes from the server outcome).
> **New screens:** `RecapScreen` (round-by-round you-vs-opponent reveal from `recaps/*`),
> `MatchResultScreen` (win/loss celebration, final rounds score, weekly points, rematch via
> `v1_acceptRematch` + clipboard share). **Question screen (WS2.2/2.3/2.4):** real points
> split on the fly-up (no fabricated 50/50), localized difficulty + `questionLabel` (EN no
> longer shows Hebrew), `Semantics(button:…)` on answer buttons.
> **Profile/Settings (6b-3):** `SettingsScreen` (live language switch mirrored to the
> whitelisted `users/{uid}.language`, sound/haptics toggles wired to the existing
> `settingsProvider`); `ProfileScreen` level ring + XP bar from `users/{uid}`. The server
> now also writes `levelFloorXp`/`levelCeilXp` (`nextUserXp`) so the bar needs no ⚖️ curve
> client-side (guardrail #4). Match history stays a Phase-7 placeholder.
> **Emotes — full build (6b-4):** `balance.ts` `emotes.set` (8 keys ⚖️) + `perMatch:3` ⚖️;
> `v1_sendEmote` callable (set-validated, transactional per-sender cap, idempotent) writes
> function-only/participant-read `matches/{id}/emotes/*`; `firestore.rules` read-allow /
> write-deny; client `EmoteStrip` (catalog → emoji+l10n, live stream, server-driven disable).
> **Review paydown:** WS4 — `intl` pinned, in-memory `quarantined` filter (+ seed field),
> `serving['category']` accent bug fixed (category passed explicitly), `elapsedMs` clamp,
> `setup-path.ps1` JDK 17→21. WS3 — docs/06 forfeit cadence (15 min), docs/07 submit/stranger/
> emote shapes + `question-expired` reserved, docs/08 `scoreTotals`/`emotes`/xp-bounds/
> `servingsPrivate`/`idempotency`. WS1.3 — the missing submit-after-timeout e2e test added.
> **Tests:** 56 functions unit + 20 api_contract + **53 emulator** (+H6 split, submit-after-
> timeout, 5 emote integration, 2 emote rules) + 16 Flutter widget; `flutter analyze`, ESLint,
> `tsc` all clean.
> **Deferred (tracked):** WS5 items (App Check, rate-limit-from-RC, idempotency TTL, selection
> indexes/`rand`, Flutter golden-path E2E, opponent-side create cap) remain Phase 10/12 gates.

## Phase 7 — Daily, Streaks, Weekly Race, XP (full stack)
*Refs: doc 02 §5, §7–8, doc 08 weekly/daily collections, doc 07 §2.3*

> **2026-06-24 — Phase 7 planning (user decisions):**
> 1. **Split into 7a + 7b** (matches 4a/4b, 6a/6b). 7a = Daily Challenge full stack +
>    streaks, ending playable on device. 7b = weekly friend-ranked board projection +
>    Monday reset job + podium UI + the daily friends-today board.
> 2. **Blaze deploy deferred — simulate now.** The scheduled jobs (Monday reset, and the
>    already-wired forfeit sweep) are emulator-driven for the exit checkpoint, exactly as
>    4b drove `sweepForfeits` directly. The actual `trivia-dev` Blaze upgrade + $10 budget
>    alert + real deploy move to a **dedicated step** (do it alongside Phase 9, where FCM
>    also forces a real project — one billing/deploy session instead of two). Dev loop stays
>    emulators-only and $0.
> 3. **Full friend-ranked board, tested against seeded friendships.** Build the real
>    `boards/{uid}` fan-out projection now; test it against `scripts/seed-friends.ts` dev
>    friendships. No throwaway self-only stage — the logic lights up for real when Phase 8
>    lands the live friend graph.
> 4. **Daily sets = deterministic picker from the dev-seed bank.** A seeding script builds
>    `dailySets/{dayId}` (3E+4M+3H, category-rotating, `dayId`-seeded so it's reproducible)
>    from the existing 120/lang dev-seed bank, both languages. The real curation queue +
>    OpenTDB importer stay Phase 10.
>
> **Already done (lowers scope):** the economy *write-side* is real since 4b — weekly
> `scores/{uid}` raw buckets + XP/level grants fold into the submit transaction — and the
> profile level ring / XP bar UI shipped in 6b. Phase 7 adds the daily stack, the weekly
> *projection + reset*, the podium, and the daily friends board on top of that base.

### Phase 7a — Daily Challenge + Streaks (playable)
*Refs: doc 02 §5, §8; doc 07 §2.3; doc 08 daily collections*

- **Daily set seeding:** `scripts/seed-daily.ts` builds `dailySets/{dayId}` =
  `{questionIds[10], publishAt}` by deterministically picking 3E+4M+3H from the dev-seed
  bank (`dayId`-seeded RNG, category rotation per GDD §5), per language. Idempotent like the
  question seeder; seeds a ±N-day window around today so rollover is testable.
- **`v1_startDaily({dayId})`** (doc 07 §2.3): validate `dayId` within ±14h of server time
  (`invalid-argument/day-out-of-window`); reject if `dailyPlays/{uid}_{dayId}` exists
  (`failed-precondition/daily-already-played`); serve 10 questions reusing the
  `roundServing`/`servingsPrivate` machinery (serving context `{type:"daily",dayId}`, key
  `daily_${dayId}_${qIx}_${uid}`), order locked per user. Returns `{dailyId, servings[10]}`.
- **`v1_submitDailyAnswer`** (same request shape as `v1_submitAnswer`): server-authoritative
  timing, idempotency key, scoring per §3.3; records into `dailyPlays/{uid}_{dayId}`
  (`{score, correctCount, totalMs, finishedAt, streakAfter}`). Grants fold into one
  transaction: +2 XP/correct each submit, **+25 XP daily completion** on the 10th, and
  weekly points `dailyScore / scoreDivisor` → `applyWeeklyPoints(key:"dailies")`. The 10th
  answer returns `{dailyResult, streak}`.
- **Streak logic (§5):** pure `nextStreak(prev, dayId)` module — consecutive *calendar days
  played* (not won); increments if `dayId` is the day after `streak.lastDayId`, resets to 1
  on a gap, no-op if same day. Writes `users/{uid}.streak {count, lastDayId}` in the
  completion transaction. Unit-tested across increment / reset / same-day / first-ever.
- **Balance (⚖️ → `balance.ts`):** `daily.composition` `[E,E,E,M,M,M,M,H,H,H]`,
  `daily.windowMs` (±14h), `xp.dailyCompleted` (25). No daily number inlined.
- **Contract:** `packages/api_contract/src/daily.ts` — `StartDailyRequest/Response`,
  `SubmitDailyAnswer*` (reuse submit shapes), `DailyResultSchema`, `StreakSchema`.
- **Client:** Home daily card placeholder → real (today's state: not-played / done +
  streak); Daily screen reuses the Phase-5 question widgets across 10 Qs; daily result
  screen with score + streak flame + **share card** (clipboard text, **no question content**
  per the §5 anti-spoiler rule); one-attempt lockout state.
- **Rules:** `dailySets/*` stays default-deny (no client access). `dailyPlays/*` owner-read.

  **Exit checkpoint (7a):** play today's daily end-to-end on a device — 10 questions, score
  comes back **from the server**, streak increments; a second attempt the same day is blocked;
  a `dayId` outside ±14h is rejected. Day-rollover testable by seeding adjacent `dayId`s.

  > **2026-06-24 — Phase 7a ✅ complete.**
  > **Backend:** `daily/` module — `v1_startDaily` (±14h window via pure `isDayIdInWindow`,
  > one-attempt lockout, idempotent resume from `servingsPrivate`, language-keyed set) and
  > `v1_submitDailyAnswer` (server-timed scoring, idempotency-guarded, sequential-answer guard;
  > the 10th answer grants +25 completion XP + `dailies` weekly points and advances the streak,
  > returning `{dailyResult, streak}`). Pure `nextStreak` (consecutive days played) + `dayId`
  > helpers. `dailyServing.ts` mirrors the duel's per-player shuffle (key `daily_{dayId}_{qIx}_
  > {uid}`); `dailyPlays/{uid}_{dayId}` tracks progress + result. New ⚖️ in `balance.ts`:
  > `daily.composition` (3E+4M+3H), `daily.windowMs` (±14h), `xp.dailyCompleted` (25). Economy
  > grants extended (`weeklyPointsForDaily`, `xpForDailyCompletion`). Contract
  > `api_contract/src/daily.ts` + `daily-unavailable` reason. `firestore.rules`: `dailyPlays`
  > owner-read / no client write; `dailySets` stay sealed by the catch-all (no pre-play peek).
  > **Daily set sourcing:** `scripts/seed-daily.ts` — deterministic `dayId`-seeded picker over
  > the dev-seed bank, both languages, ±10..+3-day window; wired into `seed.ps1` + `run.ps1`.
  > **Client:** Home daily card (real played/score + 🔥 streak, taps into the flow);
  > `DailyScreen` reuses the Phase-5 `QuestionScreen` across 10 Qs; `DailyResultScreen` (score,
  > accuracy, streak flame, weekly points, spoiler-free clipboard share). `DailyApi` behind a
  > provider (testable). `users/{uid}.streak` surfaced via `UserProfile.streakCount`. New route
  > `/daily` (full-screen, no tab bar). l10n keys added HE+EN.
  > **Tests:** 66 functions unit (+10: `dayId`/`isDayIdInWindow`/`nextStreak`) + 20 contract +
  > **62 emulator** (+7 daily integration: full 10-Q flow + grants, window reject, one-attempt,
  > resume idempotency, out-of-order, streak increment, idempotent replay; +2 daily rules) +
  > 17 Flutter widget (+1 daily-screen: result renders from the server projection).
  > `flutter analyze`, `tsc`, ESLint all clean.
  >
  > **2026-06-25 — 7a code-review remediation.** Hardened the daily stack against six
  > review findings: (1) **resume cursor** — `StartDailyResponse` now carries
  > `answeredCount` (single-sourced from the new `DAILY_QUESTION_COUNT` contract const) and
  > `DailyScreen` continues from it, so exiting mid-daily and re-entering no longer replays
  > q0 into the sequential-answer guard (was a permanent same-day lockout). (2) **crash-safe
  > start** — `v1_startDaily` writes the `dailyPlays` doc *before* serving (mirrors the duel),
  > so a crash between the two self-heals via re-serve instead of stranding the player on
  > "Daily not started". (3) **midnight rollover** — `todayDayIdProvider` is invalidated on
  > app resume (`TriviaApp.didChangeAppLifecycleState`). (4) **length coupling** — balance
  > `daily.composition` and the seeder both assert against `DAILY_QUESTION_COUNT` at load/seed
  > time. (5) `submitDailyAnswer` reads play+user via one `tx.getAll`. (6) the daily/duel
  > serving machinery is unified in `serve/serving.ts` (`servePlayerQuestions` /
  > `loadServedQuestions`); `roundServing`/`dailyServing` are thin wrappers. New emulator test:
  > resume-after-partial-play returns the cursor and still completes. `tsc`/ESLint/`flutter
  > analyze`/76 unit + widget tests clean; emulator integration suite to be run in the dev
  > loop (needs JDK 21).

### Phase 7b — Weekly Race + Podium + Daily Friends Board
*Refs: doc 02 §7; doc 08 weekly/daily projections; doc 07 §2.4*

- **`boards/{uid}` friend-ranked projection (§7, doc 08):** on every award (the submit/sweep
  match resolution **and** daily completion), fan out to each affected player + their
  friends: read `friendsOf(uid)` from `friendships/*`, recompute that viewer's
  `weekly/{weekId}/boards/{uid}` = `{rows:[{uid,name,avatarId,level,points,rank}], updatedAt}`
  sorted desc with rank. Bounded by friend count (doc 06 §10 — one listened doc per user).
  Pure ranking/tiebreak helper, unit-tested; fan-out wired into the existing resolution
  transaction's post-commit step (reads forbidden mid-txn → fan-out runs after commit).
- **Daily friends-today board:** `daily/{dayId}/friendScores/{uid}` projection (public subset
  of `dailyPlays`), fanned out on daily completion. `firestore.rules`: readable by the owner
  and their friends **only after the reader has played** (`playedAt` precondition, doc 07
  §2.4 / doc 08) — no spoilers/anchoring.
- **Monday reset job:** pure `rollWeek(now)` module (ISO week, Asia/Jerusalem) — archives the
  closing week into per-user profile history (last ⚖️ 26 weeks, doc 08 §4) and lets the new
  `weekId` start empty (lazy-created on first award). `scheduledWeeklyReset` (`jobs/`,
  `onSchedule`, Mon 00:00 Asia/Jerusalem) **wired but not deployed** (Blaze deferred per the
  decision above); the emulator suite drives `rollWeek` directly. End-of-week podium
  notification copy is stubbed (real send = Phase 9).
- **Client:** weekly leaderboard screen (one listened `boards/{uid}` doc) with the friends
  race; **podium screen** (top-3 celebration, reduced-motion aware, reuses Phase-5 juice);
  Home weekly card placeholder → real (my rank + top friend). Daily friends-today board
  rendered on the 7a daily result screen (post-play).
- **Tests:** award fan-out updates each friend's board + ranking/tiebreak; `daily/friendScores`
  hidden pre-play / visible post-play (rules matrix); `rollWeek` archives + resets across a
  simulated Monday boundary; daily completion writes both `friendScores` and the weekly
  `dailies` bucket. Test against `scripts/seed-friends.ts` graph.

**Exit checkpoint (7b):** a **day-rollover** and a **week-rollover** both simulated
end-to-end on the emulator; daily streak and the weekly **podium** visible in the UI; the
friends-today board appears only after you've played. *(Blaze deploy + real scheduled-job
firing remain a dedicated later step — see decision 2.)*

> **2026-06-25 — Phase 7b split into 7b-1 (backend ✅) + 7b-2 (UI, next).** Per the
> 4a/4b · 6a/6b cadence (user decision). **7b-1 backend is complete; proven by the
> emulator suite.**
> **Projections (GDD §7, doc 08 §2):** new `economy/boards.ts` — pure `buildBoardRows`
> (rank desc by points, tiebreak level then uid), `friendsOf` (`friendships/*`
> `array-contains` query), `fanOutWeeklyBoards` (per-viewer: each award recipient ∪ their
> friends → rebuild `weekly/{weekId}/boards/{viewer}` from each member's weekly score +
> profile), and `fanOutDailyFriendScore` (the player's own `daily/{dayId}/friendScores/{uid}`
> public subset — no question content). Contract `api_contract/src/board.ts`
> (`LeaderboardRow`/`WeeklyBoard`/`FriendScore`).
> **Wiring (post-commit, best-effort):** Firestore forbids the reads-after-writes a
> projection needs inside a txn and no trigger is deployed, so fan-out runs AFTER the
> resolution transaction commits in `submitAnswer` (match finish → both players),
> `sweepForfeits` (forfeit → winner; `forfeitMatchTx` now returns the winner uid), and
> `submitDailyAnswer` (10th answer → friendScore + board). A failed fan-out logs and never
> fails the callable (the next award rebuilds).
> **Monday reset:** pure `economy/rollWeek.ts` — archives each viewer's own closing-week
> board row into `users/{uid}.weeklyHistory` (capped ⚖️ `weekly.historyWeeks=26`), guarded
> by a `weekly/{closingWeekId}.rolledAt` marker (re-run = no-op); new weekId starts empty
> (lazy). `weekId.ts` gains `previousWeekId` (−48h, DST-safe). `jobs/scheduledWeeklyReset.ts`
> (`onSchedule`, Mon 00:00 Asia/Jerusalem) **wired, NOT deployed** (Blaze deferred — decision
> 2); the suite drives `rollWeek` directly.
> **Rules:** `weekly/{weekId}/boards/{uid}` owner-read (board already holds friends' rows);
> `daily/{dayId}/friendScores/{uid}` owner-read + friend-read gated on the reader having
> *finished* today's daily (`isFriend` helper + `dailyPlays` `finishedAt` precondition, GDD
> §5 anti-spoiler). Both function-written.
> **Dev data:** `seed-friends.ts` now writes a fully-connected `friendships/*` graph among
> the seed accounts; new `seed-friendships.ts --uid <guest>` links the on-device guest.
> **Tests:** 76 functions unit (+10: `buildBoardRows`, path helpers, `previousWeekId`) +
> **71 emulator** (+18: 3 boards integration — duel fan-out ranks, daily friendScore +
> board, `rollWeek` archive/idempotent; +6 rules — board owner-only, friendScore
> owner/friend-post-play/not-played/non-friend). `tsc`, ESLint, `flutter analyze` (app
> untouched) clean.
> **7b-2 (next):** Dart models, weekly board provider/screen, podium, Home weekly card,
> daily-result friends board, l10n, widget tests.
>
> **2026-06-25 — Phase 7b-2 ✅ complete → Phase 7b done.** Client UI on top of the
> 7b-1 projections; app-only (no backend change).
> **Models** (`app/lib/models/leaderboard.dart`): `LeaderboardRow`/`WeeklyBoard`/
> `FriendScore` mirror `api_contract/board.ts` — rendered, never re-derived (guardrail #1).
> **Providers** (`app/lib/state/weekly_providers.dart`): `clientWeekId()` mirrors the
> server `weekId()` (ISO-8601, week-numbering year, Thursday rule) so the client targets
> the right `weekly/{weekId}/boards/{uid}` doc — uses device-local date (matches the IL
> audience; a non-IL device near the Monday boundary self-heals, board read is display-only,
> unit-tested for parity incl. year crossover). `weeklyBoardProvider` (single owner-readable
> doc that already embeds friends' rows — one listened doc per player). `dailyFriendsBoardProvider`
> derives friend uids from the weekly board (the only client-readable friend list pre-Phase-8,
> since `friendships/*` is client-denied) and fans IN per-doc `daily/{dayId}/friendScores/{uid}`
> gets (a collection query would be denied by the friend-gate rule).
> **Screens:** `WeeklyScreen` (top-3 podium strip + ranked list, own row highlighted; solo/
> empty graph → invite-to-race empty state per the user decision); `PodiumScreen` (top-3
> celebration, reduced-motion aware, reuses Phase-5 fanfare/haptics). New `/weekly` full-screen
> route. Home weekly card placeholder → real (my rank when a race exists, else join prompt).
> Daily-result screen gains a post-play friends-today board (`_FriendsTodayBoard`, hidden while
> loading/empty — anti-spoiler holds since the screen is reached post-play + rules gate).
> **l10n:** weekly/podium/friends-today keys HE (template) + EN.
> **Tests:** +7 Flutter widget/unit (3 weekly-screen: ranked render, solo empty, podium top-3;
> 4 `clientWeekId` parity) → 24 Flutter green; `flutter analyze` clean. Backend untouched.

## Phase 8 — Identity & Friends
*Refs: doc 05 §1, doc 02 §10.1, doc 07 §2.1/§4*

Google + Apple sign-in, guest merge (XP/matches/friendships survive) · registration
prompts at the doc 05 trigger moments · invite-link service (Hosting redirect + deferred
deep link, Android install-referrer path first) · @username claim/search · QR add ·
block/unfriend cascade. Device-tested install path — this is the flakiest feature
(doc 11 risk), budget real time.

**Exit checkpoint:** a fresh phone installs via an invite link and lands auto-friended
in a ready duel vs. the inviter.

> **2026-06-27 — Phase 8 split into 8a (emulator-first social graph) + 8b (real-project
> identity & deep-links), per the 4a/4b · 6a/6b · 7a/7b cadence (user decision).** The
> exit checkpoint above (install-path invite → auto-friended duel) is an **8b** deliverable
> and bundles with the deferred Blaze/real-project session alongside Phase 9. **8a is
> complete; proven on emulators ($0).**
> **Decisions:** createDuel now enforces friendship + block; `v1_deleteAccount` = cascades
> now (forfeit + tombstone), full PII wipe at Gate C; `users` reads widen to friends (doc 08);
> cancelled match = `state:cancelled`+`result:null`; QR encodes the invite code; rate
> limits / deep profanity / full wipe deferred to WS5/Gate C.
>
> ### Phase 8a — Social graph (emulator-first) ✅
> **8a-1 backend.** New contract `api_contract/src/social.ts` (+5 error reasons in
> `common.ts`). New `functions/src/social/`: `username` (pure normalize/validate/profanity) +
> `v1_claimUsername` (transactional `usernames/{handle}` registry) + `v1_searchUsername`
> (docId prefix scan, opt-out/block/self filtered, public subset only); `friendships.ts`
> (`pairId`/create/remove/`eitherBlocks`/`isFriendTx`); `v1_sendFriendRequest`/
> `v1_respondFriendRequest` (mutual + reverse-pending auto-accept; sender identity
> denormalized onto the request so the recipient can render it); `v1_issueInviteCode`/
> `v1_redeemInviteCode` (multi-use code → friendship + best-effort same-language auto-duel vs
> inviter); `v1_unfriend`/`v1_block`/`v1_unblock` (block hides from search, removes edge,
> cancels matches, drops boards both ways); `v1_completeOnboarding`; `v1_deleteAccount`
> (opponent forfeit + tombstone + username release + graph drop). Cancel cascade
> `social/cancelMatch.ts` (pure `decideCancel` + exactly-once `cancelMatchTx`, mirrors
> `sweepForfeits`). Extracted shared `resolveForfeitWin` from `sweepForfeits.ts` (sweep +
> deleteAccount share one path). `createDuel`/`acceptRematch` gained the friend/block gate
> (`not-friends`/`blocked`). `firestore.rules`: `users` read widened to friends;
> `friendships`/`friendRequests`/`invites` read-scoped; `usernames` callable-only; `username`/
> `blocked` stay function-written. **Zero new composite indexes.** New ⚖️ `balance.social`
> (searchResultLimit 10, inviteMaxRedemptions 50, autoDuelCategoryMode spin).
> **8a-2 client.** `models/social_models.dart`, `services/social_service.dart` (SocialApi +
> fake-injectable), `state/social_providers.dart` (live friendships/requests/friend-profile
> streams). Real Friends tab (list + requests accept/decline + unfriend/block), add-friend
> (username search + invite-code entry + scan), my-QR (qr_flutter) + scan (mobile_scanner)
> with a manual-code fallback, profile edit (displayName/avatar/searchable/username/delete).
> Friend picker + match_card now read the LIVE graph (kSeedFriends retired from the picker;
> seed scripts stay for dev). Routes `/friends/{add,scan,myqr}` + `/profile/edit`; HE+EN l10n;
> camera perms (Android + iOS). Packages: `qr_flutter`, `mobile_scanner`.
> **Tests:** contract 26 · functions unit 93 (+17: username/friendships/invites/cancelMatch) ·
> **emulator 92** (+ full social suite: claim/search/requests/invites/block/unfriend/createDuel
> gate/deleteAccount; +rules matrix for users-friend-read / friendships / requests / invites /
> usernames-denied / username+blocked write-deny) · Flutter 26 (+2 social widget). `tsc`,
> ESLint, `flutter analyze` clean.
> **8b (deferred to the Phase-9 real-project session):** Google/Apple sign-in + guest merge,
> invite deep-link install path (Hosting redirect + install-referrer/clipboard), FTUE invite
> sheet, registration prompts, App Check.

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
| Blaze plan needed for scheduled jobs | Deploy deferred from Phase 7 to a dedicated step alongside Phase 9 (FCM forces a real project too — see Phase 7 decision 2). Budget alert at $10 configured the same day; emulators remain the default dev loop forever |
| Content review fatigue (Phase 10) | Review CLI UX is a first-class deliverable; track approved-count in this doc per session |
| Walking skeleton accumulates "temporary" shortcuts | Each phase's DoD includes deleting the shortcuts it replaced; `dev-seed` content purge is an explicit Phase 10 item |

## Progress Tracker
| Phase | Status | Date | Commit |
|---|---|---|---|
| 0 — Tooling & scaffold | ✅ | 2026-06-14 | abf37a8 |
| 1 — Walking skeleton | ✅ | 2026-06-14 | bfeaaf0 |
| 2 — Round engine | ✅ | 2026-06-14 | afd89a5 |
| 3 — Duels | ✅ | 2026-06-17 | 883da14 |
| 4a — Core duel rules | ✅ | 2026-06-18 | 666aa83 |
| 4b — Jobs/economy → Gate A | ✅ | 2026-06-18 | 0874e88 |
| 5 — Design system | ✅ | 2026-06-19 | (this commit) |
| 6a — App shell (tabs/Home/duel loop) | ✅ | 2026-06-21 | 03880d7 |
| 6a review remediation — WS1 (integrity/idempotency) | ✅ | 2026-06-21 | 8b98aec |
| 6b — Duel loop complete + WS2/WS3/WS4 | ✅ | 2026-06-23 | (this commit) |
| 7a — Daily Challenge + streaks | ✅ | 2026-06-24 | (this commit) |
| 7b — Weekly race + podium + daily board | ✅ | 2026-06-25 | (uncommitted) |
| 8a — Social graph (emulator-first) | ✅ | 2026-06-27 | (uncommitted) |
| 8b — Identity & deep-links (real project) | ☐ | | (with Phase 9 Blaze step) |
| 9 — Notifications | ☐ | | |
| 10 — Content (parallel) | ☐ | | |
| 11 — Gate B | ☐ | | |
| 12 — Gate C | ☐ | | |
