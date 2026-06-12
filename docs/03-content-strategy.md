# 03 — Content Strategy

> Status: **Draft v1** · Depends on: [01-product-vision.md](01-product-vision.md), [02-game-design-document.md](02-game-design-document.md)
> The question bank is the product's core asset. This document defines where questions
> come from, how quality is enforced, and how the bank grows and self-corrects.

---

## 1. Sourcing Strategy (three channels, one pipeline)

All channels feed the same review pipeline (§3) — **no question is served without passing it.**

| Channel | Role | Languages |
|---|---|---|
| **AI-generated (primary)** | Claude generates candidate questions per category × difficulty from authored prompts; bulk of the bank | HE + EN |
| **Open trivia databases (bootstrap)** | Import from Open Trivia DB and similar CC-licensed banks for instant English volume; each import is re-reviewed, re-categorized to our 8 categories, and difficulty re-labeled | EN only |
| **Manual authoring (flavor)** | Hand-written questions, mainly for *Israel & Local Culture* and topical/current content AI handles poorly | HE mostly |

License note: imported questions keep source attribution in metadata; only licenses
permitting commercial use without copyleft on the bank itself are accepted.

---

## 2. Volume Plan

- **MVP launch: ~800 approved questions per language** (≈100 per category × 8).
- ⚠️ Known tradeoff (explicit decision): with the GDD's 90-day repeat exclusion, a heavy
  player can exhaust a category in days. Mitigations:
  - Launch is effectively a **closed/soft launch** to friend circles — traffic is small.
  - **Growth target: +250 approved questions per language per month** until the bank
    reaches ~2,000/language, then steady-state +100/month.
  - Serving engine falls back to least-recently-seen questions when a player exhausts
    the eligible pool (relaxes the 90-day rule rather than failing).
- Distribution guardrails per category: ⚖️ 40% Easy / 35% Medium / 25% Hard.
- Daily Challenge consumes 10 questions/day from a dedicated curated queue, planned
  ⚖️ 14 days ahead.

---

## 3. Content Pipeline

```
Generate / Import / Author
        ▼
DRAFT ──► REVIEW (human) ──► APPROVED ──► LIVE (servable)
              │                              │
              └─► REJECTED (with reason)     └─► QUARANTINED (player flags / stats anomaly)
                                                   └─► fix → re-review, or retire
```

**Review checklist (every question, no exceptions):**
1. Factually correct — verifiable; one and only one correct answer.
2. Distractors plausible but unambiguously wrong (no "technically also true").
3. No dated phrasing that rots ("current champion…" → forbidden; use year-anchored phrasing).
4. Clear in ≤120 chars; answers ≤40 chars; no trick grammar.
5. Appropriate for 13+ (primary audience is 18–35, but teens are in — see vision §2).
6. Category and initial difficulty label assigned.
7. For localized pairs: adaptation reads natively, not as translation.

Review tooling: a lightweight internal review app/CLI (approve/reject/edit per question) —
specified as an internal tool in the roadmap (doc 11). Review throughput assumption:
⚖️ 60–100 questions/hour for a single reviewer.

---

## 4. Localization Model — Shared Core + Local Extras

- **Shared core (~70%):** authored once (either language), *adapted* — not machine-translated —
  to the other. Each pair shares a `concept_id` so analytics can compare across languages.
- **Local extras (~30%):** language-exclusive questions where culture demands —
  *Israel & Local Culture* is mostly HE-exclusive; some global pop-culture is EN-exclusive.
- **Daily Challenge:** built from shared-core questions only, so HE and EN players answer
  the same daily concepts and scores remain comparable (GDD §5).
- **Duels are same-language only (GDD §4.7)**, so rounds never mix banks — `concept_id`
  exists for the daily challenge and analytics comparability, not for cross-language matches.
- RTL/typography QA is part of review for Hebrew (no mixed-direction breakage, correct
  punctuation, gender-neutral phrasing where possible).

---

## 5. Difficulty Calibration — Label + Live Recalibration

1. **Initial label** assigned at authoring/review (best guess).
2. Once a question accumulates ⚖️ **200 scored answers**, its observed correct-rate
   rebuckets it automatically:

| Observed correct-rate | Difficulty |
|---|---|
| > 75% | Easy |
| 40–75% | Medium |
| < 40% | Hard |

3. Rebucketing applies to **future servings only** — past scores never change (GDD §11).
4. Hysteresis: a question must sit ⚖️ 10 points past a boundary to move (no flapping).
5. Secondary signal: median answer time vs. tier norm flags suspicious questions for review.
6. Questions with correct-rate < 15% or heavy flag counts auto-quarantine for human review
   (usually means ambiguity or a wrong answer key).

---

## 6. Question Metadata Schema (authoritative copy lives in doc 08)

| Field | Notes |
|---|---|
| `id`, `concept_id` | `concept_id` links HE/EN adaptations of the same question |
| `language` | `he` / `en` |
| `category` | one of the 8 launch categories |
| `sub_tags[]` | free-form tags for future subcategories |
| `text`, `answers[4]`, `correct_index` | correct answer stored by index pre-shuffle; shuffle happens at serving |
| `difficulty_label`, `difficulty_observed` | initial vs. live-calibrated |
| `stats` | servings, correct-rate, median answer ms |
| `status` | draft / review / approved / live / quarantined / retired |
| `source` | ai-generated / opentdb / manual + attribution |
| `flags` | player reports with reasons |
| `created_at`, `reviewed_by`, `valid_until` | `valid_until` for time-sensitive facts |

---

## 7. Freshness & Maintenance

- **Monthly content sprint:** +250/language new questions; review of all quarantined items;
  retirement of rotted questions (`valid_until` sweep).
- **Seasonal/topical packs** (holidays, World Cup…) authored ad-hoc into relevant categories —
  flagged with `sub_tags` so they can be boosted around the event and retired after.
- **Player flag loop (GDD §11):** ⚖️ 5 flags auto-quarantine; reviewer verdict either fixes
  & re-approves or retires. Flag reasons offered to players: wrong answer / typo / unclear /
  outdated / offensive.
- Quarterly bank health report (from analytics, doc 10): repeats served, exhaustion events,
  per-category correct-rates, flag rates by source channel — informs sourcing mix.

---

## 8. UGC Question Packs (v1.2 — principles reserved now)

- UGC packs are **private-to-friends by default**; serving a pack to the public requires a
  review path that does not exist in v1 — there is no public UGC at v1.2 launch.
- UGC questions never enter the main bank, never appear in duels/daily — only in
  "play this pack" sessions among the creator's friends.
- Report flow + creator-level throttling designed in doc 09 before the feature ships.
- Full UGC spec will be added as a GDD chapter when v1.2 planning starts.
