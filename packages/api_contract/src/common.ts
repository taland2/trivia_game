import { z } from "zod";

// Difficulty tiers (GDD §3.2). Timer/points values are balance config, not contract.
export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

// Category-selection modes for duels (GDD §4.3).
export const CategoryModeSchema = z.enum(["pick", "spin", "auto"]);
export type CategoryMode = z.infer<typeof CategoryModeSchema>;

// The 8 launch categories (GDD §3.4). Structural, not a ⚖️ balance value. Shared
// here so both the functions engine and the Dart client name them identically.
export const CategorySchema = z.enum([
  "general_knowledge",
  "sports",
  "movies_tv",
  "music",
  "science_tech",
  "history",
  "geography",
  "israel_local",
]);
export type Category = z.infer<typeof CategorySchema>;
export const CATEGORIES = CategorySchema.options;

// Every mutating callable carries a client-generated UUID v4 (doc 07 §1).
export const IdempotencyKeySchema = z.string().uuid();

// Machine-readable error reasons carried in HttpsError details.reason (doc 07 §1).
export const ErrorReasonSchema = z.enum([
  // failed-precondition
  "not-your-turn",
  "match-finished",
  "already-answered",
  "question-expired",
  "daily-already-played",
  "language-mismatch",
  "day-out-of-window",
  "out-of-order",
  // resource-exhausted
  "max-active-duels",
  "max-duels-with-friend",
  "emote-rate-limit",
  // permission-denied
  "not-participant",
  "blocked",
  // not-found
  "match",
  "user",
  "invite-code",
  "daily-unavailable",
]);
export type ErrorReason = z.infer<typeof ErrorReasonSchema>;
