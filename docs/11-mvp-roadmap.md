# 11 — MVP Definition & Release Roadmap

> Status: **Draft v1** · Depends on: all of 01–10
> Timeline policy (explicit decision): **no calendar deadlines — milestone gates only.**
> Each milestone has exit criteria; work proceeds gate to gate. Codename: **"Trivia"**
> (real name + store/domain availability is a Gate C task).

---

## 1. MVP Scope (v0.1) — MoSCoW

**Must (the MVP is not done without these):**
- Async 1v1 duel, complete per GDD §4 (best-of-5, 3 category modes, timeouts, tiebreakers)
- Daily challenge + streaks (GDD §5)
- Weekly friends leaderboard (GDD §7) · XP & levels (GDD §8)
- Friends: invite link (with deferred deep link), @username search, QR (GDD §10.1)
- Guest-first onboarding + Google/Apple registration & merge (doc 05 §1)
- Notifications N1–N6, N8–N9 (doc 05 §3) · Emotes (GDD §10.2)
- 800 approved questions × HE/EN (doc 03) + serving engine + flag flow
- Async stranger queue (GDD §4.8) — **built and tested in MVP, Remote Config-disabled
  until Gate E** (no liquidity in a 20-user beta)
- Security gates pre-beta (doc 09 §6) · Analytics F1–F4 + dashboards (doc 10)
- HE (RTL) + EN fully localized UI · same-language duel rule (GDD §4.7)

**Should (in MVP if no gate slips because of it):**
- N7 rank-drop notification · match history detail screen · share cards (match + daily)

**Could (first post-MVP iterations):**
- Past-weeks archive UI · per-category personal stats · Android home-screen widget for daily

**Won't (this release — committed later per vision §8):**
- Real-time modes (v1.0) · tournaments (v1.1) · UGC packs (v1.2) · power-ups/economy ·
  achievements · global boards · fool-your-friends mode

## 2. Milestones & Exit Criteria

### Gate A — "Playable Core" (internal)
Two emulator accounts can complete a full duel on dev: all 3 category modes, scoring per
GDD formula verified by tests, tiebreakers, forfeit sweep, weekly points awarded.
UI may be ugly. Question bank ≥ 100/lang (unreviewed OK on dev).
*Proves: the game rules work end-to-end on the real stack.*

### Gate B — "Feels Like the Game" (internal)
Design system applied; question screen juice complete (doc 04 §4–5); onboarding FTUE
flow; daily challenge + streak; leaderboard screen; notifications N1/N4/N5 firing on real
devices (both platforms); HE+EN switchable; crash-free through a 20-match dogfood week
by the operator.
*Proves: it's fun and stable enough to show friends.*

### Gate C — "Beta-Ready"
- Content: ≥ 800 approved questions/language; daily queue 14 days ahead
- Security: all doc 09 §6 pre-beta gates green
- Stores: name decided, listings, privacy policy live, TestFlight + Play internal approved
- Invite deep links work install-path end-to-end on both platforms
- Analytics dashboards live; staging env exercised by the release pipeline (doc 13)

### Gate D — "Closed Friends Beta" (~20–50 real users, 3–4 weeks)
Exit criteria to leave beta:
- D7 ≥ 15% within beta cohort (beta-adjusted target; public target stays 20%)
- F2 friend-loop ≥ 30% · crash-free ≥ 99.5% · p95 submitAnswer ≤ 300ms
- Zero unresolved P0/P1 bugs; forfeit rate < 30% of matches (else turn-timeout retuning)
- Top-10 beta feedback items triaged (fixed or consciously deferred)

### Gate E — "Soft Launch" (public stores, Israel, no marketing)
Organic + friend-circle growth only. **Stranger queue flag flips on here** (GDD §4.8).
Standing review of north-star dashboard.
Exit to v1.0 work when: D7 ≥ 20% sustained 4 weeks AND weekly active friend-pairs growing.

### Post-MVP gates (sequenced, criteria set when adjacent)
v1.0 live modes — entry: doc 06 §6 realtime prototype gate passed.
v1.1 tournaments — entry: v1.0 stable + enough weekly-active friend groups.
v1.2 UGC — entry: doc 09 §6 UGC safety review done.

## 3. Build Order (dependency-driven, inside Gates A–B)

1. Monorepo + 3 Firebase envs + CI skeleton (doc 13) — everything depends on it
2. `packages/api_contract` + data model skeleton + security rules baseline (default-deny)
3. Auth (guest) + profile + `match` module: create/accept/serve/submit/resolve (pure-logic
   tests first — scoring & tiebreak rules are the highest-value tests in the project)
4. Flutter app shell: navigation, design tokens, question screen (against emulators)
5. Duel screens end-to-end → **Gate A**
6. Content pipeline tooling + first AI-generation batches + review CLI (parallel track from week 1)
7. Daily + streaks + weekly leaderboard + XP
8. Onboarding/FTUE + registration merge + friends (invite/search/QR) + notifications
9. Polish pass (motion, sound, empty states, RTL audit) → **Gate B**
10. Content to 800/lang, store setup, security gates, dashboards → **Gate C**

## 4. Top Execution Risks

| Risk | Watch / response |
|---|---|
| Content review is the bottleneck (≈16–27h human review for 1,600 questions) | Start channel in step 6, batch daily; review-tool UX is worth real investment |
| Invite deferred deep links flaky (the one feature touching both stores' quirks) | Build + device-test earliest (step 8 start); fallback: manual code entry field |
| Scope creep into "Won't" items | Any addition must name the Must it displaces — enforced in this doc via PR |
| Solo motivation dip (no deadline) | Gates are small and demoable; each ends with something playable to show friends |
