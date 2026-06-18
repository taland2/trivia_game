import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { sweepForfeits } from "../match/sweepForfeits.js";

// Turn-timeout auto-forfeit sweep (GDD §4.4). WIRED BUT NOT DEPLOYED UNTIL PHASE
// 7: Cloud Scheduler requires the Blaze plan, and dev runs on the Spark emulator.
// The emulator integration suite exercises sweepForfeits() directly; this wrapper
// exists so the build/typecheck covers it and Phase 7 only flips deployment on.
export const scheduledForfeitSweep = onSchedule(
  { region: FUNCTIONS_REGION, schedule: "every 15 minutes" },
  async () => {
    await sweepForfeits(getFirestore(), Timestamp.now(), getBalance());
  },
);
