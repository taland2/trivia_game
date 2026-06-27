import type { Firestore } from "firebase-admin/firestore";
import type { Serving } from "@trivia/api-contract";
import type { BankQuestion } from "./questionBank.js";
import { servePlayerQuestions, loadServedQuestions } from "./serving.js";

// Per-player serving key: questions are locked per round but the answer order is
// shuffled independently per player (GDD §3.1), so each player gets their own
// servingsPrivate docs. This is also the anti-cheat boundary — `correctIx` lives
// here (function-only) and never reaches the client (guardrail #2).
//
// `attempt` (GDD §4.5 tie replay) is 0 for the original deal — kept suffix-free so
// the key matches the Phase-3 format — and `_r{n}` for the nth re-deal at the same
// roundIx, so a replay's servings never collide with the tied attempt's docs.
export function servingKey(
  matchId: string,
  roundIx: number,
  qIx: number,
  uid: string,
  attempt = 0,
): string {
  const suffix = attempt > 0 ? `_r${attempt}` : "";
  return `${matchId}_${roundIx}_${qIx}_${uid}${suffix}`;
}

// Serve a round's 3 questions to one player (1E/1M/1H in serve order). Thin
// wrapper over the shared serving machinery — keys by servingKey and stamps the
// match/round context. Must NOT be called when servings already exist; startRound
// guards that (loadServedRound) to keep `servedAt` (the scoring clock) stable.
export async function serveRoundForPlayer(
  db: Firestore,
  opts: {
    matchId: string;
    roundIx: number;
    uid: string;
    questions: BankQuestion[];
    attempt?: number;
  },
): Promise<Serving[]> {
  const { matchId, roundIx, uid, questions, attempt = 0 } = opts;
  return servePlayerQuestions(db, {
    uid,
    questions,
    servingIdFor: (qIx) => servingKey(matchId, roundIx, qIx, uid, attempt),
    context: { matchId, roundIx },
  });
}

// Rebuild a player's already-served round from servingsPrivate (idempotent
// startRound replay). Returns null if the player has not been served this round.
export async function loadServedRound(
  db: Firestore,
  opts: {
    matchId: string;
    roundIx: number;
    uid: string;
    count: number;
    attempt?: number;
  },
): Promise<Serving[] | null> {
  const { matchId, roundIx, uid, count, attempt = 0 } = opts;
  return loadServedQuestions(db, {
    servingIdFor: (qIx) => servingKey(matchId, roundIx, qIx, uid, attempt),
    count,
  });
}
