import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { ClaimUsernameRequestSchema } from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import { normalizeUsername, validateUsername } from "./username.js";

// v1_claimUsername (doc 07 §2.1, GDD §10.1). Claims a unique @username; the
// `usernames/{handle}` registry is the uniqueness source of truth, written
// transactionally so two simultaneous claims of the same handle can't both win.
// `users/{uid}.username` is function-written (never in the rules whitelist).
export const v1_claimUsername = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = ClaimUsernameRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const norm = normalizeUsername(parsed.data.username);
  const err = validateUsername(norm);
  if (err === "invalid") {
    throw new HttpsError("invalid-argument", "Invalid username", {
      reason: "invalid-argument",
      field: "username",
    });
  }
  if (err === "profane") {
    throw new HttpsError("failed-precondition", "Username not allowed", {
      reason: "username-profane",
    });
  }

  const db = getFirestore();
  const now = Timestamp.now();
  const iref = idempRef(db, uid, parsed.data.idempotencyKey);

  return db.runTransaction(async (tx) => {
    const cached = await readIdempotent<{ ok: true; username: string }>(tx, iref);
    if (cached !== null) return cached;

    const handleRef = db.doc(`usernames/${norm}`);
    const userRef = db.doc(`users/${uid}`);
    const [handleSnap, userSnap] = await Promise.all([
      tx.get(handleRef),
      tx.get(userRef),
    ]);

    if (handleSnap.exists && handleSnap.data()?.["uid"] !== uid) {
      throw new HttpsError("already-exists", "Username taken", {
        reason: "username-taken",
      });
    }

    const prev = userSnap.data()?.["username"] as string | undefined;
    if (prev && prev !== norm) {
      tx.delete(db.doc(`usernames/${prev}`));
    }
    tx.set(handleRef, { uid });
    tx.set(userRef, { username: norm }, { merge: true });

    const res = { ok: true as const, username: norm };
    writeIdempotent(tx, iref, res, now);
    return res;
  });
});
