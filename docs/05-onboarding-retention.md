# 05 — Onboarding & Retention Design

> Status: **Draft v1** · Depends on: [02-game-design-document.md](02-game-design-document.md), [04-ux-ui-spec.md](04-ux-ui-spec.md)
> North-star metric (vision §7): **D7 retention ≥ 20%**. Every mechanism in this document
> exists to serve D1 → D7 → friend-loop activation.

---

## 1. First-Time User Experience (FTUE)

**Policy: instant guest play → register to keep progress.** No sign-in wall.

```
Install → open
  1. Splash (≤1.5s) → language auto-detect (HE/EN) with switch option
  2. "Let's see what you've got" → 3-question taste round (Easy/Med/Med, mixed categories)
     — full scoring UI, speed bonus, celebration. The player FEELS the game.
  3. Score card → "Trivia is better with victims 😈" → invite sheet:
       [Share invite link]  [Scan friend's QR]  [@username search]  [Later]
  4. Land on Home. Guest account already exists (anonymous auth, auto-created at step 2).
```

- Time budget install→step 4: **under 90 seconds**, fun delivered by second 45.
- The taste round grants real XP (kept after registration).
- "Later" is always available — no dark patterns; the social ask repeats contextually (§4).

### Registration prompt (guest → account)
Triggered at high-motivation moments, never blocking play:
- After first duel completed · after first daily challenge · when adding a friend succeeds ·
  when XP would be "at risk" (app reinstall scenario messaging).
- Method: **Google / Apple sign-in** (one tap). Guest progress merges into the account.
- Hard requirement before: creating/joining a tournament (v1.1), appearing on a friend's
  leaderboard beyond 7 days as "Guest".
- Guest accounts idle > ⚖️ 90 days are purged (privacy doc 09).

---

## 2. Aha Moments (what we steer everyone toward)

| Moment | Target |
|---|---|
| A1: finished taste round, saw speed bonus | 100% of installs, minute 1 |
| A2: first duel vs. a real friend completed | ≥ 35% of new users in week 1 (friend-loop activation, vision §7) |
| A3: appeared on a weekly leaderboard with ≥2 friends | week 1–2 |
| A4: 3-day daily-challenge streak | week 1 |

Funnel instrumentation for each step is mandatory (doc 10).

---

## 3. Notification Strategy

Channels: push (FCM/APNs). All types individually mutable in settings. Default-on for
match-critical, opt-in prompt for the rest after A2 (asking at install = wasted ask).

| # | Notification | Trigger | Cap / window |
|---|---|---|---|
| N1 | **"Your turn!"** | Opponent finished their round | instant; the core loop — never throttled |
| N2 | Turn reminder | 12h turn inactivity (GDD §4.4) | once per match |
| N3 | Forfeit warning | 30h turn inactivity (forfeit at 36h) | once per match |
| N4 | Match result | Match ended | instant |
| N5 | Daily challenge reminder | User-chosen time (default 19:00 local) | 1/day; auto-pauses after ⚖️ 5 ignored in a row |
| N6 | Streak rescue | 21:30 local if streak ≥3 and not played | 1/day |
| N7 | "X passed you" weekly race | Rank drop, ⚖️ max 1/day | quiet hours respected |
| N8 | Weekly result | Monday reset | 1/week |
| N9 | Friend request / accepted | social events | instant |
| N10 | Friend joined via your link | attribution event | instant — the viral reward moment |

- **Quiet hours: 23:00–08:00 local** — everything except nothing (all queued). ⚖️
- Global daily cap ⚖️ 5 pushes/day excluding N1 (turn notifications are the product).
- Copy is playful per the brand voice, localized per language, with A/B slots (doc 10).

---

## 4. Re-engagement Loops

1. **Pending turns** (primary): async duels create natural "come back" obligations.
   Home surfaces them as an action list; N1/N2/N3 drive returns. Target: N1 → open ≥ 25%.
2. **Daily challenge + streak**: same 10 questions as your friends (GDD §5); streak flame
   on Home; N5/N6. Streaks are the single strongest D7 lever (Duolingo evidence).
3. **Weekly race**: Monday reset means *everyone* restarts at 0 — lapsed players get a
   fresh winnable race weekly. N7/N8 dramatize it.
4. **Lapsed-player win-back** (post-MVP, designed now): 7-day absent → friend can send a
   "wake up 😴" poke (one tap, rate-limited); 14-day absent → "your friends played 23 matches
   without you" digest. No fake content, real numbers only.

---

## 5. Viral / Invite Mechanics

- **Invite link** (primary channel): every share surface generates a deep link
  (`triviagame.app/i/<code>`) → store if not installed → deferred deep link completes
  friendship + opens a ready duel vs. the inviter on first launch. **The invited user's
  FTUE step 3 is replaced by "Dana challenged you!"** — instant A2 path.
- Share surfaces: post-match result card, daily-challenge score card, weekly podium,
  explicit invite buttons. Cards are image-rendered for WhatsApp/Instagram with score +
  app link; **never include question content** (GDD §5 anti-spoiler).
- Invite attribution tracked (doc 10): invites sent → installs → A2 conversion.
- No material invite rewards in MVP (nothing to give in a no-economy product); the reward
  is N10 + the auto-created duel. Reward experiments deferred to economy work.

---

## 6. Early-Lifecycle Plan (D0 → D30)

| Day | Lever |
|---|---|
| D0 | FTUE → A1; invite sheet; first duel if invited |
| D1 | N5 daily reminder (first one sent regardless of opt-in prompt timing — single grace send), pending turn if any |
| D2–6 | Turn loop + streak building; registration prompts at motivation peaks |
| D7 | If retained: nothing special — the loops carry. If lapsed: final streak-rescue, then back off |
| D8–30 | Weekly race rhythm; win-back pokes (post-MVP) |

Anti-goal: notification-bombing lapsed users. After ⚖️ 10 consecutive ignored pushes,
everything except N1 goes silent until the next organic open.

---

## 7. Open Questions (to resolve in beta)

- Does the taste round beat "straight into invite" on A2? (A/B in beta, doc 10)
- Optimal N5 default time — 19:00 vs. lunch (12:30)?
- Should weekly race need ≥3 friends to display rank-drop notifications (N7) to avoid
  2-person ping-pong spam?
