import type { Firestore } from "firebase-admin/firestore";
import type { Serving } from "@trivia/api-contract";
import { loadQuestions, type BankQuestion } from "../serve/questionBank.js";
import { servePlayerQuestions, loadServedQuestions } from "../serve/serving.js";

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

// Serve a daily set's questions to one player (set order). Thin wrapper over the
// shared serving machinery — keys by dailyServingKey and stamps the dayId context.
// Must NOT be called when servings already exist; startDaily guards that
// (loadServedDaily) to keep `servedAt` (the scoring clock) stable.
export async function serveDailyForPlayer(
  db: Firestore,
  opts: { dayId: string; uid: string; questions: BankQuestion[] },
): Promise<Serving[]> {
  const { dayId, uid, questions } = opts;
  return servePlayerQuestions(db, {
    uid,
    questions,
    servingIdFor: (qIx) => dailyServingKey(dayId, qIx, uid),
    context: { dayId },
  });
}

// Rebuild a player's already-served daily from servingsPrivate (idempotent
// startDaily resume). Returns null if the player has not been served this day.
export async function loadServedDaily(
  db: Firestore,
  opts: { dayId: string; uid: string; count: number },
): Promise<Serving[] | null> {
  const { dayId, uid, count } = opts;
  return loadServedQuestions(db, {
    servingIdFor: (qIx) => dailyServingKey(dayId, qIx, uid),
    count,
  });
}

// Re-export for callers assembling a daily serve from a set's ids.
export { loadQuestions };
