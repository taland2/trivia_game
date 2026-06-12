# Trivia Game

Free, playful, Hebrew-first multiplayer trivia for real friend groups: async 1v1 duels,
daily challenge, weekly friends leaderboard. Full specification lives in [docs/](docs/)
(docs 00–14 are the source of truth; [docs/15-implementation-plan.md](docs/15-implementation-plan.md)
is the active execution plan).

## Monorepo layout (doc 13 §1)

| Path | Contents |
|---|---|
| `app/` | Flutter client (flavors: dev/staging/prod) — created in the tooling session via `flutter create` |
| `functions/` | Cloud Functions, TypeScript (all integrity-sensitive server logic) |
| `packages/api_contract/` | zod schemas — single source of truth for callable shapes; Dart codegen |
| `content-tools/` | Question generation / import / review CLI (internal, not shipped) |
| `firebase/` | `firestore.rules`, `firebase.json`, per-env config |
| `docs/` | The specification suite |

## Prerequisites

- Node.js 22 LTS (functions, contract, content-tools)
- Java 17 (Firestore emulator) — *not yet installed on the dev machine*
- Flutter SDK stable + Android SDK — *not yet installed; physical Android device chosen for dev*
- Firebase CLI: `npm i -g firebase-tools`

## One-command dev startup

```powershell
./scripts/dev.ps1        # installs deps if missing, builds, starts the emulator suite
```

Until the `trivia-dev` Firebase project is created, emulators run against the offline
demo project `demo-trivia-dev` (no cloud resources, no billing).

## Per-package commands

```powershell
cd functions; npm test            # unit tests (Vitest)
cd functions; npm run lint        # ESLint
cd functions; npm run typecheck
cd packages/api_contract; npm test
```

## Engineering guardrails (non-negotiable — doc 06 §4, doc 09)

1. Integrity writes (matches, scores, XP, leaderboards, friendships) go through Cloud
   Functions only.
2. The correct answer never reaches the client before the player answers.
3. Server-authoritative timing; client times are display-only.
4. All ⚖️ balance values via Remote Config (`functions/src/config/balance.ts` defaults),
   never hardcoded at call sites.
5. Idempotency keys on every mutating callable.
