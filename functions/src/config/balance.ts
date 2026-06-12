import type { Difficulty } from "@trivia/api-contract";

// All ⚖️ balance values (GDD §12) live here and NOWHERE else in the codebase.
// These are the in-code defaults; per-environment values come from Remote Config
// server templates, fetched in getBalance(). Call sites must never inline a number
// that appears in this file (guardrail #4, CLAUDE.md).

export interface DifficultyBalance {
  timeLimitMs: number;
  basePoints: number;
}

export interface Balance {
  difficulties: Record<Difficulty, DifficultyBalance>;
  // Max speed bonus fraction: +50% for an instant answer, decaying linearly to 0
  // at the buzzer (GDD §3.3).
  speedBonusMax: number;
  // Network-delivery grace added server-side to each limit (doc 07 §2.2).
  servingGraceMs: number;
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
};

// TODO(Phase 1+): fetch the Remote Config server template per environment
// (doc 13 §5) with defaultBalance as fallback. Emulator/dev runs use defaults.
export function getBalance(): Balance {
  return defaultBalance;
}
