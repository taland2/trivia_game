import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { matchListEntryFor, matchListPath } from "../match/matchList.js";
import type { MatchDoc } from "../match/types.js";

// Cancel-on-block/unfriend cascade (GDD §11: an active match between two players
// who unfriend/block is CANCELLED — no points either side). Mirrors the
// sweepForfeits pattern: a PURE decision + an exactly-once transactional applier
// (in-txn re-read guards against a racing submit/forfeit). Unlike a forfeit, a
// cancel awards NOTHING, so there are no economy grants and no board fan-out for
// points (callers still rebuild boards because the friendship row is dropping).

// PURE: is this match cancellable for the pair {a,b}? Active, and its two players
// are exactly that pair. Testable with no Firestore.
export function decideCancel(match: MatchDoc, a: string, b: string): boolean {
  if (match.state !== "active") return false;
  const ps = match.players;
  return ps.includes(a) && ps.includes(b);
}

// Candidate active matches between a and b (cheap: array-contains on one player,
// then in-memory filter — matches per user are capped, so no composite index).
export async function findActiveMatchesBetween(
  db: Firestore,
  a: string,
  b: string,
): Promise<string[]> {
  const snap = await db
    .collection("matches")
    .where("players", "array-contains", a)
    .where("state", "==", "active")
    .get();
  return snap.docs
    .filter((d) => (d.data() as MatchDoc).players.includes(b))
    .map((d) => d.id);
}

// Cancel a single match transactionally. Returns true if it cancelled, false if a
// concurrent write already resolved it (in-txn re-read = exactly-once).
export async function cancelMatchTx(
  db: Firestore,
  matchId: string,
  a: string,
  b: string,
  now: Timestamp,
): Promise<boolean> {
  const matchRef = db.doc(`matches/${matchId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) return false;
    const match = snap.data() as MatchDoc;
    if (match.result || !decideCancel(match, a, b)) return false;

    match.state = "cancelled";
    match.turnUid = null;
    match.turnDeadline = null;
    match.finishedAt = now;
    match.result = null; // GDD §11 — no points either side

    tx.set(matchRef, match);
    for (const p of match.players) {
      tx.set(
        db.doc(matchListPath(p, matchId)),
        matchListEntryFor(matchId, match, p, now),
      );
    }
    return true;
  });
}

// Cancel every active match between a and b. Returns the count cancelled.
export async function cancelMatchesBetween(
  db: Firestore,
  a: string,
  b: string,
  now: Timestamp,
): Promise<number> {
  const ids = await findActiveMatchesBetween(db, a, b);
  let cancelled = 0;
  for (const id of ids) {
    if (await cancelMatchTx(db, id, a, b, now)) cancelled += 1;
  }
  return cancelled;
}
