import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { getBalance } from "../config/balance.js";
import type { Serving } from "@trivia/api-contract";

// Phase 1 hardcoded seed question. Replaced by the real serving engine in Phase 2.
const SEED = {
  text: "מהי בירת ישראל?",
  answers: ["ירושלים", "תל אביב", "חיפה", "באר שבע"],
  correctIx: 0,
  difficulty: "easy" as const,
};

export const v1_serveQuestion = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;
  const db = getFirestore();
  const balance = getBalance();
  const { timeLimitMs } = balance.difficulties[SEED.difficulty];

  // Generate a skeleton matchId (real match documents arrive in Phase 3).
  const matchId = db.collection("matches").doc().id;
  const servingKey = `${matchId}_0_0`;

  // Store the hidden answer in a function-only collection.
  // Firestore rules deny all client access to servingsPrivate/**.
  await db.doc(`servingsPrivate/${servingKey}`).set({
    correctIx: SEED.correctIx,
    servedAt: Timestamp.now(),
    uid,
    timeLimitMs,
    difficulty: SEED.difficulty,
  });

  const serving: Serving = {
    servingId: servingKey,
    qIx: 0,
    difficulty: SEED.difficulty,
    timeLimitMs,
    text: SEED.text,
    answers: SEED.answers,
  };

  return { matchId, serving };
});
