import type { Streak } from "@trivia/api-contract";
import { dayAfter } from "./dayId.js";

// Daily streak (GDD §5): consecutive calendar days PLAYED, not won. Pure — the
// caller reads `users/{uid}.streak`, calls this with the day just completed, and
// writes the result back inside the completion transaction.
//
// Rules:
//  - first ever play, or a gap of 2+ days  → streak resets to 1
//  - the day immediately after lastDayId    → streak increments
//  - same day as lastDayId (re-entry)       → unchanged (the daily-already-played
//                                              guard normally prevents this)
export function nextStreak(
  prev: Streak | null | undefined,
  dayId: string,
): Streak {
  if (!prev) return { count: 1, lastDayId: dayId };
  if (prev.lastDayId === dayId) return prev;
  if (dayAfter(prev.lastDayId) === dayId) {
    return { count: prev.count + 1, lastDayId: dayId };
  }
  return { count: 1, lastDayId: dayId };
}
