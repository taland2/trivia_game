# 09 — Security, Anti-Cheat & Privacy

> Status: **Draft v1** · Depends on: [06-system-architecture.md](06-system-architecture.md), [07-api-spec.md](07-api-spec.md), [08-data-model.md](08-data-model.md)
> Threat framing: a free social game among friends — the realistic adversaries are
> cheating friends (bragging rights!), griefers, and scripted abuse; not nation-states.
> Protections are proportionate but the *architecture-level* ones are non-negotiable
> because they can't be retrofitted.

---

## 1. Authentication & Authorization

- Firebase Auth: anonymous (guest) → Google/Apple link-and-merge (doc 05 §1). No passwords stored, ever.
- Callable functions verify `context.auth` on every call; participant checks on every match
  operation (`permission-denied/not-participant`).
- Firestore security rules implement the doc 06 §4 boundary:
  - match/leaderboard/XP collections: **read-only** to participants, **no client writes**;
  - profile writable fields whitelisted per-field (`displayName`, `avatarId`, `language`,
    `searchable`, `fcmTokens`, notification prefs); everything else function-only;
  - `questions/`, `dailySets/`, `servingsPrivate/`: no client access at all.
- Rules are code-reviewed + emulator-tested with an allow/deny matrix (doc 12); a CI check
  fails if any collection lacks an explicit rule (default-deny verified by test).
- App Check (Play Integrity / App Attest) enabled on Firestore + Functions from the beta —
  blocks non-app scripted clients cheaply.

## 2. Anti-Cheat (mapped to GDD/architecture rules)

| Threat | Defense | Where |
|---|---|---|
| Reading the correct answer from traffic/DB | Correct answer never leaves server pre-answer; servings split from `servingsPrivate` | doc 06 §5, doc 08 §2 |
| Slow-clock / fast-clock device | Server-authoritative timestamps only | GDD §3.2, doc 06 §4 |
| Googling mid-question | Short per-difficulty timers (10/15/20s) | GDD §3.2 |
| Kill app on hard question, retry | Question scored as timeout once served | GDD §11 |
| Answer-sharing between friends in same match | Identical questions but shuffled answer order per player; opponent detail hidden until both finish round | GDD §3.1, doc 08 reveal rule |
| Memorizing the bank | Per-player 90-day/500-question repeat exclusion; bank growth plan | GDD §11, doc 03 §2 |
| Scripted clients / emulator farms | App Check + per-uid rate limits + idempotency keys | §1, doc 07 §1 |
| Implausible speed (lookup bots) | Server flags sub-⚖️300ms correct streaks ≥5 → `suspicionScore` on user; weekly review query. MVP action: manual; later: shadow-flag from boards | functions `match` module |
| Multi-accounting to farm forfeit wins | Forfeit wins give flat points, no XP bonus; max 3 duels per friend pair | GDD §7, §4.6 |

No global leaderboard in MVP (vision/GDD decision) keeps the cheating blast radius inside
friend groups — where social pressure is the real enforcement.

## 3. Abuse & Safety

- No free text between players (emotes only, GDD §10.2) ⇒ no chat moderation surface.
- User-generated strings = display name + username only: server-side validation
  (length, charset), profanity list check (HE+EN) at claim time, report-user flow
  (`flags` collection) with manual review.
- Block: hides from search, cancels matches, prevents new ones, removes from each other's
  leaderboards both directions.
- Stranger duels (GDD §4.8, enabled at soft launch): same minimal surface — no free text,
  emotes only, block + report work identically; a blocked pair is never re-matched by the
  queue. Repeated reports against a user throttle their queue access.
- Minimum age 13 (store rating + ToS). No age gate UI in MVP (no risky features: no chat,
  no UGC, no purchases); revisit at UGC (v1.2) with a proper minors review.

## 4. Privacy & Compliance

- **Data inventory (complete):** auth identifiers (uid, provider email), display name,
  username, avatar choice, language, FCM tokens, gameplay records (matches, answers,
  scores, streaks), friendships/blocks, analytics events (GA4, device-level), crash logs.
  **Not collected:** contacts (decision, GDD §10.1), location, photos, ad identifiers.
- Privacy policy + ToS required before beta (store requirement) — task in roadmap.
  Written for GDPR-grade rights even though launch is Israel-first (Israeli Privacy
  Protection Law amendment 13 expectations are similar in spirit).
- **User rights flows:**
  - Export: `v1_requestDataExport` (post-MVP; manual fulfillment in beta ≤ 30 days);
  - Deletion: `v1_deleteAccount` in-app (store-mandated): immediate sign-out + tombstone,
    PII hard-wiped ≤ 30 days, matches anonymized, aggregates retained (doc 08 §4).
- Data residency: Firestore region `me-west1` (Tel Aviv) / functions same region (doc 07 §1).
- Analytics: GA4 with IP anonymization defaults; no ads SDKs; consent copy in onboarding
  settings; analytics opt-out toggle in settings (cheap goodwill).
- iOS App Tracking Transparency: **no ATT prompt needed** — we collect no IDFA and do no
  cross-app tracking (no ads SDKs); App Store privacy labels declare analytics as
  not-linked-for-tracking. Keep it that way: adding any ad/attribution SDK reopens this.

## 5. Platform & Supply-Chain Hygiene

- Secrets: Google Secret Manager only; nothing in repo; client contains no secrets by
  design. `content-tools` service-account keys local-only + rotated.
- Dependencies: lockfiles committed; `npm audit` / `dart pub outdated` in CI (doc 13);
  renovate-style monthly update pass as a LiveOps task.
- Store accounts + Firebase console: hardware-key 2FA (solo operator = single point of
  account-takeover failure).
- Transport: Firebase SDKs are TLS-only by default; the invite redirect domain is
  HSTS-enabled.

## 6. Security Review Gates

- Before beta: rules allow/deny matrix green · App Check enforced · privacy policy live ·
  delete-account flow works end-to-end · `/security-review` pass on functions code.
- Before v1.0 (live modes): re-review of realtime transport (new surface).
- Before v1.2 (UGC): full content-safety design review (named owner: product).
