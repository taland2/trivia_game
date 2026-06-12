# 14 — Live Operations Plan

> Status: **Draft v1** · Depends on: [03-content-strategy.md](03-content-strategy.md), [13-devops-release.md](13-devops-release.md)
> Activates at Gate D (beta). Sized for a solo operator: recurring rituals are small,
> scheduled, and mostly automated with human review points.

---

## 1. Operating Rhythm

| Cadence | Ritual (time budget) |
|---|---|
| Daily (~10 min) | Ops dashboard glance; daily-set published OK (alert-backed); flag queue triage; beta feedback channel |
| Weekly (~2h) | Bank health + content sprint batch (doc 03 §7); suspicion-score review (doc 09 §2); weekly reset sanity (podium notifications went out); store reviews digest; cost check |
| Monthly (~half day) | +250/lang content sprint completion; dependency update pass; quarantine queue to zero; metrics review vs. vision §7 targets; this doc + runbook updates |
| Quarterly | Bank health report; DR restore drill; doc-suite review (do the docs still match reality?) |

## 2. Content Operations

- **Daily set queue ≥ 14 days** — the publish preflight refuses thin queues (doc 12 §6);
  the weekly ritual tops it up. The daily set is the product's heartbeat: its failure is a
  page-immediately alert (doc 13 §6).
- Flag triage SLA: ⚖️ quarantined questions resolved < 7 days (fix/retire).
- Seasonal packs: planned 4 weeks ahead (holidays calendar in repo); retired on schedule
  via `valid_until`.
- Recalibration job output reviewed weekly (sanity: no mass rebucketing event).

## 3. Incident Response

**Severity ladder:**
- **P0** — can't play at all (functions down, daily missing, store-breaking crash):
  respond same-day, all else stops.
- **P1** — a mode or loop degraded (notifications dead, invites broken, leaderboard wrong):
  respond < 48h.
- **P2** — cosmetic/limited: weekly batch.

**Runbook entries (maintained in `docs/runbook/`, seeded before Gate D):**
- Date-set missing for an upcoming calendar day (unlock is per-user local midnight — earliest users hit it ~10h ahead of Israel) → manual publish command (`content-tools daily:publish --force --date=YYYY-MM-DD`)
- Weekly reset failed → safe re-run procedure (job is idempotent by design — doc 12 §3)
- Bad question in today's daily → quarantine + in-place set patch (scores already given stand, GDD §11)
- Function error spike → rollback to previous tag (doc 13 §3)
- Forfeit sweep ran wild / didn't run → reconciliation script
- Remote Config bad value → restore from repo template (doc 13 §5)
- **Tournament-mid-incident policy (v1.1, decided now):** brackets pause (deadlines frozen
  via config) rather than mass-forfeit; players notified; deadlines extended by outage length.

**Communication:** in-app banner via Remote Config (`status_banner` key) — honest, playful
tone ("השרת שתה קפה ☕ תכף חוזרים"). No status page at this scale.

## 4. Player Support

- Channels: in-app shake-report (doc 12 §7) + support email (alias, not personal). No SLAs
  promised publicly; internal target first-response < 72h.
- Macros for the recurring five: lost streak (goodwill restore ≤1×/player via admin tool),
  forfeit complaints (policy quote, no reversals), wrong-question disputes (thanks + flag,
  no score changes — GDD §11), account merge issues (admin merge tool), deletion requests
  (point to in-app flow, doc 09 §4).
- Admin tooling (in `content-tools/admin`): user lookup, streak restore, account merge fix,
  match inspect. **Every admin action writes an audit log entry.** No direct prod-console
  data edits.

## 5. Community & Growth (post-soft-launch, lightweight)

- Weekly themed daily runs (e.g., "Sports week") — pure content ops, no code.
- Share-card quality is the marketing budget: review screenshots from the wild monthly.
- v1.1 tournaments add: scheduled "official" weekend community brackets — calendar owned here.

## 6. Lifecycle Policies (operational side of decisions made elsewhere)

- Guest purge (90d), match compaction (90d), weekly-board trim (26w) — automated jobs
  (docs 05/08), verified in the monthly ritual.
- Sunset clause for experiments/seasonal flags: every Remote Config flag added gets an
  owner note + review date in the repo template — the quarterly ritual deletes stale ones.
