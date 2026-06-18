# 02 — Game Design Document (GDD)

> Status: **Draft v1** · Depends on: [01-product-vision.md](01-product-vision.md)
> This document defines every gameplay rule. If a rule isn't written here, it doesn't exist.
> All numeric values marked ⚖️ are initial balance values — expected to be tuned from live
> data (see doc 10, Analytics) and stored in remote config, not hardcoded.

---

## 1. Core Game Loop

```
Open app ──► Home: pending turns, daily challenge, weekly friends race
   │
   ├─► Play your turn in an active duel (2-3 min)
   ├─► Do today's Daily Challenge (2 min)
   ├─► Start a new duel / rematch a friend
   └─► Check the weekly friends leaderboard
   │
   ▼
Earn XP + weekly points ──► Notifications pull you back ("Your turn!", "Dana passed you!")
```

Minute-to-minute fun: **answer fast, beat your friend, talk trash about it.**
Day-to-day retention: **pending turns + daily challenge streak + weekly race.**

---

## 2. Game Modes Overview

| Mode | Release | Players | Sync | Session length |
|---|---|---|---|---|
| Async 1v1 Duel | MVP | 2 | Asynchronous | 2–3 min per turn |
| Async 1v1 vs. Stranger | built in MVP, **enabled at soft launch** (§4.8) | 2 | Asynchronous | 2–3 min per turn |
| Daily Challenge | MVP | 1 (vs. everyone) | Solo | ~2 min |
| Real-time 1v1 | v1.0 | 2 | Live | ~4 min |
| Real-time Group Room | v1.0 | 2–20 | Live | 5–10 min |
| Friend-group Tournament | v1.1 | 4/8/16 | Async (bracket) | multi-day event |

---

## 3. Questions — Universal Rules

### 3.1 Format (MVP)
- **Multiple choice, exactly 4 answers, exactly 1 correct.** This is the only MVP format.
- Question text limits: ⚖️ 120 chars (HE/EN); answers ⚖️ 40 chars each.
- Answer **display order is randomized per player per serving** (anti-memorization, anti-screenshot-sharing).
- Post-MVP formats (designed later, schema must allow them): True/False, image questions, type-the-answer.

### 3.2 Difficulty & Timers
Three difficulty tiers, each with its own timer:

| Difficulty | Time limit ⚖️ | Base points ⚖️ |
|---|---|---|
| Easy | 10 s | 100 |
| Medium | 15 s | 150 |
| Hard | 20 s | 200 |

- The timer starts only after question text + answers are fully rendered on the client,
  but **the server timestamps delivery and submission** — server time is authoritative (see doc 09).
- No answer before timeout ⇒ scored as wrong, 0 points.

### 3.3 Scoring Formula (correctness + speed)
```
points = base_points × (1 + 0.5 × time_remaining / time_limit)   if correct
points = 0                                                        if wrong or timeout
```
- Max bonus = +50% for an instant answer; bonus decays linearly to 0 at the buzzer. ⚖️
- All point math is computed **server-side only**; the client merely displays results.
- Rounding: final points rounded to nearest integer.

### 3.4 Categories (8 at launch)
1. General Knowledge · 2. Sports · 3. Movies & TV · 4. Music · 5. Science & Tech ·
6. History · 7. Geography · 8. Israel & Local Culture

- Every question belongs to exactly one category (sub-tags in metadata for future use).
- Both languages must cover all 8 categories (volume targets in doc 03).

---

## 4. Mode: Async 1v1 Duel (MVP core)

### 4.1 Match Structure — Best-of-5 Rounds
- A match = **up to 5 rounds**; first player to win **3 rounds** wins the match.
- A round = **both players answer the same 3 questions** in the same category, same order.
- Round question composition: 1 Easy + 1 Medium + 1 Hard (escalating). ⚖️
- Round winner = higher total round score. Round-tie rules in §4.5.
- Players play a full round (3 questions) per turn, then the turn passes.

### 4.2 Turn Flow
```
Challenger creates duel ──► picks category-selection mode (§4.3)
   ▼
Challenger plays Round 1 (3 questions) ──► opponent notified: "Your turn!"
   ▼
Opponent plays Round 1 (same questions) ──► round result revealed to both
   ▼
... rounds continue, category chosen per round per §4.3 ...
   ▼
First to 3 round wins ──► match result + XP + weekly points + [Rematch] button
```
- Each player sees the opponent's per-question results for a finished round
  (correct/wrong + time) — fuel for banter, and proof the scoring is fair.
- Questions for a round are locked when the first player starts it (both get identical questions).

### 4.3 Category Selection — Mode Chosen at Duel Start
**The challenger picks one of three category-selection modes when creating the duel**
(the invite shows the chosen mode; accepting the duel accepts the mode):

| Mode | Behavior |
|---|---|
| **Player Picks** | The player whose turn starts the round chooses from 3 randomly offered categories. Alternates between players each round |
| **Spinner** | An animated wheel lands on a random category (juicy animation, pure luck) |
| **Auto** | System picks a balanced spread — no category repeats until all 8 are used |

- In all modes, the same category applies to both players for that round.
- Default mode for quick-start/rematch: the mode of the previous match, else Spinner. ⚖️

### 4.4 Turn Timeout
- Turn reminder notification at **12h** of inactivity; final warning at **30h**. ⚖️
- **Auto-forfeit at 36h**: the inactive player loses the match; winner gets full match
  weekly points, forfeiter gets none. ⚖️
- Rationale for 36h (revised from 24h): clears a full Shabbat (~25h) and any work shift
  without unfair forfeits, while still fitting the weekly leaderboard rhythm.
- Forfeit is recorded distinctly from a played loss (shown as "expired" in history, and
  excluded from win-streak achievements later).

### 4.5 Tie Resolution — No Draws, Ever
- **Round tie** (equal round scores): round goes to the lower **total answer time** across
  the 3 questions. An exact points-and-time tie (astronomically rare) replays the round
  with fresh questions. Every round therefore has a winner — a 5-round match cannot tie.
- **Sudden-death tiebreaker** exists for formats without an odd round count (e.g., the
  tournament variants later): 1 Hard question, same for both; higher score wins, faster
  answer breaks a points tie, exact tie re-deals one more sudden-death question.

### 4.6 Concurrency Rules
- A player may have up to **20 active duels** simultaneously. ⚖️
- Max **3 active duels against the same friend** (prevents spam). ⚖️
- Rematch creates a new match with the same category-selection mode, roles swapped.

### 4.7 Language Rule — Same-Language Duels Only
- A duel can only be created between two players whose app language matches; both receive
  questions in that language. Mixed-language pairs see a clear explainer ("Roi plays in
  English — switch your language to duel him") rather than a silent block.
- Players can switch app language at any time (settings); active matches keep the language
  they started with.
- Rationale: avoids serving the same round from two language banks (content complexity,
  comparability) at the cost of splitting mixed friend groups — an accepted tradeoff;
  revisit if analytics show meaningful blocked-duel attempts (event in doc 10).

### 4.8 Stranger Duels (zero-friends path)
- Identical rules to friend duels (§4.1–4.7) with an opponent from an **async matchmaking
  queue** (same language, closest level). No realtime infrastructure — pairing happens
  whenever two queued players exist; until paired, the player is told honestly ("looking
  for a rival…") and is steered to the daily challenge meanwhile.
- **Built in MVP code, enabled by Remote Config only at soft launch (Gate E)** — a 20-user
  beta has no queue liquidity and a dead queue is worse than none. Pre-launch, zero-friend
  users see daily challenge + invite CTA.
- **A paired stranger match always uses Spinner category mode** (decided Phase 4b): the two
  queued players may have requested different modes, so the auto-created match ignores both
  and runs the neutral Spinner (the waiting player is the challenger / takes the first turn).
- Post-match: "Add as friend" request option (mutual accept as usual). Strangers never
  appear on the weekly friends leaderboard; stranger-duel results award XP and weekly
  points to each player's own board.
- Safety surface is minimal by design: no free text exists (emotes only), block works,
  report-user exists (doc 09 §3).

---

## 5. Mode: Daily Challenge (MVP)

- **One global quiz per day — the same 10 questions for every player worldwide**, in the
  player's language (HE/EN versions of the same daily set).
- Composition: ⚖️ 3 Easy + 4 Medium + 3 Hard, spread across categories; rotates so all 8
  categories appear over a week.
- **Resets at local midnight per user (Wordle model):** each daily set is assigned to a
  calendar date; a user unlocks that date's set at their own midnight. Friends in different
  timezones still compare the same dated quiz. Server accepts a client-claimed date within
  a ±14h sanity window (doc 07). Cross-timezone spoiler window accepted — mitigated by the
  no-question-content-in-shares rule below. ⚖️
- One attempt per day, no retries. Scoring identical to §3.3.
- Results screen: your score, friends' scores today (only after you've played — no
  spoilers/anchoring), share card ("I scored 2,340 today 🔥 beat me").
- **Streak**: consecutive days played (not won). Streak shown on profile and home screen.
  Streak-protection items deferred to the (future) economy — MVP streaks are hard-mode.
- Daily Challenge contributes weekly leaderboard points (§7) and XP (§8).
- Anti-spoiler: question text of today's daily is never shown in any share surface.

---

## 6. Modes: Real-time (v1.0)

### 6.1 Real-time 1v1
- Both players answer the **same questions simultaneously**; ⚖️ 7 questions, mixed
  categories, escalating difficulty. Higher total score wins; tie → sudden-death question.
- Between questions: 3s result interstitial showing both players' answer + time.
- Entry: challenge an online friend, or open challenge link. (Stranger matchmaking is
  out of scope until there's player liquidity.)

### 6.2 Real-time Group Room
- **2–20 players.** Host creates a room → gets a 6-character room code + QR + share link.
- Joining requires the code only — **guests can join a room without an account**
  (nickname-only session; prompted to register after the match to keep XP).
- Host controls: number of questions (⚖️ 5/10/15), categories (specific or mixed), start.
- All players answer simultaneously; per-question countdown; **podium reveal between
  questions** (Kahoot's drama moment) showing rank changes.
- Final podium: top 3 celebration + full ranking; host gets [Play again] with same settings.

### 6.3 Disconnection Handling (both real-time modes)
- **30-second reconnect grace window**: the match continues for everyone; questions missed
  while disconnected score 0; a reconnecting player rejoins at the current question. ⚖️
- 1v1: if the disconnected player never returns, they lose the match.
- Group room: a player absent at match end is ranked by points earned before dropping.
- If the **host** drops in a group room, the match continues (server-driven); host controls
  pass to the earliest-joined registered player.

---

## 7. Ranking — Weekly Friends Leaderboard (MVP)

- **Friends-only leaderboard, resets every Monday 00:00 Israel time.** ⚖️
- Weekly points earned: ⚖️

| Event | Weekly points |
|---|---|
| Duel match win | 100 + (match score / 100) |
| Duel match loss (played to the end) | match score / 100 |
| Opponent forfeit win | 100 flat |
| Daily challenge | daily score / 100 |
| Real-time modes (v1.0) | same formula as duels |

- **"Match score" = winning rounds only** (decided Phase 4b): a player's match score is the
  sum of their round scores **for the rounds they won**; rounds they lost contribute nothing.
  Tracked server-side as `MatchDoc.scoreTotals` (doc 08). So a 3–2 loser still earns points
  from their 2 won rounds, but a swept loser earns 0.
- Rationale: winning matters most, but heavy players who lose still climb — keeps weaker
  players engaged in the race.
- End of week: top-3 podium screen + notification ("You finished #2! Rita took the crown 👑").
  History of past weeks kept on profile.
- No global leaderboard in MVP (anti-cheat surface deferred — see doc 09). The design
  reserves space for opt-in global/city boards later.

---

## 8. Progression — XP & Player Level (MVP)

- **XP is permanent and only ever increases.** Sources: ⚖️ match completed +20, match won
  +30 bonus, daily challenge +25, each correct answer +2.
- **A forfeit win counts as a completed win for XP** (decided Phase 4b): the winner of an
  auto-forfeit (§4.4) earns the +20 completed **and** +30 win XP (plus the 100 flat weekly
  points); the forfeiter earns nothing. A win is a win.
- Level curve: ⚖️ `XP to reach level n = 100 × n^1.5` (rounded) — fast early levels,
  meaningful grind later.
- Level is displayed on profile, leaderboard rows, and match headers.
- Levels gate nothing in MVP (pure status). Future: cosmetic unlocks at level milestones.
- Achievements/badges: **post-MVP** (v1.x), but the data model reserves them (doc 08).

---

## 9. Mode: Friend-group Tournament (v1.1) — design committed now

- **Single-elimination bracket: 4, 8, or 16 players.**
- Creation: organizer picks size, round deadline (⚖️ 24h or 48h per round), category-selection
  mode (§4.3 applies per duel), invites friends via link/code. Bracket seeds randomly when full
  (or organizer starts early; empty slots become byes).
- Each pairing = one standard async duel (§4) with the tournament's deadline overriding §4.4.
- No-show resolution at deadline: player who completed more rounds advances; neither played →
  random advance (both notified bluntly — "you both slept 😴").
- Bracket screen is live-shared with all participants: results, who's stuck, countdowns.
  Champion gets a 👑 marker on the weekly leaderboard for the following week + bonus weekly
  points ⚖️ 300.
- Weekly scheduled app-wide tournaments and round-robin leagues: later (v1.2+), explicitly
  out of v1.1 scope.

---

## 10. Social Layer

### 10.1 Friend Connections (MVP)
- **Invite link / share code** — deep link via WhatsApp etc.; opens app or store, auto-links
  friendship after install (deferred deep link). The primary growth channel.
- **Username search** — unique handle (`@dana_k`), searchable opt-out in settings.
- **QR code** — profile shows a QR; scanning when together = instant friendship.
- ❌ No contacts sync in v1 (privacy weight; revisit later).
- Friendships are mutual (request → accept). Block/unfriend supported from day one.

### 10.2 Communication (MVP — deliberately minimal)
- **No free-text chat.** Instead: ⚖️ 8 predefined emotes/taunts sendable on match events
  ("😂", "🔥", "😈 revenge!", "🍀 lucky"). Localized, rate-limited (3 per match), mutable.
- Rationale: keeps the banter spirit with zero moderation burden (solo operator constraint
  from doc 01 §9).

### 10.3 Notifications (full strategy in doc 05)
Match-critical set for MVP: your-turn, match-result, turn-reminder (12h), forfeit-warning
(30h), weekly-race events (passed/final), daily-challenge reminder (user-set time),
friend-request.

---

## 11. Edge Cases & Integrity Rules (mode-agnostic)

| Case | Rule |
|---|---|
| App killed mid-question (async) | Question is scored as timed-out (0 pts). The round resumes at the next unanswered question. Prevents "kill app to retry a hard question" |
| Double answer submission | First server-received submission counts; duplicates idempotently ignored (doc 07) |
| Clock manipulation on device | Irrelevant — server-authoritative timing only |
| Question reported as wrong/broken | Player can flag a question post-answer; ⚖️ N flags auto-quarantines it from serving (doc 03 pipeline). Scores are not retroactively changed |
| Same question repeated to a player | Serving engine excludes questions a player answered in the last ⚖️ 90 days / last ⚖️ 500 served, per player |
| Opponent unfriended/blocked mid-match | Match is cancelled, no points awarded either side |
| Account deleted mid-match | Opponent gets a forfeit win |

---

## 12. Balance Levers (remote-config'd)

Everything marked ⚖️ above ships in remote config: timers, base points, speed-bonus
multiplier, round composition, timeout windows, weekly point formulas, XP values, level
curve, concurrency caps, emote set, repeat-exclusion window. Tuning process and the
metrics that drive it are defined in doc 10.

---

## 13. Out of Scope for this GDD version (parked, not rejected)

Power-ups & economy · achievements/badges · fool-your-friends mode · UGC packs (v1.2,
will get its own GDD chapter) · global leaderboards · leagues with promotion/relegation ·
seasons · spectating · voice/chat. *(Stranger matchmaking moved into scope — §4.8.)*
