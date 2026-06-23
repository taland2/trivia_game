# 08 — Data Model & Database Design (Firestore)

> Status: **Draft v1** · Depends on: [06-system-architecture.md](06-system-architecture.md), [07-api-spec.md](07-api-spec.md)
> Modeling principles: (1) shape data for the screens that read it (projection docs over
> joins), (2) integrity-sensitive fields are function-written only, (3) nothing readable by
> a client may leak unanswered correct answers (doc 06 §5).

---

## 1. Collection Map

```
users/{uid}
  matchList/{matchId}            ← home-screen card projection
  servings/{servingId}           ← per-player served questions (private)
  notifPrefs (doc)
usernames/{username}             ← uniqueness registry
friendships/{pairId}             ← pairId = sorted "uidA_uidB"
friendRequests/{id}
invites/{code}
matches/{matchId}
  rounds/{roundIx}               ← function-only live round state (clients denied)
  recaps/{roundIx}               ← participant-readable reveal projection (written when both done)
questions/{questionId}           ← bank (NO client access)
dailySets/{dayId}                ← curated daily (NO client access pre-publish)
daily/{dayId}/friendScores/{uid} ← post-play visible projection
dailyPlays/{uid_dayId}
weekly/{weekId}/scores/{uid}     ← raw weekly points (function-written)
weekly/{weekId}/boards/{uid}     ← my-friends-ranked projection
strangerQueue/{uid}              ← {language, level, categoryMode, enqueuedAt} (TTL 7d; flag-gated)
counters/{uid} (shard docs)      ← rate limits, idempotency keys (TTL)
flags/{flagId}                   ← question reports
config/* (via Remote Config, not Firestore)
```

---

## 2. Core Entities

### `users/{uid}`
```jsonc
{
  "displayName": "Dana",        // client-writable
  "username": "dana_k",         // function-written via claim
  "avatarId": 7,                // client-writable (enum 1..24)
  "language": "he",
  "isGuest": false,
  "xp": 4350, "level": 12,      // function-written (GDD §8)
  "levelFloorXp": 4099, "levelCeilXp": 4561,  // function-written: current level's XP
                                              // bounds, so the client draws the level
                                              // bar WITHOUT the ⚖️ curve (guardrail #4)
  "streak": {"count": 6, "lastDayId": "2026-06-12"},   // function-written
  "stats": {"matches": 88, "wins": 47, "dailyPlayed": 60,
            "perCategory": {"sports": {"answered": 210, "correct": 144}, ...}},
  "searchable": true, "createdAt": ..., "lastActiveAt": ...,
  "fcmTokens": ["..."],         // client-writable subfield
  "blocked": ["uid", ...]       // function-written
}
```

### `matches/{matchId}`
```jsonc
{
  "mode": "async_duel",                  // future: live_1v1, live_room, tournament_duel
  "categoryMode": "spin",                // pick | spin | auto  (GDD §4.3)
  "players": ["uidA", "uidB"],           // immutable
  "state": "active",                     // pending|active|finished|forfeited|cancelled
  "roundWins": {"uidA": 2, "uidB": 1},
  "scoreTotals": {"uidA": 824, "uidB": 391},  // per-player sum of WINNING-round
                                              // scores (GDD §7 weekly "match score");
                                              // function-written, immutable to clients
  "currentRound": 3,
  "turnUid": "uidB",
  "turnDeadline": <ts>,                  // 36h forfeit sweep target (GDD §4.4)
  "language": "he",                      // match language (GDD §4.7) — locked at creation
  "isStrangerMatch": false,              // GDD §4.8 — excluded from friends-board fan-out
  "usedCategories": ["sports","music"],  // for auto mode no-repeat
  "result": null | {"winner":"uidA","reason":"rounds|tiebreak|forfeit|opponent_deleted",
                     "finalScore": {...}, "weeklyPointsAwarded": {...}},
  "tournamentId": null,                  // v1.1
  "createdAt": ..., "finishedAt": ...
}
```

### `matches/{matchId}/rounds/{roundIx}` — **function-only** (clients denied)
```jsonc
{
  "category": "science",
  "questionIds": ["q1","q2","q3"],       // refs only — bank is unreadable to clients
  "difficulties": ["easy","medium","hard"],
  "starterUid": "uidA",                  // players[roundIx % 2] (GDD §4.2 alternation)
  "perPlayer": {
    "uidA": {"done": true, "score": 412, "totalMs": 16780,
              "answers": [{"qIx":0,"answerIx":2,"correct":true,"points":141,"ms":4210}, ...]},
    "uidB": {"done": false, "score": 0, "totalMs": 0, "answers": []}
  },
  "winner": null | "uidA" | "shared",
  "isTiebreaker": false
}
```

### `matches/{matchId}/recaps/{roundIx}` — **participant-readable reveal projection**
```jsonc
{
  "roundIx": 2, "category": "science", "winner": "uidA" | "shared",
  "players": [{"uid":"uidA","score":412,"totalMs":16780,
               "answers":[{"qIx":0,"difficulty":"easy","correct":true,"points":141,"ms":4210}, ...]},
              {"uid":"uidB", ...}],
  "revealedAt": <ts>
}
```
**Reveal rule enforcement (Phase 3 — corrects the original single-doc plan):**
Firestore rules **cannot hide individual fields**, so the live round doc — which holds
both players' in-progress `answers[]` and the question refs — is **function-only** (rules
deny all client access). The resolving function writes a separate `recaps/{roundIx}` doc
**only once both players are `done`**; rules expose that recap to participants. This is the
doc's "separate doc wherever a hidden field is tempting" principle (above) applied to the
opponent's answers. (The earlier draft proposed a `revealReady` map + a `recap` field on the
round doc; that was unenforceable in rules and is superseded by this split.)

### `matches/{matchId}/emotes/{emoteId}` — **participant-readable banter (GDD §10.2)**
```jsonc
{
  "senderUid": "uidA",
  "emote": "fire",        // one of the predefined emote KEYS (⚖️ balance `emotes.set`);
                          // the client maps each key to an emoji + localized label
  "sentAt": <ts>
}
```
Function-written only (via `v1_sendEmote`, Phase 6b): the callable validates the key
against the allowed set and enforces the per-sender per-match cap (⚖️ `emotes.perMatch`,
default 3). No free text ever reaches storage (guardrail #1; doc 09 safety surface). Rules
expose the subcollection to the two participants for read; client writes are denied.

### `users/{uid}/servings/{servingId}`
```jsonc
{
  "context": {"type":"duel","matchId":"m1","roundIx":2,"qIx":0} | {"type":"daily","dayId":"2026-06-12"},
  "questionId": "q1",                    // for function use; rules hide this field? → NO:
                                          // field-level hiding isn't possible in rules; therefore
                                          // questionId lives in a parallel private doc:
  "text": "...", "answers": ["..",".."], // shuffled, no correct index
  "difficulty": "easy", "timeLimitMs": 10000,
  "servedAt": <ts>, "answeredAt": null, "expiresAt": <ts>
}
```
> ⚠️ Design note: Firestore rules can't hide single fields. Anything the client must not
> see lives in a **separate doc**, function-readable only. This split is mandatory wherever
> a "hidden field" is tempting.
>
> **Implementation reality (Phase 3+):** duel servings are delivered in the callable
> response, not via `users/{uid}/servings`; the only persisted serving doc is a single
> top-level `servingsPrivate/{servingId}` (rules deny all client access). Its real fields:
> `{correctIx, questionId, servedAt, answeredAt, uid, matchId, roundIx, qIx, difficulty,
> timeLimitMs, serving}` — where `serving` is the exact public payload (so an idempotent
> `startRound` replay returns the identical shuffle without resetting the scoring clock).
> `servingId` = `${matchId}_${roundIx}_${qIx}_${uid}` (+`_r{n}` for a GDD §4.5 tie replay).

### `idempotency/{uid}_{key}` — **function-only mutating-callable guard (doc 07 §1)**
Every mutating callable (`v1_createDuel`, `v1_acceptRematch`, `v1_submitAnswer`,
`v1_sendEmote`, `v1_joinStrangerQueue`) stores its result here under the caller's UUID key;
a replay (retry / double-tap) returns the stored result instead of mutating again. Shape:
`{result, createdAt}`. A 24h `expiresAt` + Firestore TTL policy is tracked for pre-beta
(WS5) so the collection stays bounded.

### `questions/{questionId}` — schema per doc 03 §6 (bank; no client access).
Operational additions: `servedCount`, `correctCount`, `medianMs`, `lastServedAt`,
`difficultyObserved`, `quarantined: bool`.

### Weekly leaderboard
- `weekly/{weekId}/scores/{uid}`: `{points, breakdown:{duels, dailies, forfeitsWon}}` —
  transactional increments by match/daily resolution functions.
- `weekly/{weekId}/boards/{uid}`: projection `{rows:[{uid, name, avatarId, level, points, rank}], updatedAt}`
  rebuilt for affected friends on each award (fan-out write, bounded by friend count) —
  this keeps the leaderboard screen to **one** listened doc per user (doc 06 §10).
- `weekId` format `2026-W24` (ISO week, Asia/Jerusalem boundary).

### Daily
- `dailySets/{dayId}`: `{questionIds[10], publishAt}` (curated queue, doc 03 §2).
- `dailyPlays/{uid_dayId}`: `{score, correctCount, totalMs, finishedAt, streakAfter}`.
- `daily/{dayId}/friendScores/{uid}`: projection mirroring `dailyPlays` public subset.

### Social
- `friendships/{uidA_uidB}` (sorted ids): `{uids:[a,b], since, source: invite|search|qr}`.
- `invites/{code}`: `{issuerUid, createdAt, redemptions:[{uid, at}], maxRedemptions: ⚖️ 50}`
  — multi-use so one WhatsApp-group link onboards the whole group.
- `friendRequests/{id}`: `{from, to, state}`.

---

## 3. Index Plan (initial)

| Query | Index |
|---|---|
| My active matches by recency | `matchList`: orderBy `lastEventAt` desc (single-field) |
| Forfeit sweep | `matches`: composite `state==active` + `turnDeadline <= now` |
| Serving exclusion (recently seen) | per-player `servings`: composite `context.type` + `servedAt` |
| Question selection | `questions`: composite `language+category+difficulty+quarantined` (+ random via `rand` field technique) |
| Username prefix search | `usernames` docId range scan (`>= q`, `< q+`) |
| Recalibration job | `questions`: `servedCount >= 200` + `recalibratedAt < threshold` |

Random question pick: each question carries `rand: float`; selection = range query from a
random pivot with wraparound, then in-memory exclusion filter (standard Firestore pattern).

---

## 4. Retention & Lifecycle

| Data | Policy |
|---|---|
| Finished matches | Full detail ⚖️ 90 days → compacted to result summary in `matchList`; summaries kept indefinitely |
| Servings | TTL ⚖️ 30 days after answer (Firestore TTL policy) |
| Idempotency keys / rate counters | TTL 24h–7d |
| Weekly boards | Last ⚖️ 26 weeks per user (profile history), then deleted |
| Guest accounts | Purged after 90 days idle (doc 05 §1) |
| Deleted accounts | Doc 09 flow: PII wiped ≤ 30 days; matches anonymized (`"Deleted player"`), aggregates kept |
| Question bank | Never deleted, only `retired` (stats are an asset) |

---

## 5. Migration Strategy

- Every document carries `schemaVersion: int`. Functions read-tolerate N-1 and write N.
- Migrations = idempotent batch scripts in `content-tools/migrations/`, run per environment
  (dev → staging → prod), each with a dry-run mode and a count report.
- Firestore has no schema enforcement: the zod schemas in `packages/api_contract`
  (doc 07 §6) are the single source of shape truth, used by functions on every write.
