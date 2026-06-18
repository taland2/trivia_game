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

export interface Balance {
  difficulties: Record<Difficulty, DifficultyBalance>;
  // Max speed bonus fraction: +50% for an instant answer, decaying linearly to 0
  // at the buzzer (GDD §3.3).
  speedBonusMax: number;
  // Network-delivery grace added server-side to each limit (doc 07 §2.2).
  servingGraceMs: number;
  match: MatchBalance;
  concurrency: ConcurrencyBalance;
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
  match: {
    roundsToWin: 3,
    maxRounds: 5,
    roundComposition: ["easy", "medium", "hard"],
  },
  concurrency: {
    maxActiveDuels: 20,
    maxDuelsPerOpponent: 3,
  },
};

// TODO(Phase 1+): fetch the Remote Config server template per environment
// (doc 13 §5) with defaultBalance as fallback. Emulator/dev runs use defaults.
export function getBalance(): Balance {
  return defaultBalance;
}
