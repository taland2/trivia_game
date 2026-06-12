# 01 — Product Vision & Strategy

> Status: **Draft v1** · Owner: Product · Last updated: 2026-06-12
> Decisions in this document were made explicitly by the product owner and are the
> source of truth for all downstream documents (GDD, Architecture, Roadmap).

---

## 1. Elevator Pitch

**A playful, Hebrew-first multiplayer trivia game where real friend groups compete —
duels, live group rooms, and tournaments — with the best Hebrew trivia content available
and the ability to create your own question packs for the people you know.**

Think: *Trivia Crack's friend duels + Kahoot's live rooms + your WhatsApp group's
championship — built properly for Hebrew speakers, and in English too.*

---

## 2. Target Audience

| Priority | Segment | Notes |
|---|---|---|
| **Primary** | Friend groups, ages 18–35 | Real-life social circles (WhatsApp-style groups). All tone, notification, and social-feature decisions optimize for this group |
| Secondary | Teens 13–18 | Viral spread through classes; requires age-appropriate content rating and minor-safety review in the legal/privacy doc |
| Secondary | Families / all ages | Cross-generational play supported via difficulty range and simple UX, not via separate features |
| Secondary | Competitive trivia fans | Served by ranked ladders and tournaments, but depth never comes at the cost of casual accessibility |

**Design rule:** when a tradeoff arises between segments, the primary segment wins.

---

## 3. Core Value Proposition & Differentiators

What makes this game different from Trivia Crack, QuizUp, Kahoot:

1. **Hebrew-first quality.** The best Hebrew trivia content on mobile: professionally
   curated Hebrew question bank, flawless RTL UI, local cultural categories. The Hebrew
   trivia market is underserved — incumbents treat Hebrew as an afterthought or not at all.
2. **User-generated question packs.** Players create custom packs for *their* people —
   inside jokes, family trivia, workplace quizzes, "how well do you know me" packs.
   This turns content from a cost center into a social feature no global incumbent offers locally.
3. **Friend-group competition as a first-class citizen.** Tournaments and leagues among
   real friends (not strangers), from day one of the full vision.

**Languages at launch:** Hebrew + English. Full RTL support is a hard requirement, not a port.

---

## 4. Product Pillars (Game Modes — Full v1 Vision)

All four modes are part of the committed v1 vision, released in stages (see §8):

1. **Async 1v1 friend duel** — challenge a friend; each plays on their own time;
   "your turn" notifications drive the retention loop. *(Trivia Crack model)*
2. **Solo daily challenge** — one shared daily quiz, streaks, friend-comparable scores.
   The daily-retention hook.
3. **Real-time 1v1** — live head-to-head, same questions simultaneously, speed scoring.
   *(QuizUp model)*
4. **Real-time group room** — friends join with a code, answer live, podium between
   questions. *(Kahoot model)*
5. **Tournaments** — friend-group brackets and scheduled competitions. Committed v1
   feature (not nice-to-have); architecture must support it from the first line of code.

---

## 5. Tone & Brand Personality

**Playful & humorous.** Colorful visuals, witty copy, banter-style notifications
("דנה ריסקה אותך בגאוגרפיה 😈 נקמה?"). The game should feel like the funny friend in
the group, not a quiz show host. Humor must localize properly in both languages —
copywriting is a real workstream, not string translation.

---

## 6. Monetization

**Free, no monetization in v1.** No ads, no IAP, no paywalls.

- Rationale: maximize fun, retention, and viral spread first; decide monetization later
  from real usage data.
- Constraint this creates: infrastructure cost must be engineered to stay near-zero at
  early scale (favors BaaS free tiers, efficient realtime design). The Architecture doc
  must include a cost model.
- Future options held open (not designed yet): cosmetic IAP, ad-free supporter tier,
  premium question packs. **Pay-to-win is permanently out of scope.**

---

## 7. Success Metrics

**North-star metric (first 3 months): D7 retention** — % of new users who return 7 days
after install. Target to validate: **≥ 20%** (good for casual mobile; >25% is excellent).

Supporting metrics:

| Metric | Why it matters | Initial target |
|---|---|---|
| D1 retention | Onboarding quality | ≥ 40% |
| Friend-loop activation (played a real friend in week 1) | Proves the social core | ≥ 35% |
| Matches per DAU per day | Engagement depth | ≥ 3 |
| "Your turn" notification → return rate | The async loop works | ≥ 25% |
| Crash-free sessions | Quality bar | ≥ 99.5% |

---

## 8. Roadmap — Staged Releases

Full vision, shipped in verifiable stages. Each stage is independently shippable and
proves one hypothesis before the next stage builds on it.

| Stage | Scope | Hypothesis it proves |
|---|---|---|
| **MVP (v0.1)** | Async 1v1 friend duel + solo daily challenge + friends leaderboard + Hebrew/English question bank | The core social loop is fun and retains (D7) |
| **v1.0** | Real-time 1v1 + real-time group rooms | Live play multiplies engagement; infra holds up |
| **v1.1** | Tournaments: friend-group brackets + scheduled weekly competitions | Competitions drive appointment-based retention |
| **v1.2** | UGC question packs (create & share custom packs) | UGC differentiator drives invites and content scale |
| Later | Leagues/seasons, fool-your-friends mode, advanced social | — |

**Note:** tournaments are a *committed* feature ("must ship"), staged into v1.1 only for
engineering sequencing — the data model, ranking system, and architecture are designed
for tournaments from day one.

---

## 9. Development Context & Constraints

- **Team:** solo product owner + AI-assisted development (Claude Code agents doing the
  bulk of implementation).
- Implications (binding on the Architecture doc):
  - Architecture must be **simple enough for one person to verify and operate** —
    minimal moving parts, managed services (BaaS) strongly preferred over self-hosted.
  - Cross-platform single codebase (Flutter or React Native — decided in doc 06).
  - Every feature must be testable by automated tests + a small real-friends beta group.
  - Operational load (monitoring, incidents, moderation) must fit a solo operator.

---

## 10. Non-Goals (explicitly out of scope)

- ❌ Monetization of any kind in v1 (and pay-to-win — ever)
- ❌ Cash/real-money prizes for tournaments (store-policy and legal minefield)
- ❌ Web or desktop clients in v1 (mobile only: Android + iOS)
- ❌ Public chat between strangers (friend-circle interactions only — limits moderation burden)
- ❌ Languages beyond Hebrew + English in v1
- ❌ Native per-platform codebases

---

## 11. Top Risks

| Risk | Mitigation |
|---|---|
| Hebrew question bank is expensive/slow to build at quality | Dedicated Content Strategy doc (03); AI-generated + human-reviewed pipeline; difficulty calibration from live data |
| Realtime modes (v1.0) overwhelm solo-operator infrastructure | MVP ships without realtime; BaaS realtime (e.g., Firebase/Supabase) evaluated in doc 06 before commitment |
| Cold-start: friend-based game with no friends on it | Invite-first onboarding, guest join, solo daily challenge as single-player value from day one |
| Free product with rising infra costs | Cost model in doc 06; usage caps; monetization decision gate at defined MAU threshold |
| UGC moderation burden on a solo operator | UGC staged to v1.2; packs are private-to-friends by default; report flow before any public sharing |
