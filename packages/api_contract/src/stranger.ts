import { z } from "zod";
import { CategoryModeSchema } from "./common.js";

// Stranger-queue callable contracts (GDD §4.8, doc 07). Built in MVP but Remote
// Config-gated OFF until soft launch (Gate E) — a small beta has no queue
// liquidity. When the flag is off the join is a no-op ({queued:false}).

// --- v1_joinStrangerQueue ----------------------------------------------------
// The requested category-selection mode is recorded for symmetry, but a paired
// stranger match always runs Spinner (product decision Phase 4b) since the two
// players may have asked for different modes.
export const JoinStrangerQueueRequestSchema = z
  .object({ categoryMode: CategoryModeSchema })
  .strict();
export type JoinStrangerQueueRequest = z.infer<
  typeof JoinStrangerQueueRequestSchema
>;

// Three outcomes: flag off (no-op), enqueued and waiting, or paired immediately
// (a match was created — the client navigates into it).
export const JoinStrangerQueueResponseSchema = z.union([
  z.object({ queued: z.literal(false) }).strict(),
  z.object({ queued: z.literal(true) }).strict(),
  z.object({ queued: z.literal(true), matchId: z.string().min(1) }).strict(),
]);
export type JoinStrangerQueueResponse = z.infer<
  typeof JoinStrangerQueueResponseSchema
>;

// --- v1_leaveStrangerQueue ---------------------------------------------------
export const LeaveStrangerQueueRequestSchema = z.object({}).strict();
export type LeaveStrangerQueueRequest = z.infer<
  typeof LeaveStrangerQueueRequestSchema
>;

export const LeaveStrangerQueueResponseSchema = z
  .object({ left: z.boolean() })
  .strict();
export type LeaveStrangerQueueResponse = z.infer<
  typeof LeaveStrangerQueueResponseSchema
>;
