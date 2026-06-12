# 04 — UX/UI Specification

> Status: **Draft v1** · Depends on: [02-game-design-document.md](02-game-design-document.md)
> This document is the textual spec; high-fidelity mockups live in a design file (Figma)
> that must stay in sync with it. Scope below = MVP unless marked otherwise.

---

## 1. Design Direction

**Vibrant & playful.** Bright gradient palettes, rounded geometry, bouncy micro-animations,
confetti on wins. The app's voice is "the funny friend in the group" (vision §5) — copy is
witty in both languages, never sarcastic at the player's expense after a loss streak.

Design principles:
1. **First fun < 60 seconds** from install (drives onboarding, doc 05).
2. **One-thumb play** — every in-match action reachable in the bottom 60% of the screen.
3. **Juice over chrome** — animation budget goes to answer reveals, podiums, streaks;
   navigation stays plain and fast.
4. **RTL is a first-class layout**, not a mirrored afterthought (§7).

---

## 2. Navigation — Bottom Tabs

| Tab | Content |
|---|---|
| 🏠 **Home** | Pending turns (action list), Daily Challenge card with streak, weekly race position card |
| ▶️ **Play** | Start: duel (pick friend → category-mode), daily challenge, (v1.0: live 1v1, group room), (v1.1: tournament) |
| 👥 **Friends** | Weekly leaderboard (default view), friends list, requests, add-friend (link / @search / QR) |
| 👤 **Profile** | Level + XP bar, streak, match history, weekly-race history, settings |

Match screens open as a full-screen stack above tabs (no tab bar during questions).

---

## 3. Screen Inventory (MVP)

**Onboarding:** splash → language pick (HE/EN, auto-detected, changeable) → 3-question
taste round → "challenge a real friend" sheet → home. Register prompt deferred (doc 05).

**Core loop screens:**
1. Home (see tab table)
2. New duel: friend picker → category-selection-mode picker (Player picks / Spinner / Auto — GDD §4.3)
3. Match lobby/recap: round history, scores, whose turn, emote strip
4. Category reveal: per the duel's mode — picker UI / wheel animation / auto card
5. **Question screen** (the most important screen in the app — §4)
6. Round result: 3-question side-by-side comparison vs. opponent (✓/✗ + times)
7. Match result: winner celebration, XP gained, weekly points gained, [Rematch] [Share]
8. Daily Challenge: intro card → 10 questions → score + friends-today board + share card
9. Weekly leaderboard: ranked friends, points, countdown to reset; past weeks archive
10. Profile (own + friend's), Settings (language, notifications, sound, account, blocked, delete account)
11. Add friend: share-link sheet, @username search, my QR / scan QR
12. Match history list + match detail

**System states:** every screen specifies empty / loading / error / offline variants in the
design file. Notable: Home with zero friends (invite CTA hero), leaderboard with <2 friends
("a race needs runners 🏃"), no-connection in async play (queued turn banner).

---

## 4. Question Screen (canonical spec)

```
┌─────────────────────────┐
│  Dana ●○○ │ ROUND 3 │ You ●●○
│      [⏱ ring countdown ]    │  ← color shifts green→amber→red
│                             │
│   Which planet has the     │
│   most moons?              │
│                             │
│  ┌───────────┐ ┌──────────┐ │
│  │  Jupiter  │ │  Saturn  │ │
│  └───────────┘ └──────────┘ │
│  ┌───────────┐ ┌──────────┐ │
│  │   Mars    │ │  Neptune │ │
│  └───────────┘ └──────────┘ │
│        question 2 / 3       │
└─────────────────────────┘
```

- Timer ring around/above question; per-difficulty duration (GDD §3.2). Last 3 seconds: pulse + tick sound.
- Tap an answer → immediate lock (no confirm step), button depresses, others dim.
- Reveal: correct answer flashes green; if wrong, player's pick shakes red **and the correct
  one is always shown**. Points earned fly up with the speed bonus itemized ("150 + 38 ⚡").
- 4 answers in a 2×2 grid; min touch target 64dp; long answers shrink font before wrapping (max 2 lines).
- Reveal interstitial ⚖️ 2.5s, tappable to skip to next question.
- No back navigation during a round (Android back = "forfeit this question?" dialog).

---

## 5. Design System

- **Color:** primary gradient (brand), one accent per category (8 category colors used in
  wheels, cards, result charts), success green / error red chosen colorblind-safe (§8).
- **Theming (decision):** all color tokens are defined as **semantic pairs (light + dark
  values) from day one** — components reference `surface/primary/onSurface...`, never raw
  hex. **MVP ships the light theme only**; the dark theme ships post-MVP as a settings
  toggle with zero repaint work because the token structure already exists. Design file
  must fill both columns of the token table even though dark isn't shipped.
- **Type:** a rounded sans family with full Hebrew + Latin support and matching weights
  (candidates: Heebo, Rubik, Assistant — final pick in design file). Dynamic type scaling supported.
- **Components:** buttons (primary/secondary/destructive), answer button (idle/locked/correct/
  wrong/dimmed), cards, leaderboard row, avatar + level ring, emote strip, countdown ring,
  podium, streak flame, toast/banner, modal sheet.
- **Motion:** standard durations 150/250/400ms; celebrations up to 1.5s, always skippable.
  Reduced-motion OS setting honored (kills confetti/shakes, keeps state changes).
- **Sound:** correct ding, wrong thud, tick (last 3s), turn-start whoosh, victory fanfare,
  podium drumroll. Global mute toggle + respects device silent mode. All sounds ≤1s except fanfare.
  **No background music (decision)** — most players mute it; SFX carry the energy.
- **Haptics (MVP):** light tap on answer lock, success/error impact on reveal, heavy impact
  on match win, subtle ticks on wheel spin. Settings toggle; respects OS-level haptic
  settings. Cheap to build, large contribution to juice.

---

## 6. Avatars & Identity

- MVP: built-in avatar set (⚖️ 24 playful illustrated avatars) + display name + @username.
  No photo upload in MVP (moderation burden — vision §9, solo operator).
- Level ring around avatar everywhere it appears (progression visibility, GDD §8).

---

## 7. RTL & Localization Layout Rules

- Full mirrored layout in Hebrew: navigation order, progress direction, back affordances.
- Exceptions that do **not** mirror: countdown ring direction, numerals, the 2×2 answer grid order (reading order does mirror).
- Mixed-direction text (Hebrew question with English answer/name) must render with proper
  bidi isolation — test cases in doc 12.
- All copy goes through localization keys; **no hardcoded strings**; humor copy is written
  per-language by a human (vision §5), not translated.

---

## 8. Accessibility (MVP commitments)

- Correct/wrong never communicated by color alone — always icon (✓/✗) + motion.
- Colorblind-safe palette check for all answer states and category colors.
- Font scaling up to 130% without layout breakage on question screen.
- Screen-reader labels on all interactive elements; question screen readable but speed
  competition acknowledged as visual-first (a11y review notes this as a known limit).
- Minimum touch targets 48dp (answers 64dp).

---

## 9. Performance & Feel Budgets

- Cold start → Home: ⚖️ < 2.5s on a mid-range Android device.
- Tap answer → lock feedback: < 50ms (local), server confirm async.
- Question screen renders fully **before** the timer starts (GDD §3.2).
- All images (avatars, category art) bundled or aggressively cached — question flow must
  work on a flaky connection with zero mid-round network dependency for async mode
  (round content prefetched at round start).

---

## 10. Deliverables Checklist (design file)

- [ ] Mood board + 2–3 visual explorations of the question screen (pick one)
- [ ] Design tokens (colors, type scale, spacing, radii) exported for the client framework
- [ ] High-fi mockups for all §3 screens × (HE RTL + EN LTR)
- [ ] Component library with all states from §5
- [ ] Motion prototypes: answer reveal, wheel spin, podium, weekly-reset celebration
- [ ] Empty/error/offline states for every screen
- [ ] App icon + store screenshots template
