# 12 — Test Plan & QA Strategy

> Status: **Draft v1** · Depends on: [02-game-design-document.md](02-game-design-document.md), [07-api-spec.md](07-api-spec.md), [09-security-privacy.md](09-security-privacy.md)
> Reality check: solo operator ⇒ automation is the QA team. Manual testing is reserved
> for feel/juice and device quirks; everything rule-shaped is encoded in tests.

---

## 1. Test Pyramid

| Layer | Tooling | What lives here |
|---|---|---|
| Unit — functions | Vitest/Jest (TS) | **Scoring formula, round/match resolution, tiebreakers, weekly points, XP, recalibration math** — the GDD as executable spec. Every ⚖️ value read from config fixtures |
| Unit — app | flutter_test | Domain layer (match state machine, timers, streak logic), widget tests for question screen states |
| Integration | Firebase Emulator Suite | Callables end-to-end: auth + rules + transactions + idempotency + error codes (every `details.reason` in doc 07 §1 has a test that triggers it) |
| Security rules | emulator rules tests | Allow/deny matrix: every collection × {owner, friend, stranger, unauthenticated, participant, non-participant} (doc 09 §1) |
| E2E | Flutter integration_test against emulators | The golden paths (§2) on CI; on-device before each gate |
| Load | scripted emulator/staging harness | §4 |

CI policy (doc 13): unit + integration + rules on every PR; E2E nightly + per release.

## 2. Golden-Path E2E Suites

1. **FTUE:** install → taste round → guest home → register → merge keeps XP.
2. **Full duel:** create (each of 3 category modes) → alternate turns across 2 simulated
   players → resolution → weekly points + XP visible → rematch.
3. **Daily:** play → score → friends board visible only post-play → streak increments;
   next-day rollover (clock-injected).
4. **Social:** invite link redeem → friendship + auto-duel; username search; QR payload; block cancels match.
5. **Forfeit:** idle turn → reminder state → sweep job forfeits → points awarded per GDD §7.

## 3. Multiplayer & Edge-Case Matrix (the GDD §11 table, executable)

Each row from GDD §11 gets at least one automated test. Additional adversarial cases:
- Double-submit same answer (idempotency) · submit after timeout · submit for opponent's
  turn · submit with stale roundIx · answer a quarantined question's pending serving
- Both players finish a round within the same second (transaction contention)
- Round tie → time tiebreak → shared-round → extra round path; 2–2 sudden death; the
  theoretical double-tie re-deal
- Guest merge while a duel is active (uid swap mid-match)
- Forfeit sweep racing an in-flight `submitAnswer`
- Friday-23:59 weekly boundary: match resolving across reset (points land in correct week)
- Hebrew bidi: HE question with EN answer strings renders correctly (golden-image widget tests)
- Network chaos on `submitAnswer`: retry storms produce exactly-once scoring (emulator
  fault injection)

## 4. Load & Cost Tests (staging, before Gate D)

- Simulate ⚖️ 200 concurrent duel-turns (≈ beta peak ×10): p95 submitAnswer ≤ 300ms,
  no transaction-retry exhaustion, no hot-document contention on weekly score docs.
- Listener fan-out: 50 users on home screen → Firestore read counts match the doc 06 §10
  budget (cost regression test — read counts asserted, not just latency).
- Forfeit sweep with 10k stale matches completes within job timeout.

## 5. Device & Platform Matrix (manual, per gate)

| Tier | Devices |
|---|---|
| Primary | 1 mid-range Android (e.g., Samsung A-series), 1 recent iPhone, both HE+EN |
| Secondary | 1 Android at the API floor (Android 10 / API 29 — doc 06 §1), 1 iPhone SE-class (small screen, iOS 16), 1 tablet sanity pass |
| Checks | Notifications (incl. quiet hours), deep-link install path (the flakiest feature — doc 11 §4), font scaling 130%, reduced motion, RTL audit, silent-mode sound behavior |

## 6. Content QA (doc 03 pipeline is itself a QA system)

- Review checklist (doc 03 §3) is the acceptance test per question.
- Automated lint on the bank: duplicate detection (fuzzy text match), length limits,
  exactly-4-answers, missing `concept_id` pairs, `valid_until` expiry sweep.
- Daily-set preflight: the publish job validates 14-day queue depth and refuses to publish
  a set containing quarantined questions.

## 7. Beta Test Management (Gate D)

- Channels: TestFlight + Play internal track, staging environment.
- In-app feedback: shake-to-report (screenshot + logs consent) → issues triaged weekly.
- Structured prompts to beta users at week 1 and week 3 (what's confusing / what's missing /
  would you invite a friend — NPS-lite).
- Exit metrics instrumented per doc 11 Gate D (D7, F2, crash-free, p95, forfeit rate).

## 8. Release Regression Checklist (every store release)

Golden E2E green · rules matrix green · analytics F1/F2 events fire (doc 10 §5) ·
notification types deliver on both platforms · invite install-path on both platforms ·
forced-update gate honors `min_supported_build` · rollback plan noted (doc 13).
