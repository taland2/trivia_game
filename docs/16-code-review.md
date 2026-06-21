# 16 — Heavy Code Review (Gate A / Phase 6a)

**Date:** 2026-06-21
**Reviewed against:** the 8 hard engineering guardrails (CLAUDE.md, docs/06, docs/09),
the ERD (docs/08), the API spec (docs/07), and the test plan (docs/12).
**Scope:** full codebase — Flutter app (`app/`), Cloud Functions (`functions/`), Firestore
rules/indexes (`firebase/`), API contract (`packages/api_contract/`), scripts (`scripts/`),
plus docs-vs-code drift.
**Method:** multi-agent review — 7 parallel reviewers (one per dimension), each finding then
adversarially verified by an independent skeptic (3-verifier panels for security/integrity
findings). 47 findings confirmed; 10 candidate findings rejected during verification (listed
in the appendix). This is a **review-only** report — no code was changed.

> Severity note: where the verification panel downgraded a reviewer's severity, the corrected
> severity is used and the disagreement is noted inline.

---

## 1. Executive summary

The architecture is **fundamentally sound**. The two hardest-to-retrofit guardrails — the
correct answer never reaching the client (guardrail 2) and all integrity writes going through
Cloud Functions (guardrail 1) — are upheld end-to-end and, for the anti-leak invariant, tested.
The match-resolution transaction is correctly atomic. The codebase is clean and consistent for
its phase.

The findings cluster in four themes:

1. **Idempotency & cap enforcement on the create-side callables** — `submitAnswer` does
   idempotency correctly; `createDuel` / `acceptRematch` / `joinStrangerQueue` do not, and the
   cap check is racy. This is the most concrete correctness/integrity gap (guardrail 5).
2. **One server-side scoring-integrity bug** — a client can finish a round while skipping a
   question, defeating exactly the anti-cheat rule GDD §11 was written to prevent, and
   producing a contract-violating recap.
3. **ERD ↔ code ↔ contract drift** — `scoreTotals`, the `servingsPrivate` shape, the
   `users/{uid}/servings` collection, and the question-selection indexes have all drifted from
   docs/08. No security impact, but the source-of-truth doc is now wrong in several places.
4. **Localization, a11y, and the thin submit-response on the client** — the most important
   screen has hardcoded Hebrew and fabricates a points breakdown; the Dart client discards the
   authoritative round/match result the server already returns.

### Findings by severity

| Severity | Count | Notes |
|---|---|---|
| High | 7 | 1 scoring-integrity bug, idempotency gap, ERD `scoreTotals`, missing indexes, hardcoded Hebrew, fake points split, client discards server result |
| Medium | 8 | cap races, ERD shape drift, quarantine filter, a11y, several test gaps |
| Low | 22 | docs drift, TTL/rate-limit deferrals, dead code, dependency pin |
| Nit | 7 | cosmetic + 3 positive confirmations |

### Guardrail compliance scorecard

| # | Guardrail | Status | Notes |
|---|---|---|---|
| 1 | Integrity writes via Cloud Functions only | ✅ **Pass** | Zero client-side integrity writes (verified). Guest profile write is whitelisted-only. Caveat: create-side caps are racy (below), but writes are still server-side. |
| 2 | Correct answer never reaches client pre-answer | ✅ **Pass** | `servingsPrivate` split honored end-to-end; `correctIx` only in the submit *response*. Invariant is tested. |
| 3 | Server-authoritative timing | ✅ **Pass** | `elapsedMs` computed from server `servedAt`. Gap is test-only (no e2e late-submit test). |
| 4 | Balance values via Remote Config | 🟡 **Mostly** | Core balance values are config-driven, but the idempotency 24h TTL, per-uid rate limits, and forfeit-sweep cadence are not (see Low findings). |
| 5 | Idempotency keys on every mutating callable; txns for resolution | ❌ **Gap** | Resolution txn ✅. Idempotency present only on `submitAnswer`; `createDuel`/`acceptRematch`/`joinStrangerQueue` lack it; cap check non-transactional. |
| 6 | No secrets in client/repo | ✅ **Pass** | No secrets found; dev Firebase config is non-sensitive. |
| 7 | Every GDD §11 edge-case row has a test | ❌ **Gap** | Several rows untested: skip-question, stale `roundIx`, e2e submit-after-timeout, Hebrew bidi, retry storm. |
| 8 | Analytics only via typed contract, no PII | ⚪ **N/A yet** | Analytics not implemented at this phase. Re-check when it lands (Phase 7+). |

---

## 2. High-severity findings

### H1 — A round can be completed while skipping a question (scoring-integrity bypass)
**`functions/src/match/submitAnswer.ts:104, 169, 179`** · guardrail 7 / integrity

`lastQ` is computed purely positionally (`qIx === roundComposition.length - 1`), and the only
per-answer guard is duplicate detection (`me.done || me.answers.some(a => a.qIx === qIx)`).
Nothing requires earlier questions to be answered first, and skipped questions are never
auto-scored as timed-out. Because `roundServing` deals **all three** `servingsPrivate` docs up
front, a client can submit `qIx=0` then `qIx=2`; at `qIx=2`, `me.done=true` with only two
answers recorded.

- **Impact:** Defeats exactly GDD §11's "App killed mid-question → score timed-out, resume at
  next unanswered question; prevents kill-app-to-retry-a-hard-question." A player can skip the
  Hard question and still finish, gaining a `totalMs` tiebreak edge. The recap is built by
  mapping `me.answers`, producing a 2-element array that violates `RecapPlayerSchema.answers.length(3)`
  (`packages/api_contract/src/duel.ts:102`) — the unvalidated `tx.set` persists a malformed
  participant-readable recap that breaks client/codegen parsing for both players.
- **Fix:** Enforce sequential answering (reject `qIx !== me.answers.length`), or auto-insert
  timed-out 0-point answers for skipped indices before recording. Add the GDD §11 test.

### H2 — Create-side mutating callables have no idempotency key (guardrail 5)
**`packages/api_contract/src/duel.ts:12-18, 26-29` · `stranger.ts:12-14`; handlers `createDuel.ts`, `acceptRematch.ts`, `strangerQueue.ts`**

doc 07 §1 mandates `idempotencyKey` on *every* mutating callable. Only `v1_submitAnswer`
implements it (`submitAnswer.ts:106,325`). `CreateDuel`/`AcceptRematch`/`JoinStrangerQueue`
request schemas are `.strict()` with no key, and the handlers do no replay guard.

- **Impact:** A retried/double-tapped `createDuel` or `acceptRematch` creates a *second real
  match*, consuming the §4.6 caps and confusing both players' `matchList`. (`joinStrangerQueue`
  is naturally idempotent — `set()` on `strangerQueue/{uid}` — and flag-gated off, so it's the
  least urgent.)
- **Verification note:** panel split high/medium/medium — a clear guardrail-5 breach on live
  MVP callables, but blast radius is bounded (caps + recoverable). Treat as a must-fix.
- **Fix:** Add `idempotencyKey` to the three request schemas and gate each mutation through the
  same `idempotency/{uid}_{key}` check-and-store, ideally inside the creating transaction.
  *Or* explicitly amend doc 07 §1 / guardrail 5 to exempt match-creation and justify it.

### H3 — `scoreTotals` is a function-written integrity field absent from the ERD
**`functions/src/match/types.ts:36`** · ERD fidelity (docs/08)

`MatchDoc.scoreTotals` (per-player sum of won-round scores, feeding weekly leaderboard points)
exists in code but is not in the docs/08 `matches/{matchId}` entity. A reader of the
source-of-truth ERD cannot know this authoritative field exists or that it must never be
client-written.

- **Fix:** Add `scoreTotals` to docs/08 §2, marked immutable-to-clients (GDD §7).

### H4 — Documented question-selection / serving-exclusion composite indexes are missing
**`firebase/firestore.indexes.json:2-11`** · ERD fidelity (docs/08 §3)

Only the forfeit-sweep index (`state`+`turnDeadline`) is codified. The hottest path —
question selection (`language`+`category`+`difficulty`[+`quarantined`]) — has no composite
index, and the doc 08 §3 `rand`-field technique is not implemented (`questionBank.ts:52-82`
filters in memory). Fine at dev scale; fails or degrades once the bank grows / an `orderBy` is
added.

- **Fix:** Either add the documented composite index(es) before the bank build-up (Phase 10),
  or update docs/08 §3 to record that selection runs on auto single-field indexes and
  intentionally needs no composite. (See also ERD section.)

### H5 — Question screen hardcodes Hebrew strings (localization violation)
**`app/lib/question_screen.dart:260-271`** · doc 04 §7

The difficulty labels (`'קל'`/`'בינוני'`/`'קשה'`) and the `'שאלה N/M'` counter are inlined in
Hebrew on the app's most important screen. doc 04 §7 mandates all copy through localization
keys. The EN locale will show Hebrew here.

- **Fix:** Use the existing `l.difficultyEasy`/etc. keys (as `RoundResultScreen` already does)
  and add a `questionProgress(number, total)` ARB key.

### H6 — Points fly-up fabricates a fake base/bonus split
**`app/lib/question_screen.dart:171-176`** · doc 04 §4

The UX spec requires the speed bonus itemized as `base + bonus` ("150 + 38 ⚡"). The client
invents an incorrect split because the server doesn't return one, so the headline juice moment
shows wrong numbers.

- **Fix:** Add `basePoints` (and optionally `speedBonus`) to the `v1_submitAnswer` response
  contract and display the real split. Until the contract carries it, show only the total
  `+points ⚡` — do not fabricate.

### H7 — Dart client discards the authoritative round/match result from the submit response
**`app/lib/screens/match/match_controller.dart:121-126`** · contract fidelity

`FirebaseMatchApi.submitAnswer` keeps only a thin `AnswerOutcome` and drops `replay`,
`roundResult`, and `matchResult` that the server already returns. The client then re-derives
round/match outcome from local heuristics (e.g. `points>0`) instead of the server projection.

- **Fix:** Extend `AnswerOutcome` to carry `replay`/`roundResult`/`matchResult`, parse them, and
  have `RoundScreen` branch on `replay` (re-enter `startRound`) and render results from the
  server projection. This also removes the need for the points>0 heuristic in `round_screen.dart`.

> A separate reviewer flagged the **Progress Tracker drift** (docs/15:419-423 still shows Phase 6
> as not started though Phase 6a shipped, commit `03880d7`) as High. It's a docs-hygiene issue,
> filed in the Docs-drift log (§6, DD1) rather than here.

---

## 3. Medium-severity findings

| ID | Finding | Location | Notes |
|---|---|---|---|
| M1 | `createDuel` cap check is non-transactional (check-then-create race) | `createDuel.ts:117-147` | Concurrent calls/retries both pass the cap. Panel split medium/low/low — bounded overshoot of a soft anti-spam cap; reliably exploitable when combined with H2. Wrap count+create in a transaction. |
| M2 | `acceptRematch` bypasses the §4.6 caps and same-language re-check | `acceptRematch.ts:39-50` | A rematch is a new active match but skips the caps its sibling `createDuel` enforces. Run the cap query before persisting, or document rematches as exempt. |
| M3 | `servingsPrivate` doc shape is far richer than docs/08's `{questionId, correctIx}` | `roundServing.ts:65-77` | Deliberate & safe (rules deny all client access), but the ERD is wrong. Update docs/08 §2 to enumerate real fields. |
| M4 | `users/{uid}/servings` collection in the ERD is not implemented | `docs/08-data-model.md:14,16,115-125` | Code uses callable-response delivery + a single top-level `servingsPrivate`. Reconcile the ERD (path/parent/visibility all differ). |
| M5 | Question selection omits the documented `quarantined` filter | `questionBank.ts:63-68` | A flagged question stays servable. Add `.where('quarantined','==',false)` or document deferral. |
| M6 | No screen-reader semantics on answer buttons / wheel / points | `app/lib/widgets/answer_button.dart:30-34` | `GestureDetector` gives no button semantics; state changes unlabeled. doc 04 §8. Wrap in `Semantics(button:true, …)`. |
| M7 | No Flutter `integration_test/` golden-path E2E exists | `app/` (absent) | Only isolated widget tests with fake APIs. Add Full-duel + Forfeit paths against the emulator when Phase 6 UI lands. |
| M8 | `rand`-field question selection + operational fields + selection index all missing | `questionBank.ts:52-82` | Same root as H4; tracked separately as it spans schema + seed data + index. Address together before Phase 10. |

Three further Medium **test-coverage** gaps are consolidated in §5 (stale-`roundIx`, e2e
submit-after-timeout).

---

## 4. Low & Nit findings (grouped)

**Security / integrity hardening (deferrable, mostly pre-beta):**
- **App Check never enforced** on any callable or Firestore (`submitAnswer.ts:51` pattern).
  Verification downgraded High→**Low**: doc 09 §6 lists App Check as a *before-beta* gate
  (Phase 12), and there's no deployed env yet. Track so the gate isn't silently missed.
- **No per-uid rate limiting** anywhere (doc 07 §1: writes 60/min etc.). Pairs with App Check as
  the scripted-abuse defense; deferrable to pre-beta. Source limits from Remote Config.
- **Implausible-speed `suspicionScore`** flagging (doc 09 §2) not implemented; doc marks the MVP
  action as "manual," and `elapsedMs` is already captured. Track or note as deferred.
- **Idempotency records never expire** (`submitAnswer.ts:325`) — `createdAt` only, no `expiresAt`/
  TTL policy/sweep; collection grows unbounded vs doc 07 §1's 24h. Also a path mismatch
  (`idempotency/` vs doc 08's `counters/`). Add `expiresAt` + Firestore TTL.
- **`createDuel` active-cap only checks the challenger**, never the opponent (`createDuel.ts:117-134`);
  a popular user can be pushed past 20 active duels by being challenged. (Per-pair cap is
  effectively symmetric via the dual matchList.)

**Client / contract (cosmetic or low-impact):**
- `question_screen.dart:90` reads `serving['category']`, which the strict Serving payload never
  contains → category accent color always defaults. Masked by a synthetic test fixture. Pass the
  round's category in explicitly and fix the fixture.
- `app/lib/models/match_list_entry.dart:57` models `finished` as a bool and drops the `result`
  payload the projection carries — fine today, will need a model change for a "won/lost" card.
- Stranger-queue callable responses (`stranger.ts:21-41`) don't match doc 07 §2.2 shapes
  (`{queued,matchId}`/`{left}` vs `{ok}/{queued}`). Fix the (stale) doc.

**Docs / hygiene (see also §6):**
- Forfeit-sweep schedule is every 15 min but doc 06 §3 says hourly (`scheduledForfeitSweep.ts:13`).
- `scripts/setup-path.ps1:11,37` pins JDK 17, but docs/15 Phase 3 moved tooling to JDK 21.
- Dead default-template `app/lib/main.dart:1-123` (superseded by flavored mains in Phase 0).
- `intl` dependency is unpinned (`any`) in `app/pubspec.yaml`.

**Nits:**
- Timed-out answers store raw `elapsedMs` into `totalMs` unclamped (`submitAnswer.ts:176-178`) —
  semantically odd for tie-breaks; clamp to `[0, timeLimitMs+grace]`. (Verification: the
  contract-violation angle is theoretical; server timestamps don't go backwards.)
- Serving example in docs/08 shows a 2-element answers list but the contract fixes exactly 4
  (`serving.ts:18`, GDD §3.1). Fix the doc example.

**Positive confirmations (no action):**
- ✅ Zero client-side integrity writes; guest profile write is whitelisted-only (`auth_providers.dart:41-48`).
- ✅ Anti-leak invariant (guardrail 2) enforced and tested end-to-end (`serving.ts:11-20`).
- ✅ Error-reason enum & `HttpsError` usage match doc 07 §1 across all callables (`common.ts:30-51`).
  Note: `question-expired` is defined but never emitted (timeouts are scored 0, not rejected) —
  annotate doc 07 as reserved.
- ✅ `AudioService`/`HapticsService` singletons handle mute correctly; init is idempotent.

---

## 5. Test-coverage gaps (guardrail 7 — GDD §11 / docs/12)

| Gap | Where | Severity |
|---|---|---|
| Skip-the-hard-question (H1) has no test | `functions/test/duel.integration.test.ts` | High (tied to H1) |
| "Submit with stale `roundIx`" (docs/12 §3 adversarial) untested | integration suite | Medium |
| "Submit after timeout" only unit-tests the pure scorer, never e2e through `submitAnswer` with the server clock | `scoring.test.ts:66-87` | Medium |
| `submitAnswer`'s own `not-your-turn`/`match-finished` guards unexercised (only `startRound`'s copies are) | integration suite | Low |
| Friday-23:59 weekly boundary: `weekId` unit-tested, but no test resolves a match *across* the reset | `weekId.test.ts:21-31` | Low |
| Retry-storm "N concurrent same-key → exactly-once" not explicitly stressed (only sequential replay) | `economy.integration.test.ts:192-206` | Nit |
| `shuffleAnswers` distribution assertion is weak (>5%/slot) — wouldn't catch a biased-shuffle regression | `questionBank.test.ts:46-57` | Nit |
| `question-expired` reason has no test (quarantine path, Phase 10) | — | Low (deferred) |

> Recommended now: a test for H1, the stale-`roundIx` case, and the e2e late-submit case (the
> integration harness can already backdate `servedAt` via admin). These three directly defend
> guardrails 3 and 7.

---

## 6. Docs-vs-code drift log

Each tagged **fix doc** or **fix code**.

| ID | Drift | Resolution |
|---|---|---|
| DD1 | docs/15 Progress Tracker shows Phase 6 not started, but Phase 6a shipped (commit `03880d7`) | **fix doc** — add the Phase 6a block + date; record 6a/6b split |
| DD2 | `scoreTotals` (H3) not in ERD | **fix doc** (docs/08 §2) |
| DD3 | `servingsPrivate` shape (M3) richer than ERD | **fix doc** (docs/08 §2) |
| DD4 | `users/{uid}/servings` collection (M4) documented but not built | **fix doc** (or build the split) |
| DD5 | Question-selection indexes / `rand` technique / `quarantined` (H4, M5, M8) | **fix doc or code** — decide before Phase 10 |
| DD6 | Stranger-queue response shapes vs doc 07 §2.2 | **fix doc** |
| DD7 | Forfeit-sweep cadence 15min vs doc 06 §3 hourly | **fix either** + note cost delta |
| DD8 | `setup-path.ps1` JDK 17 vs docs/15 JDK 21 | **fix code** (script) |
| DD9 | Idempotency store path `idempotency/` vs docs/08 `counters/`; no TTL | **fix doc or code** |
| DD10 | `question-expired` reason defined but never emitted | **fix doc** (mark reserved) |
| DD11 | docs/08 serving example shows 2 answers vs fixed-4 contract | **fix doc** |

---

## 7. Prioritized remediation list

Ordered for triage into phases. Items in the same group are independent.

**Fix now (correctness / integrity):**
1. **H1** — enforce sequential answering / auto-timeout skipped questions, + GDD §11 test.
2. **H2** — idempotency keys on `createDuel`/`acceptRematch`(/`joinStrangerQueue`), or amend the spec.
3. **M1 + M2** — make the cap check transactional and apply caps in `acceptRematch` (pairs with H2).
4. Test trio from §5: H1 case, stale-`roundIx`, e2e late-submit.

**Fix with Phase 6 UI work (client correctness):**
5. **H7** — carry `replay`/`roundResult`/`matchResult` to the client; drop local heuristics.
6. **H6** — add `basePoints` to the submit response; show the real split (or total-only meanwhile).
7. **H5** — localize the question-screen strings.
8. **M6** — add screen-reader semantics.

**Reconcile docs (cheap, do in a batch):**
9. **DD1–DD11** — one docs-sync pass; most are one-liners. H3/H4 ERD updates included.

**Before beta / Phase 10 (track explicitly so gates aren't missed):**
10. App Check enforcement + per-uid rate limits + `suspicionScore` (doc 09 §6 gate).
11. Idempotency TTL/retention; question-selection indexes + `rand` + `quarantined` filter.
12. Flutter golden-path E2E (M7); remaining §5 test gaps.

**Cleanup (anytime):**
13. Delete `app/lib/main.dart`; pin `intl`; fix `serving['category']` read + test fixture.

---

## Appendix — candidate findings rejected during verification (10)

These were raised by a reviewer but did **not** survive adversarial verification (judged
not-a-real-issue, a duplicate, or a healthy/positive observation). Listed for transparency; a
couple are borderline and worth a second glance if related code changes.

| Rejected finding | File | Raised as |
|---|---|---|
| GDD §11 edge-case rows lack tests (generic) | `submitAnswer.ts` | medium — superseded by the specific §5 gaps |
| `servingsPrivate` omits `expiresAt` / lifecycle field | `roundServing.ts` | low — folded into the deferred TTL work |
| `currentRound` 0-based in code vs ERD implying 1-based | `types.ts` | nit — code comment clarifies it's 0-based |
| Fire-once result dispatch correct & well-tested | `question_screen.dart` | low — positive (no issue) |
| No `autoDispose` on stream providers, but no leak (app-scoped) | `match_list_providers.dart` | low — no leak in practice |
| Idempotency key generated per submit; matches doc 07 | `match_controller.dart` | low — positive |
| Round-result correctness inferred from `points>0` | `round_screen.dart` | medium — *borderline*; addressed indirectly by H7 |
| `MatchResult` reason enum has values no function produces yet | `duel.ts` | nit — values are reserved for future phases |
| GDD §11 "Hebrew bidi" row has no test; widget tests run EN-only | `app/test/*` | high — *borderline*; consider when adding a11y/RTL tests |
| `intl` unpinned | `pubspec.yaml` | low — also surfaced & **confirmed** elsewhere |

> The two borderline rejections (round-result `points>0` heuristic, Hebrew-bidi test gap) are
> effectively covered by confirmed findings H7 and the §5 test recommendations, so nothing is lost.
