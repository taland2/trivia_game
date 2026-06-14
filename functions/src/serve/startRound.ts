import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { getBalance } from "../config/balance.js";
import { pickQuestion, shuffleAnswers } from "./questionBank.js";
import type { Serving, Difficulty } from "@trivia/api-contract";

// The 8 categories defined in GDD §3.4.
const CATEGORIES = [
  "general_knowledge",
  "sports",
  "movies_tv",
  "music",
  "science_tech",
  "history",
  "geography",
  "israel_local",
] as const;

// Round composition per GDD §4.1: exactly 1E + 1M + 1H, in escalating order.
const ROUND_DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const v1_startRound = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const data = (request.data ?? {}) as {
    language?: string;
    category?: string;
  };

  // Language defaults to "he" until the language-switch UI arrives in Phase 6.
  const language = typeof data.language === "string" ? data.language : "he";

  // Category: use the provided value or pick one at random (Phase 2 has no pick/spin/auto UI).
  const category =
    typeof data.category === "string" && data.category.length > 0
      ? data.category
      : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]!;

  const db = getFirestore();
  const balance = getBalance();

  // Skeleton matchId — replaced by a real match document in Phase 3.
  const matchId = db.collection("matches").doc().id;
  const roundIx = 0;

  const usedQuestionIds: string[] = [];
  const servings: Serving[] = [];

  for (let qIx = 0; qIx < ROUND_DIFFICULTIES.length; qIx++) {
    const difficulty = ROUND_DIFFICULTIES[qIx]!;
    const { timeLimitMs } = balance.difficulties[difficulty];

    const bankQ = await pickQuestion(db, {
      language,
      category,
      difficulty,
      excludeIds: usedQuestionIds,
    });

    usedQuestionIds.push(bankQ.id);

    // Shuffle answer order per player per serving (GDD §3.1 anti-memorization).
    const shuffled = shuffleAnswers(bankQ);

    const servingId = `${matchId}_${roundIx}_${qIx}`;

    // The correct index after shuffling lives ONLY in servingsPrivate.
    // Firestore security rules deny all client access to this collection.
    await db.doc(`servingsPrivate/${servingId}`).set({
      correctIx: shuffled.correctIx,
      servedAt: Timestamp.now(),
      uid,
      timeLimitMs,
      difficulty,
      questionId: bankQ.id,
    });

    const serving: Serving = {
      servingId,
      qIx,
      difficulty,
      timeLimitMs,
      text: shuffled.text,
      answers: shuffled.answers,
    };
    servings.push(serving);
  }

  return { matchId, roundIx, category, servings };
});
