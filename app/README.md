# app/ — Flutter client (placeholder)

The Flutter project is generated here via `flutter create` in the tooling session
(doc 15 Phase 0, deferred: Flutter SDK + Android toolchain are not yet installed on
the dev machine — decision 2026-06-12: develop against a physical Android device,
SDKs to be installed on drive E:).

Planned setup (do not hand-create these):
- Flavors: `dev` / `staging` / `prod` selecting the Firebase project (doc 06 §8)
- Min OS: Android 10 (API 29) / iOS 16 (doc 06 §1)
- Layers: UI / pure-Dart domain / data (repositories → Firebase adapters) (doc 06 §2)
- Generated API client from `packages/api_contract` (doc 07 §6)
