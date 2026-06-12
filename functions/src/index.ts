import { setGlobalOptions } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";

// Region per doc 07 §1. All callables are namespaced v1_*.
setGlobalOptions({ region: "me-west1" });

// Emulator smoke-test target (Phase 0 exit checkpoint). Replaced as the surface
// grows; v1_submitAnswer lands in Phase 1 (walking skeleton).
export const v1_ping = onCall(() => {
  return { ok: true, serverTimeMs: Date.now() };
});
