// All callables are namespaced v1_* and pinned to me-west1 (doc 07 §1).
// Region is set PER FUNCTION via onCall({ region }) rather than setGlobalOptions:
// the `export … from` re-exports below are hoisted and evaluated before any
// statement here would run, so a global call would land too late. See
// config/region.ts.
export { v1_ping } from "./ping.js";
export { v1_createDuel } from "./match/createDuel.js";
export { v1_startRound } from "./serve/startRound.js";
export { v1_submitAnswer } from "./match/submitAnswer.js";
export { v1_acceptRematch } from "./match/acceptRematch.js";
export { v1_sendEmote } from "./match/sendEmote.js";
export {
  v1_joinStrangerQueue,
  v1_leaveStrangerQueue,
} from "./match/strangerQueue.js";
export { v1_startDaily } from "./daily/startDaily.js";
export { v1_submitDailyAnswer } from "./daily/submitDailyAnswer.js";
// Scheduled job — wired but NOT deployed until Phase 7 (Blaze). See the file header.
export { scheduledForfeitSweep } from "./jobs/scheduledForfeitSweep.js";
