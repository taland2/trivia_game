# 10 — Analytics & Telemetry Specification

> Status: **Draft v1** · Depends on: [01-product-vision.md](01-product-vision.md), [05-onboarding-retention.md](05-onboarding-retention.md)
> Stack: Firebase Analytics (GA4) + BigQuery export (on from day one — raw events are
> cheap and irreplaceable). **MVP policy: full instrumentation, no A/B framework**
> (decision: defer experiments until traffic justifies them; beta cohorts are too small).

---

## 1. Event Taxonomy

Naming: `snake_case`, past tense, ≤40 chars. Every event carries default GA4 context +
`app_language`, `is_guest`, `player_level`.

### Lifecycle & FTUE (funnel F1)
| Event | Params |
|---|---|
| `first_open` | (GA4 auto) |
| `ftue_language_set` | `language` |
| `ftue_taste_round_started` / `_completed` | `score`, `correct_count` |
| `ftue_invite_sheet_action` | `action: share\|qr\|search\|later` |
| `ftue_completed` | `seconds_from_open` |
| `registered` | `provider`, `days_as_guest` |

### Core gameplay
| Event | Params |
|---|---|
| `duel_created` | `category_mode`, `source: friends_tab\|rematch\|invite_auto\|home` |
| `duel_accepted` / `duel_declined` | `hours_pending` |
| `round_started` | `match_id, round_ix, category, category_mode` |
| `question_answered` | `context: duel\|daily`, `category`, `difficulty`, `correct`, `answer_ms`, `points`, `timeout` |
| `round_completed` | `won`, `round_score`, `tiebreak` |
| `match_completed` | `won`, `rounds_played`, `forfeit`, `duration_hours`, `rematch_clicked` |
| `match_forfeited` | `side: mine\|theirs`, `hours_idle` |
| `daily_started` / `daily_completed` | `score`, `streak_after`, `rank_among_friends` |
| `emote_sent` | `emote_id` |
| `question_flagged` | `reason` |

### Social & viral (funnel F3)
`invite_link_created` {surface} · `invite_link_opened` {installed: bool} ·
`invite_redeemed` {hours_since_created} · `friend_added` {source: invite|search|qr|stranger_match} ·
`friend_request_sent/accepted` · `share_card_created` {surface: match|daily|weekly} ·
`duel_blocked_language` {my_lang, their_lang} — *the GDD §4.7 revisit-signal* ·
`stranger_queue_joined` / `stranger_matched` {wait_hours} / `stranger_queue_abandoned`

### Retention surfaces
`notification_received/opened` {type: n1..n10} · `weekly_board_viewed` {rank, friends_count} ·
`weekly_finished` {rank, points} · `streak_lost` {length} · `settings_notif_changed` {type, enabled}

### Quality
`question_serving_failed` {reason} · `answer_submit_retried` {attempts} ·
`function_latency` (sampled 10%) {fn, ms} · crashes via Crashlytics.

## 2. Funnels & Core Dashboards (built before beta)

- **F1 FTUE:** first_open → taste_completed → ftue_completed → D1 return. Target install→ftue_completed ≥ 80%.
- **F2 Friend-loop (THE funnel, vision §7):** ftue_completed → friend_added → duel_created →
  match_completed vs. friend, within 7 days. Target ≥ 35%.
- **F3 Viral:** invite_link_created → opened → install → redeemed → invited user reaches F2.
- **F4 Turn loop:** notification_received(n1) → opened → round_started. Target open ≥ 25%.
- **Dashboards:** (1) North star: D1/D7/D30 cohort retention + DAU/WAU; (2) Funnels F1–F4;
  (3) Engagement: matches/DAU, daily participation %, streak distribution, emotes/match;
  (4) Content health (→ doc 03 §7): per-question correct-rate vs. label, repeat-serve rate,
  category popularity, flag rate, bank exhaustion events; (5) Ops: crash-free %, p95
  submitAnswer latency, forfeit rate, error-code counts.

## 3. Content Feedback Loop (analytics → question bank)

Nightly job (doc 06 §3 `content` module) reads BigQuery aggregates →
- rebuckets difficulty per doc 03 §5 thresholds;
- flags anomalies (correct-rate <15%, median time near limit, flag spikes) → quarantine;
- emits weekly bank-health report (doc 03 §7) to the operator.
This loop is **MVP scope** — it's what makes 800 questions/language viable.

## 4. Experimentation (deferred, pre-wired)

- All ⚖️ balance values already flow through Remote Config (GDD §12) — Firebase A/B Testing
  attaches to them with zero code when DAU justifies it (~1k+ DAU guideline).
- Experiment backlog parked from doc 05 §7: FTUE taste-round vs. invite-first; N5 default
  time; N7 friend-count threshold.

## 5. Governance

- Event schema lives in `packages/analytics_contract` (typed Dart wrapper — no raw string
  events in app code); adding an event = PR updating this doc + the package.
- PII rule: no display names, usernames, question text, or free text in event params — ids only.
- Retention: GA4 14 months; BigQuery raw indefinitely (cheap, anonymized ids).
- QA: doc 12 includes an events-fire smoke test for F1+F2 paths per release.
