import { z } from "zod";
import { IdempotencyKeySchema } from "./common.js";
import { RoundResultSchema, MatchResultSchema } from "./duel.js";

// v1_submitAnswer (doc 07 §2.2).
// answerIx: null = explicit timeout report; the server clock decides actual timing
// either way (doc 06 §4 — client times are display-only).
export const SubmitAnswerRequestSchema = z
  .object({
    matchId: z.string().min(1),
    roundIx: z.number().int().min(0).max(4),
    qIx: z.number().int().min(0).max(2),
    answerIx: z.number().int().min(0).max(3).nullable(),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequestSchema>;

// roundResult is present on the answer that completes a round (qIx=2 of the
// second player to finish); matchResult is present when that round also ends the
// match (a player reaching 3 round wins). Both are doc 08 §2 projections.
// `replay` is true instead of roundResult when the round was an exact points-and-
// time tie and is being re-dealt with fresh questions (GDD §4.5) — no reveal.
export const SubmitAnswerResponseSchema = z.object({
  correctIx: z.number().int().min(0).max(3),
  // points = basePoints + speedBonus (server invariant). The client shows the
  // real split on the fly-up (H6) instead of fabricating a 50/50 guess. All three
  // are 0 on a wrong/timed-out answer.
  points: z.number().int().min(0),
  basePoints: z.number().int().min(0),
  speedBonus: z.number().int().min(0),
  roundDone: z.boolean().optional(),
  replay: z.boolean().optional(),
  roundResult: RoundResultSchema.optional(),
  matchResult: MatchResultSchema.optional(),
});
export type SubmitAnswerResponse = z.infer<typeof SubmitAnswerResponseSchema>;
