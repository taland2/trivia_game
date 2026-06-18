import type { Firestore } from "firebase-admin/firestore";

// Feature flags. In production (Phase 7) these resolve from a Remote Config
// server template; that is awkward in the emulator, so 4b uses a layered
// resolution that the dev loop and tests can drive:
//   1. process.env override (test/dev) — wins if set to "true"/"false"
//   2. a Firestore config/flags doc field (lets a test flip it via admin)
//   3. a hard default
// Phase 7 swaps layers 1–2 for the Remote Config fetch, keeping this signature.

function envFlag(name: string): boolean | null {
  const v = process.env[name];
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

// Stranger queue (GDD §4.8) is OFF by default until soft launch (Gate E).
export async function isStrangerQueueEnabled(db: Firestore): Promise<boolean> {
  const env = envFlag("STRANGER_QUEUE_ENABLED");
  if (env !== null) return env;
  const snap = await db.doc("config/flags").get();
  const fromDoc = snap.data()?.["stranger_queue_enabled"];
  if (typeof fromDoc === "boolean") return fromDoc;
  return false;
}
