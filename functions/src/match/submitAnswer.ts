import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { SubmitAnswerRequestSchema } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { scoreAnswer } from "./scoring.js";
import type { Difficulty } from "@trivia/api-contract";

export const v1_submitAnswer = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  // Validate the request against the shared api_contract schema.
  const parsed = SubmitAnswerRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const { matchId, roundIx, qIx, answerIx, idempotencyKey } = parsed.data;

  const db = getFirestore();

  // Idempotency: return the cached result if this key was already processed.
  const idempKey = `${uid}_${idempotencyKey}`;
  const idempDoc = await db.doc(`idempotency/${idempKey}`).get();
  if (idempDoc.exists) return idempDoc.data()!["result"];

  // Locate the private serving doc (written by v1_serveQuestion).
  const servingKey = `${matchId}_${roundIx}_${qIx}`;
  const privateDoc = await db.doc(`servingsPrivate/${servingKey}`).get();
  if (!privateDoc.exists) {
    throw new HttpsError("not-found", "Serving not found", { reason: "match" });
  }
  const priv = privateDoc.data()!;

  // Guard: this serving belongs to the authenticated user.
  if (priv["uid"] !== uid) {
    throw new HttpsError("permission-denied", "Not your serving", {
      reason: "not-participant",
    });
  }

  const servedAt = priv["servedAt"] as Timestamp;
  const timeLimitMs = priv["timeLimitMs"] as number;
  const correctIx = priv["correctIx"] as number;
  const difficulty = priv["difficulty"] as Difficulty;

  // Server-authoritative elapsed time (doc 06 §4 — client times are display-only).
  const elapsedMs = Timestamp.now().toMillis() - servedAt.toMillis();

  const balance = getBalance();
  const { basePoints } = balance.difficulties[difficulty];

  const { points } = scoreAnswer({
    correct: answerIx === correctIx,
    elapsedMs,
    timeLimitMs,
    graceMs: balance.servingGraceMs,
    basePoints,
    speedBonusMax: balance.speedBonusMax,
  });

  const result = { correctIx, points, roundDone: true };

  // Cache for idempotent replays. TTL cleanup arrives in Phase 4.
  await db
    .doc(`idempotency/${idempKey}`)
    .set({ result, createdAt: Timestamp.now() });

  return result;
});
