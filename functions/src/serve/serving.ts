import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { Serving } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { shuffleAnswers, type BankQuestion } from "./questionBank.js";

// Shared per-player serving machinery for the duel (roundServing) and the daily
// challenge (dailyServing). Questions are locked per round/set, but the answer
// order is shuffled INDEPENDENTLY per player (GDD §3.1), so each player gets their
// own servingsPrivate docs. This is also the anti-cheat boundary — `correctIx`
// lives here (function-only) and never reaches the client (guardrail #2) — and the
// scoring clock (`servedAt`) is immutable once written, so a resume returns the
// identical shuffle without resetting it. Callers differ only in how a serving is
// keyed and what context fields they stamp onto the private doc; everything else
// (the shuffle, the private-doc shape, the getAll-based resume) is shared here.

// Serve a list of bank questions to one player. `servingIdFor(qIx)` names each
// serving + its servingsPrivate doc; `context` (e.g. {matchId, roundIx} or
// {dayId}) is merged into the private doc for auditing. Returns the client-facing
// servings. Must NOT be called when servings already exist — the caller guards
// that (loadServedQuestions) to keep `servedAt` stable.
export async function servePlayerQuestions(
  db: Firestore,
  opts: {
    uid: string;
    questions: BankQuestion[];
    servingIdFor: (qIx: number) => string;
    context: Record<string, unknown>;
  },
): Promise<Serving[]> {
  const { uid, questions, servingIdFor, context } = opts;
  const balance = getBalance();
  const now = Timestamp.now();

  const servings: Serving[] = [];
  const batch = db.batch();

  for (let qIx = 0; qIx < questions.length; qIx++) {
    const bankQ = questions[qIx]!;
    const { timeLimitMs } = balance.difficulties[bankQ.difficulty];
    const shuffled = shuffleAnswers(bankQ);

    const serving: Serving = {
      servingId: servingIdFor(qIx),
      qIx,
      difficulty: bankQ.difficulty,
      timeLimitMs,
      text: shuffled.text,
      answers: shuffled.answers,
    };

    // The private doc stores the answer key plus the exact public payload so a
    // repeat start returns the identical serving without re-shuffling or
    // resetting the clock. Rules deny all client access to servingsPrivate.
    batch.set(db.doc(`servingsPrivate/${serving.servingId}`), {
      correctIx: shuffled.correctIx,
      questionId: bankQ.id,
      servedAt: now,
      answeredAt: null,
      uid,
      qIx,
      difficulty: bankQ.difficulty,
      timeLimitMs,
      serving,
      ...context,
    });

    servings.push(serving);
  }

  await batch.commit();
  return servings;
}

// Rebuild a player's already-served set from servingsPrivate (idempotent resume).
// Returns null if any of the `count` servings is missing.
export async function loadServedQuestions(
  db: Firestore,
  opts: { servingIdFor: (qIx: number) => string; count: number },
): Promise<Serving[] | null> {
  const { servingIdFor, count } = opts;
  const refs = Array.from({ length: count }, (_, qIx) =>
    db.doc(`servingsPrivate/${servingIdFor(qIx)}`),
  );
  const snaps = await db.getAll(...refs);
  if (snaps.some((s) => !s.exists)) return null;
  return snaps.map((s) => s.data()!["serving"] as Serving);
}
