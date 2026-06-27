# 07 — API Specification

> Status: **Draft v1** · Depends on: [06-system-architecture.md](06-system-architecture.md)
> Contract between the Flutter client and Firebase. Two surfaces: **callable functions**
> (all integrity-sensitive operations) and **Firestore reads/listeners** (shapes in doc 08,
> access rules in doc 09). Scope: MVP; v1.0/v1.1 sections stubbed at the end.

---

## 1. Conventions

- All callables: Firebase callable functions (`https.onCall`), auth required (anonymous or
  registered), region `me-west1` (Tel Aviv) primary. ⚖️
- Requests/responses are JSON; all timestamps are server-side `Timestamp`s; client never
  sends times for scoring.
- **Idempotency:** every mutating call takes `idempotencyKey` (client UUID v4). Replays
  return the original result, never double-apply. Keys retained ⚖️ 24h.
- **Errors:** standard `functions.https.HttpsError` codes + machine-readable `details.reason`:

| `code` | `details.reason` examples |
|---|---|
| `unauthenticated` | — |
| `failed-precondition` | `not-your-turn`, `match-finished`, `already-answered`, `out-of-order`, `language-mismatch`, `day-out-of-window`, `daily-already-played` (`question-expired` is **reserved** — a late answer scores 0, it is never rejected) |
| `not-found` | `match`, `user`, `invite-code` |
| `resource-exhausted` | `max-active-duels`, `max-duels-with-friend`, `emote-rate-limit` |
| `permission-denied` | `not-participant`, `blocked` |
| `invalid-argument` | validation failures (field named in `details.field`) |

- **Versioning:** callables namespaced `v1_*`. Breaking change ⇒ new `v2_*` alongside,
  old kept ≥ 2 release cycles. Client min-version gate via Remote Config
  (`min_supported_build`) with a forced-update screen.
- **Rate limits** (enforced in functions, per uid): ⚖️ writes 60/min global;
  `sendEmote` 3/match; `searchUsername` 20/min; invite issuance 30/day.

---

## 2. Callable Functions (MVP)

### 2.1 Account & Social

| Function | Request | Response | Notes |
|---|---|---|---|
| `v1_completeOnboarding` | `{language, displayName?, avatarId?}` | `{profile}` | Finalizes the auto-created guest profile |
| `v1_claimUsername` | `{username}` | `{ok}` | Lowercase, 3–20 chars `[a-z0-9_]`, uniqueness transactional |
| `v1_mergeGuestAccount` | (called post sign-in w/ `previousUid` token) | `{profile}` | Moves XP, matches, friendships to registered uid; guest uid tombstoned |
| `v1_issueInviteCode` | `{}` | `{code, link}` | Code 8 chars; link `https://<domain>/i/<code>` |
| `v1_redeemInviteCode` | `{code}` | `{friend, autoMatchId?}` | Creates friendship + auto-duel vs. inviter (doc 05 §5); rejects self/blocked/existing |
| `v1_sendFriendRequest` / `v1_respondFriendRequest` | `{toUid}` / `{requestId, accept}` | `{ok}` | |
| `v1_unfriend` / `v1_block` / `v1_unblock` | `{uid}` | `{ok}` | Block cancels active matches (GDD §11) |
| `v1_searchUsername` | `{query}` | `{results[] (≤10)}` | Prefix search; respects search-opt-out |
| `v1_updateNotificationPrefs` | `{prefs}` | `{ok}` | Mirror of doc 05 §3 toggles + daily time |
| `v1_deleteAccount` | `{confirmPhrase}` | `{ok}` | Doc 09 deletion flow; opponents get forfeit wins |

> **Phase 8a status (2026-06-27):** implemented (emulator) with these shape refinements —
> every mutating call carries `idempotencyKey`; `v1_claimUsername` → `{ok, username}`;
> `v1_redeemInviteCode` → `{friendUid, autoMatchId?}`; `v1_completeOnboarding` →
> `{displayName, avatarId, username}`; `v1_deleteAccount` `confirmPhrase` is the literal
> `"DELETE"` (minimal cascade now: opponent forfeit + tombstone; full PII wipe = Gate C).
> `sendFriendRequest` auto-accepts a reverse-pending request and denormalizes sender identity
> onto the request doc. New `details.reason` values: `username-taken` (`already-exists`),
> `username-profane` (`failed-precondition`), `not-friends` (`permission-denied`), `invite-self`
> (`failed-precondition`), `invite-exhausted` (`resource-exhausted`), `friend-request`
> (`not-found`). **Deferred to 8b (real project):** `v1_mergeGuestAccount`,
> `v1_updateNotificationPrefs`, and the invite deep-link delivery (§4 below).

### 2.2 Duel Lifecycle

| Function | Request | Response | Notes |
|---|---|---|---|
| `v1_createDuel` | `{opponentUid, categoryMode: 'pick'\|'spin'\|'auto'}` | `{matchId}` | Validates friendship, caps (GDD §4.6), same app language (GDD §4.7 → `failed-precondition/language-mismatch`) |
| `v1_joinStrangerQueue` / `v1_leaveStrangerQueue` | `{categoryMode, idempotencyKey}` / `{}` | `{queued: false}` \| `{queued: true}` \| `{queued: true, matchId}` / `{left}` | Gated by Remote Config `stranger_queue_enabled` (GDD §4.8); flag off ⇒ `{queued:false}`; pairing by language+level creates a standard match (returns its `matchId`) |
| `v1_acceptRematch` | `{matchId, idempotencyKey}` | `{newMatchId}` | Same mode, roles swapped; re-checks caps + same-language against current profiles (M2) |
| `v1_startRound` | `{matchId, categoryId?}` | `{roundIx, category, servings[3], spinResult?}` **or** pick-offer `{needsPick: true, roundIx, offered[3]}` | **pick** is two calls: first call on the player's pick-turn (no `categoryId`) returns a **locked** 3-category offer persisted on the round (no reroll); second call with a `categoryId` from that offer serves the round. **spin** → server picks, response includes `spinResult` for the wheel theater (outcome server-decided). **auto** → server picks, no `categoryId`. Picks alternate via `starterUid = players[roundIx % 2]` (GDD §4.3) |
| `v1_submitAnswer` | `{matchId, roundIx, qIx, answerIx \| null, idempotencyKey}` | `{correctIx, points, basePoints, speedBonus, roundDone?, replay?, roundResult?, matchResult?}` | `null` = explicit timeout report; server clock decides actual timing (§4 of doc 06). `points = basePoints + speedBonus` (H6, all 0 on a miss). `replay` (GDD §4.5 exact tie) supersedes `roundResult`. Must be submitted **in order** (`out-of-order` otherwise, H1) |
| `v1_sendEmote` | `{matchId, emote, idempotencyKey}` | `{sent, remaining}` | `emote` validated against the ⚖️ allowed set; per-sender per-match cap (⚖️ `emotes.perMatch`, default 3) → `resource-exhausted/emote-rate-limit`; participants only |
| `v1_flagQuestion` | `{questionServingId, reason}` | `{ok}` | Reasons enum (doc 03 §7); only after answering |

**Serving payload** (`servings[]` item — note: no correct-answer information):
```json
{
  "servingId": "sv_...",
  "qIx": 0,
  "difficulty": "easy",
  "timeLimitMs": 10000,
  "text": "Which planet has the most moons?",
  "answers": ["Jupiter", "Saturn", "Mars", "Neptune"]
}
```
Timing starts server-side at serving write; client renders then starts the visual timer
(doc 04 §4). Grace for network delivery: ⚖️ +1.5s added server-side to each limit.

### 2.3 Daily Challenge

| Function | Request | Response |
|---|---|---|
| `v1_startDaily` | `{dayId}` (user-local calendar date, GDD §5) | `{dailyId, servings[10]}` — `failed-precondition/daily-already-played` if done; `invalid-argument/day-out-of-window` if `dayId` deviates > ±14h from server time |
| `v1_submitDailyAnswer` | same shape as `v1_submitAnswer` | same shape; 10th answer returns `{dailyResult, streak}` |

### 2.4 Read Models (Firestore listeners — no functions needed)

Clients listen to (shapes in doc 08, rules in doc 09):
- `users/{uid}` own profile; `users/{uid}/matchList/{matchId}` home-screen match cards
- `matches/{id}` participant-visible match state + recap projections
- `weekly/{weekId}/boards/{uid}` my weekly friends board (function-maintained projection)
- `daily/{dayId}/friendScores/{uid}` friends-today board (visible only after own play —
  enforced by a `playedAt` precondition in rules)

---

## 3. Push Payloads (FCM)

All data-messages carry `{type, deepLink}`; notification copy is server-rendered, localized.
`deepLink` routes: `match/{id}`, `daily`, `leaderboard`, `friends/requests`, `profile`.
Types = N1…N10 from doc 05 §3 (`turn`, `turn_reminder`, `forfeit_warning`, `match_result`,
`daily_reminder`, `streak_rescue`, `rank_drop`, `weekly_result`, `friend_request`,
`invite_joined`).

---

## 4. Invite Deep Link Service

- `GET https://<domain>/i/{code}` → installed: opens app via app link/universal link with
  the code → not installed: store redirect; code recovered post-install via Play Install
  Referrer (Android) / pasteboard token (iOS) → app calls `v1_redeemInviteCode`.
- Served by Firebase Hosting redirect + tiny function. No third-party link service (doc 06 §9).

---

## 5. v1.0 / v1.1 Surface (stub — full spec before each release)

- `live_*`: `createRoom`, `joinRoom (code)`, `setReady`, room state listener channel,
  `submitLiveAnswer`, host controls. Transport per doc 06 §6 gate outcome.
- `tournament_*`: `create`, `join`, bracket listener, deadline jobs.

---

## 6. Contract Testing

- Every callable has: TS unit tests (logic), emulator integration tests (auth + rules +
  idempotency + error paths), and a generated Dart client wrapper (single source of truth
  for shapes in `packages/api_contract` — codegen from TS zod schemas). Detail in doc 12.
