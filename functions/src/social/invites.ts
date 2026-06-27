import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "../firebase.js";
import {
  IssueInviteCodeRequestSchema,
  RedeemInviteCodeRequestSchema,
} from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import { loadSocialProfile, loadUserLanguage } from "../user/profile.js";
import { buildDuelMatch, readActiveDuels } from "../match/createDuel.js";
import { writeMatchTx } from "../match/matchList.js";
import { fanOutWeeklyBoards } from "../economy/boards.js";
import { createFriendshipTx, eitherBlocks, isFriendTx } from "./friendships.js";

// Invite codes (doc 07 §2.1, doc 05 §5). A code is a multi-use group link: redeem
// creates a friendship with the issuer + (best-effort) an auto-duel vs the issuer.
// The deep-link DELIVERY (Hosting redirect, install-referrer) is Phase 8b — 8a
// redeems by passing the code string directly (manual entry / QR).

const INVITE_DOMAIN = process.env.INVITE_DOMAIN ?? "trivia.app";
const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// PURE: an 8-char [A-Za-z0-9] code. `rand` is injectable for tests.
export function generateCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  }
  return out;
}

// PURE: has this code been redeemed to its cap?
export function isInviteExhausted(redemptionCount: number, max: number): boolean {
  return redemptionCount >= max;
}

export function inviteLink(code: string): string {
  return `https://${INVITE_DOMAIN}/i/${code}`;
}

// v1_issueInviteCode({idempotencyKey}) -> {code, link}
export const v1_issueInviteCode = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const uid = request.auth.uid;

    const parsed = IssueInviteCodeRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Bad request", {
        reason: "invalid-argument",
        field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
    }

    const db = getFirestore();
    const balance = getBalance();
    const now = Timestamp.now();
    const iref = idempRef(db, uid, parsed.data.idempotencyKey);

    return db.runTransaction(async (tx) => {
      const cached = await readIdempotent<{ code: string; link: string }>(tx, iref);
      if (cached !== null) return cached;

      // Find a free code (read phase). 8 random chars over 62 → collisions ~never.
      let code = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode();
        const snap = await tx.get(db.doc(`invites/${candidate}`));
        if (!snap.exists) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        throw new HttpsError("aborted", "Could not allocate invite code");
      }

      tx.set(db.doc(`invites/${code}`), {
        issuerUid: uid,
        createdAt: now,
        redemptions: [],
        maxRedemptions: balance.social.inviteMaxRedemptions,
      });
      const res = { code, link: inviteLink(code) };
      writeIdempotent(tx, iref, res, now);
      return res;
    });
  },
);

// v1_redeemInviteCode({code, idempotencyKey}) -> {friendUid, autoMatchId?}
export const v1_redeemInviteCode = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const uid = request.auth.uid;

    const parsed = RedeemInviteCodeRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Bad request", {
        reason: "invalid-argument",
        field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
    }
    const code = parsed.data.code;

    const db = getFirestore();
    const balance = getBalance();

    // Preconditions (read outside the txn, like createDuel's language check).
    const inviteSnap = await db.doc(`invites/${code}`).get();
    if (!inviteSnap.exists) {
      throw new HttpsError("not-found", "Invite not found", { reason: "invite-code" });
    }
    const issuer = inviteSnap.data()?.["issuerUid"] as string;
    if (issuer === uid) {
      throw new HttpsError("failed-precondition", "Cannot redeem your own invite", {
        reason: "invite-self",
      });
    }
    const issuerProfile = await loadSocialProfile(db, issuer);
    const myLang = await loadUserLanguage(db, uid);
    const myBlocked = (await loadSocialProfile(db, uid))?.blocked ?? [];
    if (issuerProfile && eitherBlocks(myBlocked, issuerProfile.blocked, uid, issuer)) {
      throw new HttpsError("permission-denied", "Blocked", { reason: "blocked" });
    }
    const sameLanguage =
      myLang !== null && issuerProfile?.language != null && myLang === issuerProfile.language;

    const now = Timestamp.now();
    const matchId = db.collection("matches").doc().id;
    const iref = idempRef(db, uid, parsed.data.idempotencyKey);
    const inviteRef = db.doc(`invites/${code}`);

    const result = await db.runTransaction(async (tx) => {
      const cached = await readIdempotent<{ friendUid: string; autoMatchId?: string }>(
        tx,
        iref,
      );
      if (cached !== null) return cached;

      // Read phase: invite (redemption count), friendship existence, my active duels.
      const invSnap = await tx.get(inviteRef);
      const redemptions =
        (invSnap.data()?.["redemptions"] as Array<{ uid: string }>) ?? [];
      const max =
        (invSnap.data()?.["maxRedemptions"] as number) ??
        balance.social.inviteMaxRedemptions;
      const alreadyRedeemed = redemptions.some((r) => r.uid === uid);
      const existed = await isFriendTx(tx, db, uid, issuer);
      const active = sameLanguage && !existed ? await readActiveDuels(tx, db, uid) : [];

      if (alreadyRedeemed) {
        // Idempotent re-redeem: ensure the edge, no new auto-duel.
        createFriendshipTx(tx, db, uid, issuer, "invite", now, existed);
        const res = { friendUid: issuer };
        writeIdempotent(tx, iref, res, now);
        return res;
      }
      if (isInviteExhausted(redemptions.length, max)) {
        throw new HttpsError("resource-exhausted", "Invite fully used", {
          reason: "invite-exhausted",
        });
      }

      createFriendshipTx(tx, db, uid, issuer, "invite", now, existed);
      tx.set(
        inviteRef,
        { redemptions: FieldValue.arrayUnion({ uid, at: now }) },
        { merge: true },
      );

      // Auto-duel vs the inviter (doc 05 §5) — best-effort: only on a NEW edge,
      // same language, and under the caller's concurrency caps. Skipped silently
      // otherwise; the friendship is created regardless.
      let autoMatchId: string | undefined;
      const underCaps =
        active.length < balance.concurrency.maxActiveDuels &&
        active.filter((e) => e.opponentUid === issuer).length <
          balance.concurrency.maxDuelsPerOpponent;
      if (!existed && sameLanguage && underCaps) {
        const match = buildDuelMatch({
          challenger: issuer, // the inviter challenges ("Dana challenged you!")
          opponent: uid,
          categoryMode: balance.social.autoDuelCategoryMode,
          language: myLang!,
          now,
        });
        writeMatchTx(tx, db, matchId, match, now);
        autoMatchId = matchId;
      }

      const res = autoMatchId
        ? { friendUid: issuer, autoMatchId }
        : { friendUid: issuer };
      writeIdempotent(tx, iref, res, now);
      return res;
    });

    await fanOutWeeklyBoards(db, now.toDate(), [uid, issuer]).catch((err) => {
      logger.error("fanOutWeeklyBoards failed (redeem)", { code, err });
    });
    return result;
  },
);
