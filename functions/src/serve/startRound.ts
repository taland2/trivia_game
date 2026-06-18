import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "../firebase.js";
import { getBalance } from "../config/balance.js";
import {
  StartRoundRequestSchema,
  type Category,
  type Difficulty,
  type StartRoundResponse,
} from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import { loadQuestions, pickRoundQuestions, type BankQuestion } from "./questionBank.js";
import {
  chooseAutoCategory,
  chooseSpinCategory,
  offerPickCategories,
} from "./selectCategory.js";
import { serveRoundForPlayer, loadServedRound } from "./roundServing.js";
import type { MatchDoc, RoundDoc } from "../match/types.js";

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
  const { matchId, categoryId } = parsed.data;

  const db = getFirestore();
  const balance = getBalance();
  const composition = balance.match.roundComposition;

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
  const matchRef = db.doc(`matches/${matchId}`);
  const roundRef = db.doc(`matches/${matchId}/rounds/${roundIx}`);
  const roundSnap = await roundRef.get();
  const round = roundSnap.exists ? (roundSnap.data() as RoundDoc) : null;
  const attempt = round?.attempt ?? 0;

  // Resolve this round's category + questions. Some pick-mode branches return a
  // locked offer instead of serving; the rest fall through to a single serve.
  let category: Category;
  let questions: BankQuestion[];
  let serveAttempt = attempt;

  if (round?.needsReplay) {
    // Tie replay (GDD §4.5): re-deal fresh questions at the same roundIx, same
    // category. Only the starter reaches here (turn was flipped back on the tie).
    // Checked BEFORE the idempotent-serve guard below: the starter WAS served at
    // the tied attempt, so that guard would otherwise return the stale servings.
    serveAttempt = attempt + 1;
    category = round.category as Category;
    questions = await pickRoundQuestions(db, {
      language: match.language,
      category,
      composition,
    });
    await roundRef.set({
      ...round,
      questionIds: questions.map((q) => q.id),
      difficulties: questions.map((q) => q.difficulty),
      perPlayer: {},
      winner: null,
      isTiebreaker: true,
      needsReplay: false,
      attempt: serveAttempt,
    } satisfies RoundDoc);
    const servings = await serveRoundForPlayer(db, {
      matchId,
      roundIx,
      uid,
      questions,
      attempt: serveAttempt,
    });
    return served(roundIx, category, servings, match);
  }

  // Idempotent replay: a player already served this round (at the current attempt)
  // gets the identical servings without resetting the scoring clock (anti-cheat).
  const alreadyServed = await loadServedRound(db, {
    matchId,
    roundIx,
    uid,
    attempt,
    count: composition.length,
  });
  if (alreadyServed) {
    return served(roundIx, round!.category as Category, alreadyServed, match);
  }

  if (round && round.questionIds.length > 0) {
    // Round already locked (the opponent's turn, or the starter re-entering
    // before answering): reuse the locked questions (GDD §4.1).
    category = round.category as Category;
    questions = await loadQuestions(db, round.questionIds);
  } else if (round?.offeredCategories) {
    // pick mode, second call: the starter chooses from the locked offer.
    if (!categoryId) {
      return { needsPick: true, roundIx, offered: round.offeredCategories as Category[] };
    }
    if (!round.offeredCategories.includes(categoryId)) {
      throw new HttpsError("invalid-argument", "Category not on offer", {
        reason: "invalid-argument",
        field: "categoryId",
      });
    }
    category = categoryId;
    questions = await lockCategory(db, matchRef, roundRef, round, match, category, composition);
  } else {
    // First entry to this round by the starter.
    if (match.categoryMode === "pick") {
      const offered = offerPickCategories(match.usedCategories);
      await roundRef.set(emptyRound(match, roundIx, { offeredCategories: offered }));
      return { needsPick: true, roundIx, offered };
    }
    category =
      match.categoryMode === "spin"
        ? chooseSpinCategory()
        : chooseAutoCategory(match.usedCategories);
    questions = await lockCategory(
      db,
      matchRef,
      roundRef,
      emptyRound(match, roundIx, {}),
      match,
      category,
      composition,
    );
  }

  const servings = await serveRoundForPlayer(db, {
    matchId,
    roundIx,
    uid,
    questions,
    attempt: serveAttempt,
  });
  return served(roundIx, category, servings, match);
});

// A round doc with no questions locked yet (pick-offer pending, or the scaffold
// the spin/auto path immediately fills via lockCategory).
function emptyRound(
  match: MatchDoc,
  roundIx: number,
  over: Partial<RoundDoc>,
): RoundDoc {
  return {
    category: "",
    questionIds: [],
    difficulties: [],
    starterUid: match.players[roundIx % 2]!,
    perPlayer: {},
    winner: null,
    isTiebreaker: false,
    offeredCategories: null,
    attempt: 0,
    needsReplay: false,
    ...over,
  };
}

// Lock a round's category + questions (GDD §4.1) and record the category against
// the match's no-repeat history (used by auto mode, harmless for the others).
async function lockCategory(
  db: FirebaseFirestore.Firestore,
  matchRef: FirebaseFirestore.DocumentReference,
  roundRef: FirebaseFirestore.DocumentReference,
  round: RoundDoc,
  match: MatchDoc,
  category: Category,
  composition: Difficulty[],
): Promise<BankQuestion[]> {
  const questions = await pickRoundQuestions(db, {
    language: match.language,
    category,
    composition,
  });
  await roundRef.set({
    ...round,
    category,
    questionIds: questions.map((q) => q.id),
    difficulties: questions.map((q) => q.difficulty),
    offeredCategories: null,
  } satisfies RoundDoc);
  await matchRef.update({ usedCategories: [...match.usedCategories, category] });
  return questions;
}

// Shape the served response, attaching spinResult only for spin mode (the wheel's
// landing — outcome server-decided, animation is theater; doc 07 §2.2).
function served(
  roundIx: number,
  category: Category,
  servings: Awaited<ReturnType<typeof serveRoundForPlayer>>,
  match: MatchDoc,
): Extract<StartRoundResponse, { servings: unknown }> {
  return {
    roundIx,
    category,
    servings,
    ...(match.categoryMode === "spin" ? { spinResult: category } : {}),
  };
}
