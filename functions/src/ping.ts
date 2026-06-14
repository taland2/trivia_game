import { onCall } from "firebase-functions/v2/https";

// Emulator smoke-test target (Phase 0 exit checkpoint).
export const v1_ping = onCall(() => {
  return { ok: true, serverTimeMs: Date.now() };
});
