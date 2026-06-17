import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "../firebase.js";
import { getBalance } from "../config/balance.js";
import { StartRoundRequestSchema } from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import { pickQuestion, loadQuestions, type BankQuestion } from "./questionBank.js";
import { serveRoundForPlayer, loadServedRound } from "./roundServing.js";
import type { MatchDoc, RoundDoc } from "../match/types.js";

// The 8 categories (GDD §3.4) — structural, not a ⚖️ balance value.
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

export const v1_startRound = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = StartRoundRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const { matchId } = parsed.data;

  const db = getFirestore();
  const balance = getBalance();

  const matchSnap = await db.doc(`matches/${matchId}`).get();
  if (!matchSnap.exists) {
    throw new HttpsError("not-found", "Match not found", { reason: "match" });
  }
  const match = matchSnap.data() as MatchDoc;

  if (!match.players.includes(uid)) {
    throw new HttpsError("permission-denied", "Not a participant", {
      reason: "not-participant",
    });
  }
  if (match.state !== "active") {
    throw new HttpsError("failed-precondition", "Match is over", {
      reason: "match-finished",
    });
  }
  if (match.turnUid !== uid) {
    throw new HttpsError("failed-precondition", "Not your turn", {
      reason: "not-your-turn",
    });
  }

  const roundIx = match.currentRound;
  const composition = balance.match.roundComposition;
  const roundRef = db.doc(`matches/${matchId}/rounds/${roundIx}`);

  // Idempotent replay: if this player was already served this round, return the
  // identical servings without resetting the scoring clock (anti-cheat).
  const alreadyServed = await loadServedRound(db, {
    matchId,
    roundIx,
    uid,
    count: composition.length,
  });
  if (alreadyServed) {
    const round = (await roundRef.get()).data() as RoundDoc;
    return { roundIx, category: round.category, servings: alreadyServed };
  }

  // Lock questions on first serve (GDD §4.1); the second player reuses them.
  const roundSnap = await roundRef.get();
  let category: string;
  let questions: BankQuestion[];

  if (roundSnap.exists) {
    const round = roundSnap.data() as RoundDoc;
    category = round.category;
    questions = await loadQuestions(db, round.questionIds);
  } else {
    // Phase 3: a single random category per round. Modes pick/spin/auto land in
    // Phase 4; until then `categoryId` from the request is ignored.
    category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]!;
    const used: string[] = [];
    questions = [];
    for (const difficulty of composition) {
      const q = await pickQuestion(db, {
        language: match.language,
        category,
        difficulty,
        excludeIds: used,
      });
      used.push(q.id);
      questions.push(q);
    }

    const round: RoundDoc = {
      category,
      questionIds: questions.map((q) => q.id),
      difficulties: questions.map((q) => q.difficulty),
      starterUid: match.players[roundIx % 2]!,
      perPlayer: {},
      winner: null,
      isTiebreaker: false,
    };
    await roundRef.set(round);
  }

  const servings = await serveRoundForPlayer(db, {
    matchId,
    roundIx,
    uid,
    questions,
  });

  return { roundIx, category, servings };
});
