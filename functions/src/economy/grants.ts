import { FieldValue } from "firebase-admin/firestore";
import type { Balance } from "../config/balance.js";
import { weekId } from "./weekId.js";

// Economy grants (GDD §7 weekly points, §8 XP/levels). Pure formula helpers plus
// thin Firestore appliers. The boards/{uid} friend-ranked projection is DEFERRED
// to Phase 7 (needs friendships); 4b writes only the raw weekly scores/{uid}.
//
// Firestore forbids reads after writes in a transaction. Weekly points are pure
// writes via FieldValue.increment (no read). XP needs the running total to derive
// the level, so the CALLER reads the user doc in its read phase and feeds the
// current xp to nextUserXp(); this module never reads.

export type WeeklyBreakdownKey = "duels" | "dailies" | "forfeitsWon";

// --- Weekly point formulas (GDD §7) --------------------------------------------

// Match win: flat + (match score / divisor), rounded. "Match score" = the sum of
// the player's WINNING-round scores (the caller supplies it from MatchDoc.scoreTotals).
export function weeklyPointsForWin(scoreTotal: number, b: Balance): number {
  return b.weekly.matchWinFlat + Math.round(scoreTotal / b.weekly.scoreDivisor);
}

// Match loss, played to the end: just the score bonus (keeps heavy losers climbing).
export function weeklyPointsForLoss(scoreTotal: number, b: Balance): number {
  return Math.round(scoreTotal / b.weekly.scoreDivisor);
}

// Forfeit win: flat only (GDD §4.4). The forfeiter gets nothing.
export function weeklyPointsForForfeitWin(b: Balance): number {
  return b.weekly.forfeitWinFlat;
}

// --- XP & level (GDD §8) -------------------------------------------------------

export function xpForSubmit(correct: boolean, b: Balance): number {
  return correct ? b.xp.perCorrect : 0;
}

// Completed match: base for both players, plus the win bonus for the winner.
export function xpForCompletion(isWinner: boolean, b: Balance): number {
  return b.xp.matchCompleted + (isWinner ? b.xp.matchWin : 0);
}

// Level for a given total XP. Inverts "XP to reach level n = base × n^exponent":
// level = floor((xp / base)^(1/exponent)), with a floor of 1 (everyone is L1).
export function levelForXp(xp: number, b: Balance): number {
  if (xp <= 0) return 1;
  const n = Math.floor((xp / b.levelCurve.base) ** (1 / b.levelCurve.exponent));
  return Math.max(1, n);
}

// New {xp, level} after adding deltaXp to a player's current total. Pure — the
// caller writes it (tx.set(userRef, ..., {merge:true})).
export function nextUserXp(
  currentXp: number,
  deltaXp: number,
  b: Balance,
): { xp: number; level: number } {
  const xp = currentXp + deltaXp;
  return { xp, level: levelForXp(xp, b) };
}

// --- Firestore paths + appliers ------------------------------------------------

export function weeklyScorePath(week: string, uid: string): string {
  return `weekly/${week}/scores/${uid}`;
}

// Increment a player's weekly points and the matching breakdown bucket. Pure
// write (no read) via FieldValue.increment, safe to call at the end of a txn.
export function applyWeeklyPoints(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  now: Date,
  uid: string,
  points: number,
  key: WeeklyBreakdownKey,
): void {
  if (points <= 0) return;
  const ref = db.doc(weeklyScorePath(weekId(now), uid));
  tx.set(
    ref,
    {
      points: FieldValue.increment(points),
      breakdown: { [key]: FieldValue.increment(points) },
    },
    { merge: true },
  );
}
