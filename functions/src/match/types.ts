import type { Timestamp } from "firebase-admin/firestore";
import type { CategoryMode, Difficulty, RecapPlayer } from "@trivia/api-contract";

// Firestore document shapes for the duel engine (doc 08 §2). These carry
// Timestamps and so live here rather than in @trivia/api-contract (which stays
// firebase-free for Dart codegen). The JSON-serializable projections returned to
// clients (RoundResult, MatchResult, RecapPlayer) are defined in the contract.

export type MatchState =
  | "pending"
  | "active"
  | "finished"
  | "forfeited"
  | "cancelled";

export type MatchReason = "rounds" | "tiebreak" | "forfeit" | "opponent_deleted";

export interface MatchResultDoc {
  winner: string;
  reason: MatchReason;
  finalScore: Record<string, number>; // uid -> rounds won
  // Weekly points granted at resolution, per uid (GDD §7). Audit trail + a
  // defensive double-grant guard (a re-resolve sees result already set).
  weeklyPointsAwarded?: Record<string, number>;
}

// matches/{matchId} — participant-readable (carries no unanswered-answer data).
export interface MatchDoc {
  mode: "async_duel";
  categoryMode: CategoryMode;
  players: [string, string]; // [challenger, opponent] — immutable
  state: MatchState;
  roundWins: Record<string, number>;
  // Per-player running total of the scores of rounds they WON (GDD §7 weekly
  // "match score" = winning rounds only). The loser of a round adds nothing.
  scoreTotals: Record<string, number>;
  currentRound: number; // 0-based index of the round in play
  turnUid: string | null; // whose turn; null once finished
  // 36h auto-forfeit target (GDD §4.4). Re-stamped on every turn flip; null once
  // the match is finished/forfeited. The forfeit sweep queries state+turnDeadline.
  turnDeadline: Timestamp | null;
  language: string;
  isStrangerMatch: boolean;
  usedCategories: string[]; // auto-mode no-repeat (Phase 4)
  result: MatchResultDoc | null;
  createdAt: Timestamp;
  finishedAt: Timestamp | null;
}

export interface RoundAnswer {
  qIx: number;
  answerIx: number | null; // null = explicit/served timeout
  correct: boolean;
  points: number;
  ms: number; // server-measured elapsed
}

export interface RoundPlayerState {
  done: boolean;
  score: number;
  totalMs: number;
  answers: RoundAnswer[];
}

// matches/{matchId}/rounds/{roundIx} — FUNCTION-ONLY (rules deny all client
// access). Holds locked question refs and both players' live answers, so it must
// never be exposed; the reveal goes through the recaps subcollection instead.
export interface RoundDoc {
  category: string; // "" while a pick-mode offer is pending (questions unlocked)
  questionIds: string[]; // locked when the starter serves the round; [] pre-pick
  difficulties: Difficulty[]; // parallel to questionIds (1E/1M/1H)
  starterUid: string; // players[roundIx % 2]
  perPlayer: Record<string, RoundPlayerState>;
  winner: string | "shared" | null;
  isTiebreaker: boolean;
  // pick mode (GDD §4.3): the 3 categories offered to the starter, locked on the
  // first startRound call so the choice can't be rerolled. null in spin/auto.
  offeredCategories: string[] | null;
  // Replay attempt counter (GDD §4.5). 0 = original deal; bumped each time an
  // exact points-and-time tie forces a fresh re-deal at the same roundIx. Folded
  // into the serving key so a replay's servings don't collide with prior attempts.
  attempt: number;
  // Set true by the resolver on an exact tie; the next startRound by the starter
  // re-deals fresh questions and clears it (the picks happen outside the resolve
  // transaction, so resolution only flags the intent).
  needsReplay: boolean;
}

// matches/{matchId}/recaps/{roundIx} — participant-readable, written only once
// BOTH players finish the round (doc 08 §2 reveal rule). This is the comparison
// both players see.
export interface RecapDoc {
  roundIx: number;
  category: string;
  winner: string | "shared";
  players: RecapPlayer[];
  revealedAt: Timestamp;
}

// users/{uid}/matchList/{matchId} — owner-readable home-screen card projection.
// Opponent name/avatar are filled once profiles exist (Phase 8); for now the
// client resolves display from opponentUid.
export interface MatchListEntry {
  matchId: string;
  opponentUid: string;
  state: MatchState;
  yourTurn: boolean;
  roundWins: Record<string, number>;
  currentRound: number;
  categoryMode: CategoryMode;
  result: MatchResultDoc | null;
  lastEventAt: Timestamp;
}
