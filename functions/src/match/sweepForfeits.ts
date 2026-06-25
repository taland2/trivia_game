import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import type { Balance } from "../config/balance.js";
import {
  applyWeeklyPoints,
  weeklyPointsForForfeitWin,
  xpForCompletion,
  nextUserXp,
} from "../economy/grants.js";
import { fanOutWeeklyBoards } from "../economy/boards.js";
import { matchListEntryFor, matchListPath } from "./matchList.js";
import type { MatchDoc } from "./types.js";

// Auto-forfeit at 36h of turn inactivity (GDD §4.4). The inactive player (whose
// turn it currently is) loses; the other player wins, gets the flat forfeit
// weekly points + full completion/win XP (a forfeit win is a win — product
// decision Phase 4b). The forfeiter gets nothing.

export interface ForfeitDecision {
  winner: string;
  loser: string;
}

// PURE: decide whether a match is forfeitable at `now`. Returns null unless the
// match is active with an elapsed turn deadline. Testable with no Firestore.
export function decideForfeit(
  match: MatchDoc,
  now: Timestamp,
): ForfeitDecision | null {
  if (match.state !== "active") return null;
  if (match.turnUid === null) return null;
  if (match.turnDeadline === null) return null;
  if (match.turnDeadline.toMillis() > now.toMillis()) return null;
  const loser = match.turnUid;
  const winner = match.players.find((p) => p !== loser);
  if (!winner) return null;
  return { winner, loser };
}

export interface SweepResult {
  scanned: number;
  forfeited: number;
}

// Sweep all expired active matches. Queries the candidates outside any
// transaction (cheap; the in-tx re-read is the authority), then forfeits each in
// its own transaction so a sweep never battles a whole batch at once.
export async function sweepForfeits(
  db: FirebaseFirestore.Firestore,
  now: Timestamp,
  balance: Balance,
): Promise<SweepResult> {
  const snap = await db
    .collection("matches")
    .where("state", "==", "active")
    .where("turnDeadline", "<=", now)
    .get();

  let forfeited = 0;
  for (const doc of snap.docs) {
    const winner = await forfeitMatchTx(db, doc.id, now, balance);
    if (winner) {
      forfeited += 1;
      // Post-commit fan-out (GDD §7): only the winner earned points, so rebuild
      // the winner's friend boards. Best-effort — never fails the sweep.
      await fanOutWeeklyBoards(db, now.toDate(), [winner]).catch((err) => {
        logger.error("fanOutWeeklyBoards failed (forfeit)", { matchId: doc.id, err });
      });
    }
  }
  return { scanned: snap.size, forfeited };
}

// Forfeit a single match transactionally. Returns the winner uid, or null if a
// concurrent submit already finished the match or restamped the deadline (the
// candidate read was stale) — the in-tx re-read of matches/{id} is what guarantees
// exactly-once: if the player's submit commits first it either finishes the match
// or pushes the deadline forward, and this retry then bails. If this commits
// first, the submit hits its own state!=="active" guard.
async function forfeitMatchTx(
  db: FirebaseFirestore.Firestore,
  matchId: string,
  now: Timestamp,
  balance: Balance,
): Promise<string | null> {
  const matchRef = db.doc(`matches/${matchId}`);
  return db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists) return null;
    const match = matchSnap.data() as MatchDoc;

    const decision = decideForfeit(match, now);
    if (!decision || match.result) return null;
    const { winner, loser } = decision;

    // Read the winner's user doc before any write (reads precede writes).
    const winnerRef = db.doc(`users/${winner}`);
    const winnerSnap = await tx.get(winnerRef);
    const winnerXp = (winnerSnap.data()?.["xp"] as number) ?? 0;

    const forfeitPoints = weeklyPointsForForfeitWin(balance);

    match.state = "forfeited";
    match.turnUid = null;
    match.turnDeadline = null;
    match.finishedAt = now;
    match.result = {
      winner,
      reason: "forfeit",
      finalScore: { ...match.roundWins },
      weeklyPointsAwarded: { [winner]: forfeitPoints, [loser]: 0 },
    };

    tx.set(matchRef, match);
    for (const p of match.players) {
      tx.set(
        db.doc(matchListPath(p, matchId)),
        matchListEntryFor(matchId, match, p, now),
      );
    }

    // Economy grants (winner only). Full completion+win XP; flat forfeit points.
    const nowDate = now.toDate();
    applyWeeklyPoints(tx, db, nowDate, winner, forfeitPoints, "forfeitsWon");
    tx.set(
      winnerRef,
      nextUserXp(winnerXp, xpForCompletion(true, balance), balance),
      { merge: true },
    );

    return winner;
  });
}
