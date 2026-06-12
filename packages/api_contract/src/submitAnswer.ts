import { z } from "zod";
import { IdempotencyKeySchema } from "./common.js";

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

// roundResult / matchResult get concrete shapes in Phase 3 (match documents,
// doc 08); until then they are opaque to the contract.
export const SubmitAnswerResponseSchema = z.object({
  correctIx: z.number().int().min(0).max(3),
  points: z.number().int().min(0),
  roundDone: z.boolean().optional(),
  roundResult: z.unknown().optional(),
  matchResult: z.unknown().optional(),
});
export type SubmitAnswerResponse = z.infer<typeof SubmitAnswerResponseSchema>;
