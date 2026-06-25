import { z } from "zod";
import { IdempotencyKeySchema } from "./common.js";
import { ServingSchema } from "./serving.js";

// Daily Challenge callable contracts (doc 07 §2.3, GDD §5). One global quiz per
// calendar date; the client claims its own local `dayId` (Wordle model) and the
// server validates it against a ±14h sanity window (⚖️ balance.daily.windowMs).

// A calendar date "YYYY-MM-DD" — the user-local day the daily set is keyed to.
export const DayIdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type DayId = z.infer<typeof DayIdSchema>;

// --- v1_startDaily -----------------------------------------------------------
// No idempotency key: like v1_startRound, repeat calls are made idempotent by the
// already-served private docs (resume returns the identical servings, same clock).
export const StartDailyRequestSchema = z
  .object({ dayId: DayIdSchema })
  .strict();
export type StartDailyRequest = z.infer<typeof StartDailyRequestSchema>;

export const StartDailyResponseSchema = z
  .object({
    dailyId: DayIdSchema, // == dayId; the client passes it back to submit
    servings: z.array(ServingSchema).length(10),
  })
  .strict();
export type StartDailyResponse = z.infer<typeof StartDailyResponseSchema>;

// --- v1_submitDailyAnswer ----------------------------------------------------
// Mirrors v1_submitAnswer but keyed by (dayId, qIx) instead of (matchId, roundIx,
// qIx). Server clock is authoritative (client times display-only, doc 06 §4).
export const SubmitDailyAnswerRequestSchema = z
  .object({
    dayId: DayIdSchema,
    qIx: z.number().int().min(0).max(9),
    answerIx: z.number().int().min(0).max(3).nullable(),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type SubmitDailyAnswerRequest = z.infer<
  typeof SubmitDailyAnswerRequestSchema
>;

// The player's daily streak (GDD §5 — consecutive days PLAYED, not won).
export const StreakSchema = z
  .object({
    count: z.number().int().min(0),
    lastDayId: DayIdSchema,
  })
  .strict();
export type Streak = z.infer<typeof StreakSchema>;

// Final daily result, returned on the 10th answer (doc 07 §2.3).
export const DailyResultSchema = z
  .object({
    dayId: DayIdSchema,
    score: z.number().int().min(0),
    correctCount: z.number().int().min(0).max(10),
    totalMs: z.number().int().min(0),
    weeklyPointsAwarded: z.number().int().min(0),
  })
  .strict();
export type DailyResult = z.infer<typeof DailyResultSchema>;

// Same per-answer fields as the duel submit (the fly-up shows the real split, H6),
// plus the final {dailyResult, streak} on the 10th answer.
export const SubmitDailyAnswerResponseSchema = z.object({
  correctIx: z.number().int().min(0).max(3),
  points: z.number().int().min(0),
  basePoints: z.number().int().min(0),
  speedBonus: z.number().int().min(0),
  dailyDone: z.boolean().optional(),
  dailyResult: DailyResultSchema.optional(),
  streak: StreakSchema.optional(),
});
export type SubmitDailyAnswerResponse = z.infer<
  typeof SubmitDailyAnswerResponseSchema
>;
