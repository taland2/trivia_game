import { z } from "zod";
import { IdempotencyKeySchema } from "./common.js";

// v1_sendEmote (GDD §10.2). Emotes are the only player-to-player communication —
// no free text. `emote` is one of the predefined emote KEYS (the allowed set is a
// ⚖️ balance value; the client maps each key to an emoji + localized copy). The
// server validates membership and enforces the per-match send cap, so this is an
// INTEGRITY write through a callable (guardrail #1) — `matches/{id}/emotes/*` is
// function-written, participant-readable.
export const SendEmoteRequestSchema = z
  .object({
    matchId: z.string().min(1),
    // Bounded so a bad client can't store arbitrary blobs even before the
    // set-membership check; the real allow-list lives server-side in balance.
    emote: z.string().min(1).max(32),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type SendEmoteRequest = z.infer<typeof SendEmoteRequestSchema>;

export const SendEmoteResponseSchema = z
  .object({
    sent: z.boolean(),
    // How many emotes the sender may still send in this match (cap - used).
    remaining: z.number().int().min(0),
  })
  .strict();
export type SendEmoteResponse = z.infer<typeof SendEmoteResponseSchema>;

// One emote as stored/read on the match (participant-readable projection). The
// Firestore doc carries a Timestamp `sentAt`; this is the JSON-safe shape.
export const MatchEmoteSchema = z
  .object({
    senderUid: z.string().min(1),
    emote: z.string().min(1).max(32),
    sentAtMs: z.number().int().min(0),
  })
  .strict();
export type MatchEmote = z.infer<typeof MatchEmoteSchema>;
