import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "../firebase.js";
import {
  SendFriendRequestRequestSchema,
  RespondFriendRequestRequestSchema,
} from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import { loadSocialProfile } from "../user/profile.js";
import { fanOutWeeklyBoards } from "../economy/boards.js";
import {
  createFriendshipTx,
  eitherBlocks,
  isFriendTx,
} from "./friendships.js";

// Friend requests (GDD §10.1: friendships are mutual, request → accept). A
// request is directional: `friendRequests/{from}_{to}`. If the reverse request is
// already pending, a send AUTO-ACCEPTS (both consented), creating the edge
// immediately. Function-written only (guardrail #1).

function requestId(from: string, to: string): string {
  return `${from}_${to}`;
}

// v1_sendFriendRequest({toUid, idempotencyKey}) -> {ok, state}
export const v1_sendFriendRequest = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const from = request.auth.uid;

    const parsed = SendFriendRequestRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Bad request", {
        reason: "invalid-argument",
        field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
    }
    const to = parsed.data.toUid;
    if (to === from) {
      throw new HttpsError("invalid-argument", "Cannot friend yourself", {
        reason: "invalid-argument",
        field: "toUid",
      });
    }

    const db = getFirestore();
    const [target, me] = await Promise.all([
      loadSocialProfile(db, to),
      loadSocialProfile(db, from),
    ]);
    if (target === null) {
      throw new HttpsError("not-found", "User not found", { reason: "user" });
    }
    if (eitherBlocks(me?.blocked ?? [], target.blocked, from, to)) {
      throw new HttpsError("permission-denied", "Blocked", { reason: "blocked" });
    }
    // Denormalize the sender's public identity onto the request — the recipient
    // isn't a friend yet, so they can't read `users/{from}` to show who it's from.
    const fromIdentity = {
      fromName: me?.displayName ?? "",
      fromUsername: me?.username ?? null,
      fromAvatarId: me?.avatarId ?? 0,
    };

    const now = Timestamp.now();
    const iref = idempRef(db, from, parsed.data.idempotencyKey);
    const fwdRef = db.doc(`friendRequests/${requestId(from, to)}`);
    const revRef = db.doc(`friendRequests/${requestId(to, from)}`);

    const result = await db.runTransaction(async (tx) => {
      const cached = await readIdempotent<{ ok: true; state: string }>(tx, iref);
      if (cached !== null) return cached;

      const existed = await isFriendTx(tx, db, from, to);
      if (existed) {
        const res = { ok: true as const, state: "accepted" as const };
        writeIdempotent(tx, iref, res, now);
        return res;
      }

      const rev = await tx.get(revRef);
      if (rev.exists && rev.data()?.["state"] === "pending") {
        // Mutual consent → auto-accept (createFriendship + resolve both requests).
        createFriendshipTx(tx, db, from, to, "search", now, false);
        tx.set(revRef, { state: "accepted" }, { merge: true });
        tx.set(fwdRef, { from, to, state: "accepted", createdAt: now });
        const res = { ok: true as const, state: "accepted" as const };
        writeIdempotent(tx, iref, res, now);
        return { ...res, _autoAccepted: true };
      }

      tx.set(fwdRef, { from, to, state: "pending", createdAt: now, ...fromIdentity });
      const res = { ok: true as const, state: "pending" as const };
      writeIdempotent(tx, iref, res, now);
      return res;
    });

    if ((result as { _autoAccepted?: boolean })._autoAccepted) {
      await fanOutWeeklyBoards(db, now.toDate(), [from, to]).catch((err) => {
        logger.error("fanOutWeeklyBoards failed (auto-accept)", { from, to, err });
      });
    }
    return { ok: result.ok, state: result.state };
  },
);

// v1_respondFriendRequest({requestId, accept, idempotencyKey}) -> {ok, state}
export const v1_respondFriendRequest = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const uid = request.auth.uid;

    const parsed = RespondFriendRequestRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Bad request", {
        reason: "invalid-argument",
        field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
    }
    const { requestId: reqId, accept } = parsed.data;

    const db = getFirestore();
    const now = Timestamp.now();
    const iref = idempRef(db, uid, parsed.data.idempotencyKey);
    const reqRef = db.doc(`friendRequests/${reqId}`);

    const result = await db.runTransaction(async (tx) => {
      const cached = await readIdempotent<{ ok: true; state: string }>(tx, iref);
      if (cached !== null) return cached;

      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new HttpsError("not-found", "Request not found", {
          reason: "friend-request",
        });
      }
      const req = reqSnap.data() as { from: string; to: string; state: string };
      if (req.to !== uid) {
        throw new HttpsError("permission-denied", "Not your request", {
          reason: "not-participant",
        });
      }
      if (req.state !== "pending") {
        const res = { ok: true as const, state: req.state };
        writeIdempotent(tx, iref, res, now);
        return res;
      }

      if (accept) {
        const existed = await isFriendTx(tx, db, req.from, req.to);
        createFriendshipTx(tx, db, req.from, req.to, "search", now, existed);
        tx.set(reqRef, { state: "accepted" }, { merge: true });
        const res = { ok: true as const, state: "accepted" as const };
        writeIdempotent(tx, iref, res, now);
        return { ...res, _from: req.from, _to: req.to };
      }
      tx.set(reqRef, { state: "declined" }, { merge: true });
      const res = { ok: true as const, state: "declined" as const };
      writeIdempotent(tx, iref, res, now);
      return res;
    });

    const r = result as { _from?: string; _to?: string };
    if (r._from && r._to) {
      await fanOutWeeklyBoards(db, now.toDate(), [r._from, r._to]).catch((err) => {
        logger.error("fanOutWeeklyBoards failed (request accept)", { reqId, err });
      });
    }
    return { ok: result.ok, state: result.state };
  },
);
