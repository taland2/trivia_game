import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "../firebase.js";
import { UidTargetRequestSchema } from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import { fanOutWeeklyBoards } from "../economy/boards.js";
import { removeFriendshipTx } from "./friendships.js";
import { cancelMatchesBetween } from "./cancelMatch.js";

// Block / unfriend / unblock (doc 07 §2.1, GDD §10.1/§11, doc 09 §3). `blocked`
// is function-written (never in the rules whitelist). Block hides from search,
// removes the friendship, cancels active matches, and removes the pair from each
// other's leaderboards (the post-commit board fan-out drops the row). Unfriend is
// the same minus the block flag; unblock just clears the flag.

function parseTarget(request: { auth?: { uid: string } }, data: unknown) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;
  const parsed = UidTargetRequestSchema.safeParse(data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  if (parsed.data.uid === uid) {
    throw new HttpsError("invalid-argument", "Cannot target yourself", {
      reason: "invalid-argument",
      field: "uid",
    });
  }
  return { uid, target: parsed.data.uid, idempotencyKey: parsed.data.idempotencyKey };
}

// Drop the friendship row from both viewers' weekly boards + cancel any active
// match between them. Shared post-commit step for block + unfriend.
async function cascadeRemoval(
  db: FirebaseFirestore.Firestore,
  uid: string,
  target: string,
  now: Timestamp,
): Promise<void> {
  await cancelMatchesBetween(db, uid, target, now).catch((err) => {
    logger.error("cancelMatchesBetween failed", { uid, target, err });
  });
  await fanOutWeeklyBoards(db, now.toDate(), [uid, target]).catch((err) => {
    logger.error("fanOutWeeklyBoards failed (removal)", { uid, target, err });
  });
}

export const v1_unfriend = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  const { uid, target, idempotencyKey } = parseTarget(request, request.data);
  const db = getFirestore();
  const now = Timestamp.now();
  const iref = idempRef(db, uid, idempotencyKey);

  await db.runTransaction(async (tx) => {
    const cached = await readIdempotent<{ ok: true }>(tx, iref);
    if (cached !== null) return cached;
    removeFriendshipTx(tx, db, uid, target);
    const res = { ok: true as const };
    writeIdempotent(tx, iref, res, now);
    return res;
  });

  await cascadeRemoval(db, uid, target, now);
  return { ok: true as const };
});

export const v1_block = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  const { uid, target, idempotencyKey } = parseTarget(request, request.data);
  const db = getFirestore();
  const now = Timestamp.now();
  const iref = idempRef(db, uid, idempotencyKey);
  const fwdReq = db.doc(`friendRequests/${uid}_${target}`);
  const revReq = db.doc(`friendRequests/${target}_${uid}`);

  await db.runTransaction(async (tx) => {
    const cached = await readIdempotent<{ ok: true }>(tx, iref);
    if (cached !== null) return cached;

    // Read pending requests (read phase) so we only delete what exists.
    const [fwd, rev] = await Promise.all([tx.get(fwdReq), tx.get(revReq)]);

    tx.set(db.doc(`users/${uid}`), { blocked: FieldValue.arrayUnion(target) }, { merge: true });
    removeFriendshipTx(tx, db, uid, target);
    if (fwd.exists) tx.delete(fwdReq);
    if (rev.exists) tx.delete(revReq);

    const res = { ok: true as const };
    writeIdempotent(tx, iref, res, now);
    return res;
  });

  await cascadeRemoval(db, uid, target, now);
  return { ok: true as const };
});

export const v1_unblock = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  const { uid, target, idempotencyKey } = parseTarget(request, request.data);
  const db = getFirestore();
  const now = Timestamp.now();
  const iref = idempRef(db, uid, idempotencyKey);

  await db.runTransaction(async (tx) => {
    const cached = await readIdempotent<{ ok: true }>(tx, iref);
    if (cached !== null) return cached;
    tx.set(
      db.doc(`users/${uid}`),
      { blocked: FieldValue.arrayRemove(target) },
      { merge: true },
    );
    const res = { ok: true as const };
    writeIdempotent(tx, iref, res, now);
    return res;
  });

  // No friendship restore, no board change (unblock alone changes neither graph
  // membership nor points).
  return { ok: true as const };
});
