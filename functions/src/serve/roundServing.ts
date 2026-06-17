import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { Serving } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { shuffleAnswers, type BankQuestion } from "./questionBank.js";

// Per-player serving key: questions are locked per round but the answer order is
// shuffled independently per player (GDD §3.1), so each player gets their own
// servingsPrivate docs. This is also the anti-cheat boundary — `correctIx` lives
// here (function-only) and never reaches the client (guardrail #2).
export function servingKey(
  matchId: string,
  roundIx: number,
  qIx: number,
  uid: string,
): string {
  return `${matchId}_${roundIx}_${qIx}_${uid}`;
}

// Serve a round's 3 questions to one player: shuffle answers, write the private
// docs (correctIx + the public payload, for idempotent replay), and return the
// client-facing servings. `questions` are the locked bank questions in serve
// order (1E/1M/1H). Re-serving must NOT be called when servings already exist —
// startRound guards that to keep `servedAt` (the scoring clock) stable.
export async function serveRoundForPlayer(
  db: Firestore,
  opts: {
    matchId: string;
    roundIx: number;
    uid: string;
    questions: BankQuestion[];
  },
): Promise<Serving[]> {
  const { matchId, roundIx, uid, questions } = opts;
  const balance = getBalance();
  const now = Timestamp.now();

  const servings: Serving[] = [];
  const batch = db.batch();

  for (let qIx = 0; qIx < questions.length; qIx++) {
    const bankQ = questions[qIx]!;
    const { timeLimitMs } = balance.difficulties[bankQ.difficulty];
    const shuffled = shuffleAnswers(bankQ);

    const serving: Serving = {
      servingId: servingKey(matchId, roundIx, qIx, uid),
      qIx,
      difficulty: bankQ.difficulty,
      timeLimitMs,
      text: shuffled.text,
      answers: shuffled.answers,
    };

    // The private doc stores the answer key plus the public payload so a repeat
    // startRound returns the identical serving without re-shuffling or resetting
    // the clock. Rules deny all client access to servingsPrivate.
    batch.set(db.doc(`servingsPrivate/${serving.servingId}`), {
      correctIx: shuffled.correctIx,
      questionId: bankQ.id,
      servedAt: now,
      answeredAt: null,
      uid,
      matchId,
      roundIx,
      qIx,
      difficulty: bankQ.difficulty,
      timeLimitMs,
      serving,
    });

    servings.push(serving);
  }

  await batch.commit();
  return servings;
}

// Rebuild a player's already-served round from servingsPrivate (idempotent
// startRound replay). Returns null if the player has not been served this round.
export async function loadServedRound(
  db: Firestore,
  opts: { matchId: string; roundIx: number; uid: string; count: number },
): Promise<Serving[] | null> {
  const { matchId, roundIx, uid, count } = opts;
  const refs = Array.from({ length: count }, (_, qIx) =>
    db.doc(`servingsPrivate/${servingKey(matchId, roundIx, qIx, uid)}`),
  );
  const snaps = await db.getAll(...refs);
  if (snaps.some((s) => !s.exists)) return null;
  return snaps.map((s) => s.data()!["serving"] as Serving);
}
