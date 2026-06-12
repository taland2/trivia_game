# 13 — DevOps & Release Engineering

> Status: **Draft v1** · Depends on: [06-system-architecture.md](06-system-architecture.md), [12-test-plan.md](12-test-plan.md)
> Principle: everything reproducible from the repo by one person; no console-clicking
> that isn't captured as config/scripts.

---

## 1. Repository Layout (monorepo)

```
trivia_game/
  app/                 # Flutter (flavors: dev/staging/prod)
  functions/           # Cloud Functions (TypeScript)
  packages/
    api_contract/      # zod schemas → Dart codegen (doc 07 §6)
    analytics_contract/
  content-tools/       # generation, import, review CLI, migrations (doc 03)
  firebase/            # firestore.rules, indexes, per-env firebase.json, remote-config templates
  docs/                # these documents
  .github/workflows/
```
Branching: trunk-based — `main` always releasable; short-lived feature branches + PR.
Conventional commits; release tags `app-vX.Y.Z` / `functions-vX.Y.Z`.

## 2. CI (GitHub Actions, on every PR)

1. Functions: lint, typecheck, unit, emulator integration + **rules matrix** (doc 12 §1)
2. App: `flutter analyze`, unit + widget tests, build debug APK (compile check)
3. Contracts: zod→Dart codegen diff check (uncommitted drift fails)
4. Bank lint (when content changed): doc 12 §6 checks
5. Dependency audit (`npm audit`, `dart pub outdated --mode=null-safety` report)
6. PR checklist enforced by template: *"Does this add a client write? State its doc 06 §4
   boundary side."*

Nightly: E2E golden paths on emulators; cost-regression listener-count test (doc 12 §4).

## 3. CD — Environments & Promotion

| Target | Trigger | Destination |
|---|---|---|
| dev | merge to `main` | auto-deploy functions+rules+indexes to `trivia-dev`; no app deploy (local dev runs flavors) |
| staging | manual `workflow_dispatch` or tag `rc-*` — **pipeline activates at Gate C** (project exists from day one, deploys start when there's a beta audience) | deploy backend to `trivia-staging`; build signed apps → TestFlight + Play internal |
| prod | tag `app-v*` / `functions-v*` (separate cadences allowed) | backend to `trivia-prod`; apps → store tracks (phased rollout: Play staged 10→50→100%, iOS phased release on) |

- Backend deploys are **expand/contract**: functions tolerate schema N-1 (doc 08 §5);
  rules+indexes deploy before functions that need them.
- **Rollback:** functions = redeploy previous tag (one command, scripted); rules kept
  versioned; app rollback = halt staged rollout + Remote Config kill switches (§5).
  Data migrations are forward-fix only (no down-migrations; dry-run + backup export first).

## 4. Signing & Store Operations

- Android: Play App Signing; upload key in local encrypted keystore + offline backup.
  iOS: App Store Connect API key for CI; certificates via Xcode cloud-managed signing.
- Store metadata (listings HE+EN, screenshots, data-safety forms) versioned in
  `app/store/` — store consoles are never the source of truth.
- Compliance watchlist: Apple guideline 4.7/5.3 (contests) — our tournaments award only
  virtual bragging rights (vision §10: no cash prizes) which keeps us clear; account
  deletion in-app (both stores, done — doc 09 §4); data-safety forms match doc 09 §4
  inventory exactly.

## 5. Remote Config & Feature Flags

- All GDD ⚖️ values per environment (GDD §12) · `min_supported_build` forced-update gate
  (doc 07 §1) · kill switches: `daily_enabled`, `invites_enabled`, `emotes_enabled`,
  per-mode switches as modes ship · FTUE copy variants (pre-wired for future A/B, doc 10 §4).
- Config changes are exported to `firebase/remote-config/` via script after each change —
  console edits get captured back into the repo.

## 6. Monitoring & Alerting (solo-operator sized)

| Signal | Source | Alert threshold ⚖️ |
|---|---|---|
| Crash-free sessions | Crashlytics | < 99% velocity alert → phone push |
| `submitAnswer` p95 / error rate | Cloud Monitoring | > 500ms or > 2% 15-min window |
| Function failures (any module) | Cloud Monitoring log metric | > 1% of invocations |
| Scheduled job missed (daily publish, forfeit sweep, weekly reset) | job heartbeat metric | any miss → **page immediately** (daily set missing = broken product morning) |
| Billing | GCP budget | $25 warn / $50 alert (doc 06 §10) |
| Store reviews ≤ 2★ | weekly digest | manual review |

Dashboards: ops board (above signals) + product board (doc 10 §2) — both linked from the
repo README. Alert delivery: email + FCM-to-self admin channel.

## 7. Backups & Disaster Recovery

- Firestore: daily scheduled export to GCS (30-day retention) per environment ≥ staging.
- Question bank: additionally exported weekly to repo-adjacent GCS as JSONL (the bank is
  the company's asset — survives even a Firebase project loss).
- DR drill before Gate D: restore an export into a scratch project, app boots against it.
- RPO 24h / RTO best-effort (acceptable for a free social game; revisit at scale).
