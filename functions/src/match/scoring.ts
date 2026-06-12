// Scoring engine (GDD §3.3) — pure domain logic, no Firebase imports (doc 06 §1
// lock-in mitigation). All timing inputs are SERVER timestamps: elapsedMs is
// receive_ts - serve_ts as measured by the server (doc 06 §4); client-reported
// times never reach this function.

export interface ScoringInput {
  // False when the answer was wrong OR no answer arrived (timeout).
  correct: boolean;
  // Server-measured ms between serving write and submission receipt.
  elapsedMs: number;
  timeLimitMs: number;
  // Grace covers network delivery (doc 07 §2.2): an answer arriving within
  // timeLimitMs + graceMs still counts, but earns no speed bonus past the buzzer.
  graceMs: number;
  basePoints: number;
  speedBonusMax: number;
}

export interface ScoringResult {
  points: number;
  timedOut: boolean;
}

export function scoreAnswer(input: ScoringInput): ScoringResult {
  const { correct, elapsedMs, timeLimitMs, graceMs, basePoints, speedBonusMax } =
    input;

  const timedOut = elapsedMs > timeLimitMs + graceMs;
  if (!correct || timedOut) {
    return { points: 0, timedOut };
  }

  // Bonus decays linearly to 0 at the visible buzzer; the grace window earns
  // base points only. Clamp also guards elapsedMs < 0 (clock skew bugs).
  const timeRemainingMs = Math.min(
    Math.max(timeLimitMs - elapsedMs, 0),
    timeLimitMs,
  );
  const points = Math.round(
    basePoints * (1 + speedBonusMax * (timeRemainingMs / timeLimitMs)),
  );
  return { points, timedOut: false };
}
