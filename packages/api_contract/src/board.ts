import { z } from "zod";
import { DayIdSchema } from "./daily.js";

// Read-model projections for the weekly friends leaderboard (GDD §7) and the
// daily friends-today board (doc 07 §2.4, doc 08 §2). All three are written by
// Cloud Functions only (fan-out on each award); clients listen, never write.

// One ranked entry in a player's weekly board (a friend or the player themself).
export const LeaderboardRowSchema = z
  .object({
    uid: z.string(),
    name: z.string(),
    avatarId: z.number().int().min(0),
    level: z.number().int().min(1),
    points: z.number().int().min(0),
    rank: z.number().int().min(1),
  })
  .strict();
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

// `weekly/{weekId}/boards/{uid}` — the viewer's friend-ranked board, kept to ONE
// listened doc per player (doc 06 §10). `rows` is sorted by rank ascending and
// always includes the viewer's own row.
export const WeeklyBoardSchema = z
  .object({
    rows: z.array(LeaderboardRowSchema),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type WeeklyBoard = z.infer<typeof WeeklyBoardSchema>;

// `daily/{dayId}/friendScores/{uid}` — a player's own public daily subset, fanned
// out on completion. Friends gain read access only after they have played today
// (rules `playedAt` gate, GDD §5 anti-spoiler). Carries no question content.
export const FriendScoreSchema = z
  .object({
    uid: z.string(),
    name: z.string(),
    avatarId: z.number().int().min(0),
    dayId: DayIdSchema,
    score: z.number().int().min(0),
    correctCount: z.number().int().min(0).max(10),
    totalMs: z.number().int().min(0),
    playedAt: z.string().datetime(),
  })
  .strict();
export type FriendScore = z.infer<typeof FriendScoreSchema>;
