// Pure round/match resolution logic (GDD §4.1/§4.5) — no Firebase imports, so it
// is unit-testable without the emulator. Callers supply already-computed totals.

export interface PlayerRoundTotals {
  uid: string;
  score: number;
  totalMs: number;
}

// Round winner = higher total round score; a points tie goes to the lower total
// answer time (GDD §4.5). An exact points-and-time tie returns "shared" — the
// replay-with-fresh-questions edge is handled in Phase 4; until then a shared
// round simply awards no round win to either player.
export function resolveRoundWinner(
  a: PlayerRoundTotals,
  b: PlayerRoundTotals,
): string | "shared" {
  if (a.score !== b.score) return a.score > b.score ? a.uid : b.uid;
  if (a.totalMs !== b.totalMs) return a.totalMs < b.totalMs ? a.uid : b.uid;
  return "shared";
}

// Match winner = first player to reach `roundsToWin` round wins (GDD §4.1).
// Returns the uid, or null if the match is not yet decided.
export function resolveMatchWinner(
  roundWins: Record<string, number>,
  roundsToWin: number,
): string | null {
  for (const [uid, wins] of Object.entries(roundWins)) {
    if (wins >= roundsToWin) return uid;
  }
  return null;
}
