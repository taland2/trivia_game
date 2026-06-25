import type { Difficulty } from "@trivia/api-contract";

// All ⚖️ balance values (GDD §12) live here and NOWHERE else in the codebase.
// These are the in-code defaults; per-environment values come from Remote Config
// server templates, fetched in getBalance(). Call sites must never inline a number
// that appears in this file (guardrail #4, CLAUDE.md).

export interface DifficultyBalance {
  timeLimitMs: number;
  basePoints: number;
}

// Match-structure balance (GDD §4.1 ⚖️).
export interface MatchBalance {
  // Round wins needed to take the match (best-of-5 → 3).
  roundsToWin: number;
  // Hard cap on rounds played (best-of-5 → 5).
  maxRounds: number;
  // Question composition per round, in serve order (1 Easy + 1 Medium + 1 Hard).
  roundComposition: Difficulty[];
}

// Concurrency caps (GDD §4.6 ⚖️).
export interface ConcurrencyBalance {
  // Max simultaneously active duels one player may hold.
  maxActiveDuels: number;
  // Max simultaneously active duels against a single opponent (anti-spam).
  maxDuelsPerOpponent: number;
}

// Weekly friends-leaderboard point formulas (GDD §7 ⚖️).
export interface WeeklyBalance {
  // Flat points for a match win, before the score bonus (win = flat + score/divisor).
  matchWinFlat: number;
  // Divisor applied to a player's "match score" for the points bonus.
  scoreDivisor: number;
  // Flat points for winning by opponent forfeit (loser gets none).
  forfeitWinFlat: number;
}

// XP & level-curve values (GDD §8 ⚖️).
export interface XpBalance {
  // XP per correct answer (awarded on every submit).
  perCorrect: number;
  // XP for completing a match (both players, on resolution).
  matchCompleted: number;
  // Bonus XP for the match winner, on top of matchCompleted.
  matchWin: number;
  // XP for completing the daily challenge (GDD §8 — +25).
  dailyCompleted: number;
}

// Daily Challenge balance (GDD §5 ⚖️).
export interface DailyBalance {
  // Question composition for the daily set, in serve order. Length = the daily's
  // question count (GDD §5 — 3 Easy + 4 Medium + 3 Hard = 10). The curation/seed
  // step builds each dailySet to this spec; the serve/submit path reads the count.
  composition: Difficulty[];
  // Sanity window for the client-claimed local `dayId` (GDD §5): the server accepts
  // a dayId whose UTC day-span is within ±windowMs of the server instant, covering
  // every legitimate device timezone (UTC-12 .. UTC+14). ±14h.
  windowMs: number;
}

export interface LevelCurveBalance {
  // XP to reach level n = base × n^exponent (GDD §8).
  base: number;
  exponent: number;
}

// Communication: predefined emotes/taunts (GDD §10.2 ⚖️). The set is identifier
// KEYS, not display strings — the client maps each to an emoji + per-language copy
// (no free text, humor copy localized per GDD §10.2 / doc 04 §7). The server only
// validates membership and enforces the per-match send cap.
export interface EmoteBalance {
  // Allowed emote keys. Length is the ⚖️ "8 predefined emotes" of GDD §10.2.
  set: string[];
  // Max emotes one player may send in a single match (GDD §10.2 ⚖️).
  perMatch: number;
}

export interface Balance {
  difficulties: Record<Difficulty, DifficultyBalance>;
  // Max speed bonus fraction: +50% for an instant answer, decaying linearly to 0
  // at the buzzer (GDD §3.3).
  speedBonusMax: number;
  // Network-delivery grace added server-side to each limit (doc 07 §2.2).
  servingGraceMs: number;
  // Auto-forfeit window: a turn left un-played this long is swept (GDD §4.4).
  turnDeadlineMs: number;
  match: MatchBalance;
  concurrency: ConcurrencyBalance;
  weekly: WeeklyBalance;
  xp: XpBalance;
  levelCurve: LevelCurveBalance;
  emotes: EmoteBalance;
  daily: DailyBalance;
}

// GDD §3.2 / §3.3 initial values.
export const defaultBalance: Balance = {
  difficulties: {
    easy: { timeLimitMs: 10_000, basePoints: 100 },
    medium: { timeLimitMs: 15_000, basePoints: 150 },
    hard: { timeLimitMs: 20_000, basePoints: 200 },
  },
  speedBonusMax: 0.5,
  servingGraceMs: 1_500,
  turnDeadlineMs: 36 * 60 * 60 * 1000, // 36h auto-forfeit (GDD §4.4)
  match: {
    roundsToWin: 3,
    maxRounds: 5,
    roundComposition: ["easy", "medium", "hard"],
  },
  concurrency: {
    maxActiveDuels: 20,
    maxDuelsPerOpponent: 3,
  },
  weekly: {
    matchWinFlat: 100,
    scoreDivisor: 100,
    forfeitWinFlat: 100,
  },
  xp: {
    perCorrect: 2,
    matchCompleted: 20,
    matchWin: 30,
    dailyCompleted: 25,
  },
  levelCurve: {
    base: 100,
    exponent: 1.5,
  },
  emotes: {
    // 8 predefined emote keys (GDD §10.2). The client localizes each.
    set: ["laugh", "fire", "revenge", "lucky", "wow", "clap", "gg", "think"],
    perMatch: 3,
  },
  daily: {
    // 3 Easy + 4 Medium + 3 Hard = 10 questions (GDD §5).
    composition: [
      "easy",
      "easy",
      "easy",
      "medium",
      "medium",
      "medium",
      "medium",
      "hard",
      "hard",
      "hard",
    ],
    windowMs: 14 * 60 * 60 * 1000, // ±14h device-timezone sanity window (GDD §5)
  },
};

// TODO(Phase 1+): fetch the Remote Config server template per environment
// (doc 13 §5) with defaultBalance as fallback. Emulator/dev runs use defaults.
export function getBalance(): Balance {
  return defaultBalance;
}
