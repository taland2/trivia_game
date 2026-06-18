import { Timestamp } from "firebase-admin/firestore";
import type { Balance } from "../config/balance.js";

// Compute the next turn deadline (GDD §4.4 auto-forfeit window). Called at every
// site that flips turnUid — duel creation, round handoff, round-resolution
// advance, and tie-replay flip — so an idle turn is always sweepable. A finished
// match clears turnDeadline to null instead (no live turn to expire).
export function deadlineFrom(now: Timestamp, balance: Balance): Timestamp {
  return Timestamp.fromMillis(now.toMillis() + balance.turnDeadlineMs);
}
