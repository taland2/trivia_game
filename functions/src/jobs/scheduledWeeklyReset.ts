import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { rollWeek } from "../economy/rollWeek.js";

// Weekly leaderboard reset (GDD §7) — Monday 00:00 Asia/Jerusalem. WIRED BUT NOT
// DEPLOYED UNTIL THE BLAZE STEP (alongside Phase 9): Cloud Scheduler needs Blaze,
// and dev runs on the Spark emulator. The emulator integration suite exercises
// rollWeek() directly; this wrapper exists so build/typecheck cover it and the
// deploy step only has to flip it on.
export const scheduledWeeklyReset = onSchedule(
  { region: FUNCTIONS_REGION, schedule: "0 0 * * 1", timeZone: "Asia/Jerusalem" },
  async () => {
    await rollWeek(getFirestore(), Timestamp.now().toDate(), getBalance());
  },
);
