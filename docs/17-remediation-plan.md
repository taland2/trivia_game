# 17 — Remediation Plan (from the Gate A / Phase 6a code review)

**Date:** 2026-06-21
**Source:** `docs/16-code-review.md` (47 confirmed findings).
**Goal:** close the review findings with best-practice fixes, sequenced so integrity
gaps are shut before any further feature work builds on top of them.
**Method note:** this plan is grouped into workstreams (WS) that map onto §7 of the
review. Each item states the *problem*, the *best-practice fix*, *files touched*, the
*test* that proves it, and *acceptance criteria*. Open either/or decisions are collected
in §0 — those need user sign-off before the affected items start.

---

## 0. Decisions (resolved 2026-06-21)

D1–D3 and D5 confirmed by the user (all took the recommended option). D4 stands on the
recommendation below pending no objection.

| # | Decision | Resolution |
|---|---|---|
| D1 | **H1 fix shape** | ✅ **Sequential enforcement** — reject `qIx !== me.answers.length`. Guarantees the 3-element recap and matches GDD §11 "resume at next *unanswered* question". |
| D2 | **H2 fix shape** | ✅ **Implement idempotency** — add `idempotencyKey` to the 3 create callables + check-and-store inside the creating txn. |
| D3 | **H4 / M5 / M8 timing** | ✅ **Defer indexes + `rand` to Phase 10** (documented in docs/08 §3); add the `quarantined` filter now. |
| D4 | **DD7 forfeit-sweep cadence** | 🟡 **Keep 15 min, fix doc 06 §3** + note the cost delta (recommended; no objection raised). |
| D5 | **H6 fix shape** | ✅ **Add `basePoints` (+`speedBonus`) to the `v1_submitAnswer` response** and show the real split. |

---

## WS1 — Server integrity & idempotency (FIX NOW, before any feature work)

These three ship together: H2/M1/M2 all become one atomic create path, and H1 is an
independent guard in `submitAnswer`. Target: one PR, functions-only, fully tested against
the emulator.

### 1.1 — H1: reject out-of-order / skipped answers
- **Problem:** `submitAnswer.ts:104,169` — `lastQ` is positional and the only guard is
  duplicate detection, so a client can submit `qIx=0` then `qIx=2`, finish the round with
  2 answers, skip the Hard question, gain a `totalMs` tiebreak edge, and persist a recap
  that violates `RecapPlayerSchema.answers.length(3)`.
- **Fix (D1=a):** in the transaction, after the duplicate guard, add a strict-sequence
  guard:
  ```ts
  if (qIx !== me.answers.length) {
    throw new HttpsError("failed-precondition", "Answer questions in order", {
      reason: "out-of-order",            // new reason in common.ts enum
    });
  }
  ```
  This makes `lastQ` (`qIx === roundComposition.length - 1`) reachable only after 0,1,2
  are all recorded → recap is always 3 elements, and skipping is impossible. Keep the
  existing duplicate guard (defends replays).
- **Files:** `functions/src/match/submitAnswer.ts`, `packages/api_contract/src/common.ts`
  (add `out-of-order` to the error-reason enum), regenerate Dart enum if codegen.
- **Test:** new integration case in `functions/test/duel.integration.test.ts` —
  serve a round, submit `qIx=0`, then submit `qIx=2` → expect `failed-precondition`
  / `out-of-order`; assert the round is *not* marked done and no recap was written.
  This is the GDD §11 "kill-app-to-retry-a-hard-question" row (review §5, High).
- **Acceptance:** out-of-order submit rejected; in-order 0→1→2 still resolves; recap
  always has exactly 3 answers per player.

### 1.2 — H2 + M1 + M2: idempotent, transactional, cap-checked create path
- **Problem:**
  - H2 — `createDuel` / `acceptRematch` / `joinStrangerQueue` have no idempotency key;
    a double-tap creates a second real match.
  - M1 — `createDuel.ts:117-147` cap check is check-then-create (non-transactional);
    concurrent calls both pass.
  - M2 — `acceptRematch.ts:39-50` skips the §4.6 caps and the same-language re-check
    its sibling `createDuel` enforces.
- **Fix (D2=a):** introduce one reusable idempotency helper and route all create-side
  mutations through a single transaction that does check-idempotency → cap query →
  build → write match + both matchList projections → store idempotency record. Putting
  the cap query *inside* the transaction closes M1; reusing it in `acceptRematch` closes
  M2; the idempotency record closes H2.
  1. **New `functions/src/lib/idempotency.ts`** — extract the pattern currently inline in
     `submitAnswer.ts:106,112-115,325`:
     ```ts
     export const idempRef = (db, uid, key) => db.doc(`idempotency/${uid}_${key}`);
     // read inside a txn → cached result or null
     export async function readIdempotent(tx, ref) {
       const s = await tx.get(ref);
       return s.exists ? s.data()!["result"] : null;
     }
     export function writeIdempotent(tx, ref, result, now) {
       tx.set(ref, { result, createdAt: now, expiresAt: /* see WS5.4 */ });
     }
     ```
     Refactor `submitAnswer` to use it too (no behaviour change — keeps one source of truth).
  2. **Contracts:** add `idempotencyKey: z.string().uuid()` to
     `CreateDuelRequestSchema`, `AcceptRematchRequestSchema`, `JoinStrangerQueueRequestSchema`
     (`packages/api_contract/src/duel.ts:12-18,26-29`, `stranger.ts:12-14`). Keep `.strict()`.
  3. **`createDuel.ts`:** replace the `persistNewMatch` batch with a `db.runTransaction`
     that: reads idempotency (return cached `{matchId}` on replay); runs the active-cap +
     per-opponent-cap query (M1) and the same-language check; builds via `buildDuelMatch`;
     `tx.set` match + both matchList docs; `writeIdempotent`. Generate `matchId` before the
     txn so the cached result is stable on replay.
  4. **`acceptRematch.ts`:** wrap in the same transaction; **add** the §4.6 cap query and
     a same-language re-check against the *current* profiles (M2) before persisting; store
     idempotency keyed on the new match.
  5. **`strangerQueue.ts`:** add idempotency guard on join (lowest urgency — `set()` is
     naturally idempotent and the feature is flag-gated, but make it uniform).
  6. **Client:** pass `idempotencyKey: genUuid()` from
     `FirebaseMatchApi.createDuel` / `acceptRematch` (and the stranger join) in
     `match_controller.dart:74-79` — mirror the existing `submitAnswer` pattern at line 118.
- **Files:** new `functions/src/lib/idempotency.ts`; `createDuel.ts`, `acceptRematch.ts`,
  `strangerQueue.ts`, `submitAnswer.ts`; `packages/api_contract/src/{duel,stranger}.ts`;
  `app/lib/screens/match/match_controller.dart`.
- **Tests:**
  - Retry-storm: N concurrent same-key `createDuel` → exactly one match created
    (review §5 nit — promote to a real test here).
  - Cap race: concurrent creates at the cap boundary → cap holds (M1).
  - `acceptRematch` at the active cap → rejected (M2); language-changed rematch → rejected.
- **Acceptance:** guardrail 5 scorecard flips to ✅; double-tap create is a no-op replay;
  caps hold under concurrency.

### 1.3 — Test trio (review §5, defends guardrails 3 & 7)
Ship with WS1 since the harness can already backdate `servedAt` via admin:
1. **Skip-the-hard-question** — covered by 1.1's test.
2. **Stale `roundIx`** — submit with a `roundIx` that isn't the current round → expect
   `match` / not-found, no state change.
3. **E2e submit-after-timeout** — backdate `servedAt` past `timeLimitMs + grace`, submit a
   *correct* `answerIx` → expect `points: 0`, `correct: false`, `timedOut` path through the
   real `submitAnswer` (not just the pure scorer in `scoring.test.ts:66-87`).

---

## WS2 — Client correctness (ship WITH Phase 6 UI work)

### 2.1 — H7: stop discarding the server's authoritative result
- **Problem:** `match_controller.dart:121-126` keeps only a thin `AnswerOutcome`
  (`correctIx`, `points`, `roundDone`) and drops `replay`, `roundResult`, `matchResult`
  that the server already returns (`submitAnswer.ts:193-196,243-247,285`). The client then
  re-derives outcomes from local heuristics (`points>0` in `round_screen.dart`).
- **Fix:** extend `AnswerOutcome` to carry `replay: bool`, `roundResult: RoundResult?`,
  `matchResult: MatchResult?` (parse from the response map); add Dart model classes mirroring
  `RoundResultSchema` / `MatchResultSchema` (or generate from the contract). Have
  `RoundScreen` branch on `replay` (re-enter `startRound`) and render results from the server
  projection. Delete the `points>0` heuristic.
- **Files:** `match_controller.dart`, `question_screen.dart` (`AnswerOutcome`),
  `round_screen.dart`, new result model(s) under `app/lib/models/`.
- **Test:** widget test with a fake `MatchApi` returning a `matchResult` → result screen
  renders from the projection, not from `points`.

### 2.2 — H6: real points split on the fly-up (D5=a)
- **Problem:** `question_screen.dart:171-176` fabricates `base = points ~/ 2; bonus = rest`.
  The server computes the true `basePoints` (`submitAnswer.ts:94`) but doesn't return it.
- **Fix:** add `basePoints` (and `speedBonus`) to the `v1_submitAnswer` response (extend the
  `res` object at `submitAnswer.ts:188-195` and the response contract). Display the real
  split. `points = basePoints + speedBonus` stays the invariant.
- **Files:** `submitAnswer.ts`, response schema in `packages/api_contract/src/duel.ts`,
  `question_screen.dart`, `match_controller.dart`.
- **Test:** server unit asserts `basePoints + speedBonus === points`; widget test asserts the
  fly-up text uses returned values.

### 2.3 — H5: localize the question screen
- **Problem:** `question_screen.dart:260-271` hardcodes `'קל'/'בינוני'/'קשה'` and
  `'שאלה N/M'`; EN locale shows Hebrew. l10n infra already exists (`app/lib/l10n/*.arb`,
  generated localizations; `RoundResultScreen` already uses keys).
- **Fix:** use existing `l.difficultyEasy/Medium/Hard`; add a `questionProgress(number,total)`
  placeholder key to `app_en.arb` + `app_he.arb`; regenerate.
- **Files:** `app/lib/l10n/app_en.arb`, `app_he.arb`, `question_screen.dart`.
- **Test:** widget test pumped with EN locale asserts no Hebrew in the header.

### 2.4 — M6: screen-reader semantics
- **Problem:** `answer_button.dart:30-34` uses a bare `GestureDetector` → no button role,
  state changes unlabeled (doc 04 §8).
- **Fix:** wrap answer buttons in `Semantics(button: true, label: …, selected: …)`; label
  state on the wheel and points fly-up.
- **Files:** `answer_button.dart`, `wheel_spin.dart`, `question_screen.dart`.
- **Test:** widget test asserts `SemanticsFlag.isButton` on answer tiles.

---

## WS3 — Docs reconciliation (one batched pass; cheap)

Resolve the §6 drift log + the ERD findings in a single docs PR. No code (except where a
decision above says "fix code").

| Item | Action |
|---|---|
| DD1 | docs/15 Progress Tracker: add the Phase 6a block + date; record the 6a/6b split. |
| H3 / DD2 | docs/08 §2: add `matches.scoreTotals` (per-player won-round score sum), marked immutable-to-clients (GDD §7). |
| M3 / DD3 | docs/08 §2: enumerate the real `servingsPrivate` fields (`roundServing.ts:65-77`), note rules deny all client access. |
| M4 / DD4 | docs/08: reconcile `users/{uid}/servings` — code uses callable-response delivery + a single top-level `servingsPrivate`. Fix path/parent/visibility in the ERD. |
| H4 / M8 / DD5 | docs/08 §3: record D3 decision — selection runs in-memory on auto single-field indexes at MVP; composite index + `rand` technique scheduled for Phase 10. |
| DD6 | doc 07 §2.2: fix stranger-queue response shapes to match code (`{queued}` / `{queued,matchId}` / `{left}`). |
| D4 / DD7 | doc 06 §3: change forfeit cadence to 15 min + note cost delta. |
| DD9 | docs/08: reconcile idempotency store path (`idempotency/` vs `counters/`) and document the 24h TTL (see WS5.4). |
| DD10 | doc 07: mark `question-expired` reason as reserved (timeouts score 0, never reject). |
| DD11 | docs/08: fix the serving example to show the fixed-4 answers list (contract `serving.ts:18`). |

---

## WS4 — Cleanup (anytime, low risk)

- Delete dead `app/lib/main.dart:1-123` (superseded by flavored mains).
- Pin `intl` in `app/pubspec.yaml` (currently `any`).
- Fix `question_screen.dart:90` reading `serving['category']` (never present on the strict
  Serving payload → accent color always defaults). Pass the round's category in explicitly;
  fix the synthetic test fixture that masked it.
- `setup-path.ps1:11,37`: bump JDK 17 → 21 (DD8) to match docs/15 Phase 3.
- M5 (D3=b): add `.where('quarantined','==',false)` in `questionBank.ts:63-68` now.
- Nit: clamp timed-out `elapsedMs` into `[0, timeLimitMs+grace]` before storing to `totalMs`
  (`submitAnswer.ts:176-178`).

---

## WS5 — Tracked for pre-beta / Phase 10 (do NOT silently drop — gate items)

These are intentionally deferred but must be on a tracked list so the doc 09 §6 beta gate
isn't missed.

1. **App Check** enforcement on callables + Firestore (doc 09 §6, Phase 12 gate).
2. **Per-uid rate limiting** (doc 07 §1: writes 60/min) — source limits from Remote Config;
   pairs with App Check as the scripted-abuse defense.
3. **Implausible-speed `suspicionScore`** (doc 09 §2) — `elapsedMs` already captured; MVP
   action is manual review, so record as deferred.
4. **Idempotency TTL** — add `expiresAt` (`createdAt + 24h`) when writing records (WS1.2
   helper) + a Firestore TTL policy so the collection doesn't grow unbounded (doc 07 §1).
5. **Question-selection indexes + `rand` technique** (H4/M8) — build with the Phase-10 bank.
6. **Flutter golden-path E2E** (M7) — `integration_test/` Full-duel + Forfeit paths against
   the emulator once the Phase-6 UI is stable.
7. **`createDuel` opponent-side active cap** — currently only the challenger is checked; a
   popular user can be pushed past 20 active by being challenged. Add when the social graph
   lands (Phase 8) with friendship/block validation.
8. Remaining §5 test gaps (Friday-23:59 weekly boundary across a reset; `submitAnswer`'s own
   `not-your-turn`/`match-finished` guards; shuffle-distribution strengthening).

---

## Sequencing & exit criteria

| Order | Workstream | Gate |
|---|---|---|
| 1 | **WS1** (H1, H2, M1, M2, test trio) | Guardrails 5 & 7 scorecard → ✅; no duplicate matches under retry; skip-question rejected. **Blocks further feature work.** |
| 2 | **WS3** docs pass | docs/06/07/08/15 match code; drift log closed. |
| 3 | **WS2** (H5–H7, M6) | Lands within Phase 6b UI; client renders server truth, EN locale clean, a11y on answer buttons. |
| 4 | **WS4** cleanup | Dead code gone, deps pinned, `quarantined` filter live. |
| 5 | **WS5** tracking | Items filed against Phase 10 / Phase 12 gates in docs/15. |

**Top three to clear before building on this codebase (review §1):** WS1.1 (H1 integrity
bug), WS1.2 (H2 + M1 + M2 idempotency/caps), WS1.3 (the three tests).
