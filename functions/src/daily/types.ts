import type { Timestamp } from "firebase-admin/firestore";

// Firestore doc shapes for the daily challenge (doc 08 Daily section). The
// client-facing JSON projections live in packages/api_contract/src/daily.ts.

// One recorded daily answer (mirrors the duel round answer shape).
export interface DailyAnswer {
  qIx: number;
  answerIx: number | null;
  correct: boolean;
  points: number;
  ms: number;
}

// `dailyPlays/{uid}_{dayId}` — the player's own daily progress + result.
// Owner-readable (rules); the public friends-today subset is fanned out to
// `daily/{dayId}/friendScores/{uid}` in Phase 7b.
export interface DailyPlayDoc {
  dayId: string;
  uid: string;
  answers: DailyAnswer[];
  score: number;
  correctCount: number;
  totalMs: number;
  finishedAt: Timestamp | null;
  streakAfter: number | null;
  startedAt: Timestamp;
}

export function dailyPlayPath(uid: string, dayId: string): string {
  return `dailyPlays/${uid}_${dayId}`;
}
