import { onCall } from "firebase-functions/v2/https";
import { FUNCTIONS_REGION } from "./config/region.js";

// Emulator smoke-test target (Phase 0 exit checkpoint).
export const v1_ping = onCall({ region: FUNCTIONS_REGION }, () => {
  return { ok: true, serverTimeMs: Date.now() };
});
