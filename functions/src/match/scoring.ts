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
  // Total awarded = basePoints + speedBonus (always holds; both are 0 on a miss).
  points: number;
  // Flat base for the difficulty, awarded for any correct in-time answer.
  basePoints: number;
  // Speed bonus on top of the base (decays to 0 at the buzzer). 0 on a miss.
  speedBonus: number;
  timedOut: boolean;
}

export function scoreAnswer(input: ScoringInput): ScoringResult {
  const { correct, elapsedMs, timeLimitMs, graceMs, basePoints, speedBonusMax } =
    input;

  const timedOut = elapsedMs > timeLimitMs + graceMs;
  if (!correct || timedOut) {
    return { points: 0, basePoints: 0, speedBonus: 0, timedOut };
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
  // The fly-up shows the real split (H6); the server is the only source of truth
  // for it. points = basePoints + speedBonus is the invariant the client trusts.
  return { points, basePoints, speedBonus: points - basePoints, timedOut: false };
}
