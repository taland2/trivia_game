import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { Serving } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { shuffleAnswers, loadQuestions, type BankQuestion } from "../serve/questionBank.js";

// Daily-challenge serving (GDD §5), mirroring the duel's roundServing: the daily
// SET (questionIds) is global, but answer order is shuffled per player (anti-
// memorization / anti-screenshot, GDD §3.1), so each player gets their own
// servingsPrivate docs. `correctIx` lives there (function-only) and never reaches
// the client (guardrail #2). The serving clock (`servedAt`) is immutable once set.

// The daily set is the SAME dated quiz worldwide, served in the player's language
// (GDD §5). `questionIds` is keyed by language: each language's array is that
// language's version of the 10 questions. (Phase 10's content pipeline pairs them
// by concept_id; the dev seeder fills both from the dev-seed bank.)
export interface DailySetDoc {
  questionIds: Record<string, string[]>;
  publishAt?: unknown;
}

export function dailyServingKey(dayId: string, qIx: number, uid: string): string {
  return `daily_${dayId}_${qIx}_${uid}`;
}

// Load a published daily set's question ids in order, or null if not seeded.
export async function loadDailySet(
  db: Firestore,
  dayId: string,
): Promise<DailySetDoc | null> {
  const snap = await db.doc(`dailySets/${dayId}`).get();
  if (!snap.exists) return null;
  return snap.data() as DailySetDoc;
}

// Serve a daily set's questions to one player: shuffle answers, write the private
// docs (correctIx + the public payload, for idempotent resume), return the
// client-facing servings. `questions` are the set's bank questions in set order.
export async function serveDailyForPlayer(
  db: Firestore,
  opts: { dayId: string; uid: string; questions: BankQuestion[] },
): Promise<Serving[]> {
  const { dayId, uid, questions } = opts;
  const balance = getBalance();
  const now = Timestamp.now();

  const servings: Serving[] = [];
  const batch = db.batch();

  for (let qIx = 0; qIx < questions.length; qIx++) {
    const bankQ = questions[qIx]!;
    const { timeLimitMs } = balance.difficulties[bankQ.difficulty];
    const shuffled = shuffleAnswers(bankQ);

    const serving: Serving = {
      servingId: dailyServingKey(dayId, qIx, uid),
      qIx,
      difficulty: bankQ.difficulty,
      timeLimitMs,
      text: shuffled.text,
      answers: shuffled.answers,
    };

    // Rules deny all client access to servingsPrivate. Stores the answer key plus
    // the exact public payload so a resume returns the identical shuffle without
    // resetting the scoring clock (anti-cheat parity with duel servings).
    batch.set(db.doc(`servingsPrivate/${serving.servingId}`), {
      correctIx: shuffled.correctIx,
      questionId: bankQ.id,
      servedAt: now,
      answeredAt: null,
      uid,
      dayId,
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

// Rebuild a player's already-served daily from servingsPrivate (idempotent
// startDaily resume). Returns null if the player has not been served this day.
export async function loadServedDaily(
  db: Firestore,
  opts: { dayId: string; uid: string; count: number },
): Promise<Serving[] | null> {
  const { dayId, uid, count } = opts;
  const refs = Array.from({ length: count }, (_, qIx) =>
    db.doc(`servingsPrivate/${dailyServingKey(dayId, qIx, uid)}`),
  );
  const snaps = await db.getAll(...refs);
  if (snaps.some((s) => !s.exists)) return null;
  return snaps.map((s) => s.data()!["serving"] as Serving);
}

// Re-export for callers assembling a daily serve from a set's ids.
export { loadQuestions };
