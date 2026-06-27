import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "../firebase.js";
import { DeleteAccountRequestSchema } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { resolveForfeitWin } from "../match/sweepForfeits.js";
import { fanOutWeeklyBoards } from "../economy/boards.js";
import { friendsOf } from "../economy/boards.js";
import { friendshipPath } from "./friendships.js";
import type { MatchDoc } from "../match/types.js";

// v1_deleteAccount (doc 07 §2.1, doc 09 §4) — MINIMAL for Phase 8a: tombstone +
// the integrity cascades that were deferred FROM Gate A to Phase 8 (account
// deleted mid-match → opponent forfeit win, GDD §11). The full PII hard-wipe +
// match anonymization + data export is Gate C. Not a single transaction: each
// active match forfeits in its own txn (exactly-once via the in-txn re-read),
// then a batch tombstones the profile + drops the friend graph.

// Forfeit one active match in favor of the deleted user's opponent.
async function forfeitForDeletion(
  db: FirebaseFirestore.Firestore,
  matchId: string,
  deletedUid: string,
  now: Timestamp,
  balance: ReturnType<typeof getBalance>,
): Promise<string | null> {
  const matchRef = db.doc(`matches/${matchId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) return null;
    const match = snap.data() as MatchDoc;
    if (match.state !== "active" || match.result) return null;
    const winner = match.players.find((p) => p !== deletedUid);
    if (!winner) return null;

    const winnerSnap = await tx.get(db.doc(`users/${winner}`));
    const winnerXp = (winnerSnap.data()?.["xp"] as number) ?? 0;
    resolveForfeitWin(
      tx, db, matchId, match, winner, deletedUid, winnerXp, "opponent_deleted", now, balance,
    );
    return winner;
  });
}

export const v1_deleteAccount = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = DeleteAccountRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }

  const db = getFirestore();
  const balance = getBalance();
  const now = Timestamp.now();

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { ok: true as const };
  if (userSnap.data()?.["deletedAt"]) return { ok: true as const }; // idempotent

  // 1. Forfeit each active match to the opponent (GDD §11).
  const activeSnap = await db
    .collection("matches")
    .where("players", "array-contains", uid)
    .where("state", "==", "active")
    .get();
  const winners: string[] = [];
  for (const doc of activeSnap.docs) {
    const w = await forfeitForDeletion(db, doc.id, uid, now, balance);
    if (w) winners.push(w);
  }

  // 2. Drop the friend graph + tombstone the profile + release the username.
  const friends = await friendsOf(db, uid);
  const username = userSnap.data()?.["username"] as string | undefined;

  const batch = db.batch();
  for (const f of friends) batch.delete(db.doc(friendshipPath(uid, f)));
  if (username) batch.delete(db.doc(`usernames/${username}`));
  batch.set(
    userRef,
    { deletedAt: now, searchable: false, displayName: "", username: null },
    { merge: true },
  );
  await batch.commit();

  // 3. Rebuild boards for everyone whose standings changed (forfeit winners) or
  // whose friend row vanished (ex-friends). Best-effort.
  const affected = [...new Set([...winners, ...friends])];
  if (affected.length > 0) {
    await fanOutWeeklyBoards(db, now.toDate(), affected).catch((err) => {
      logger.error("fanOutWeeklyBoards failed (deleteAccount)", { uid, err });
    });
  }

  return { ok: true as const };
});
