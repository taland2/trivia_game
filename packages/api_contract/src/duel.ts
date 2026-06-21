import { z } from "zod";
import {
  CategoryModeSchema,
  CategorySchema,
  DifficultySchema,
  IdempotencyKeySchema,
} from "./common.js";
import { ServingSchema } from "./serving.js";

// Duel lifecycle callable contracts (doc 07 §2.2). All integrity writes happen
// server-side; these schemas are the single source of shape truth shared by the
// functions and (via codegen) the Dart client.

// --- v1_createDuel -----------------------------------------------------------
// Phase 3: friendship/cap/same-language validation is deferred (Phase 4/8); the
// only client input is the opponent and the category-selection mode (GDD §4.3).
export const CreateDuelRequestSchema = z
  .object({
    opponentUid: z.string().min(1),
    categoryMode: CategoryModeSchema,
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type CreateDuelRequest = z.infer<typeof CreateDuelRequestSchema>;

export const CreateDuelResponseSchema = z
  .object({ matchId: z.string().min(1) })
  .strict();
export type CreateDuelResponse = z.infer<typeof CreateDuelResponseSchema>;

// --- v1_acceptRematch --------------------------------------------------------
export const AcceptRematchRequestSchema = z
  .object({
    matchId: z.string().min(1),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type AcceptRematchRequest = z.infer<typeof AcceptRematchRequestSchema>;

export const AcceptRematchResponseSchema = z
  .object({ newMatchId: z.string().min(1) })
  .strict();
export type AcceptRematchResponse = z.infer<typeof AcceptRematchResponseSchema>;

// --- v1_startRound -----------------------------------------------------------
// `categoryId` is the player's chosen category on the SECOND call of a pick-mode
// round (GDD §4.3); it must be one of the three offered by the first call. For
// spin/auto modes it is omitted (the server decides).
export const StartRoundRequestSchema = z
  .object({
    matchId: z.string().min(1),
    categoryId: CategorySchema.optional(),
  })
  .strict();
export type StartRoundRequest = z.infer<typeof StartRoundRequestSchema>;

// A round was served: 3 questions for this player. `spinResult` is present only
// for spin mode (the wheel's landing category — outcome decided server-side, the
// animation is theater; doc 07 §2.2).
export const StartRoundServedSchema = z
  .object({
    roundIx: z.number().int().min(0).max(4),
    category: CategorySchema,
    servings: z.array(ServingSchema).length(3),
    spinResult: CategorySchema.optional(),
  })
  .strict();
export type StartRoundServed = z.infer<typeof StartRoundServedSchema>;

// pick mode, first call: the locked 3-category offer the starter must choose from
// (no reroll). The client calls v1_startRound again with the chosen `categoryId`.
export const StartRoundOfferSchema = z
  .object({
    needsPick: z.literal(true),
    roundIx: z.number().int().min(0).max(4),
    offered: z.array(CategorySchema).length(3),
  })
  .strict();
export type StartRoundOffer = z.infer<typeof StartRoundOfferSchema>;

export const StartRoundResponseSchema = z.union([
  StartRoundServedSchema,
  StartRoundOfferSchema,
]);
export type StartRoundResponse = z.infer<typeof StartRoundResponseSchema>;

// --- Round / match resolution payloads --------------------------------------
// These are JSON-serializable projections returned to the client (in the
// v1_submitAnswer response and mirrored into the participant-readable
// `matches/{id}/recaps/{roundIx}` doc — doc 08 §2 reveal rule). The full
// Firestore doc shapes (with Timestamps) live in functions/src/match/types.ts.

// One answered question as shown in the post-reveal recap.
export const RecapAnswerSchema = z
  .object({
    qIx: z.number().int().min(0).max(2),
    difficulty: DifficultySchema,
    correct: z.boolean(),
    points: z.number().int().min(0),
    ms: z.number().int().min(0),
  })
  .strict();
export type RecapAnswer = z.infer<typeof RecapAnswerSchema>;

// One player's full round performance (revealed to both only when both finish).
export const RecapPlayerSchema = z
  .object({
    uid: z.string().min(1),
    score: z.number().int().min(0),
    totalMs: z.number().int().min(0),
    answers: z.array(RecapAnswerSchema).length(3),
  })
  .strict();
export type RecapPlayer = z.infer<typeof RecapPlayerSchema>;

// Result of a single resolved round (GDD §4.1/§4.5). `winner` is always a uid in
// Phase 3 (score, then lower total time breaks a tie); "shared" is reserved for
// the exact points-and-time tie → replay edge handled in Phase 4.
export const RoundResultSchema = z
  .object({
    roundIx: z.number().int().min(0).max(4),
    winner: z.union([z.string().min(1), z.literal("shared")]),
    players: z.array(RecapPlayerSchema).length(2),
  })
  .strict();
export type RoundResult = z.infer<typeof RoundResultSchema>;

// Match outcome (GDD §4.1). finalScore maps uid → rounds won.
export const MatchResultSchema = z
  .object({
    winner: z.string().min(1),
    reason: z.enum(["rounds", "tiebreak", "forfeit", "opponent_deleted"]),
    finalScore: z.record(z.string(), z.number().int().min(0)),
    // Weekly points granted at resolution, per uid (GDD §7). Optional — present
    // from Phase 4b onward (audit + a display hook for the result screen).
    weeklyPointsAwarded: z.record(z.string(), z.number().int().min(0)).optional(),
  })
  .strict();
export type MatchResult = z.infer<typeof MatchResultSchema>;
