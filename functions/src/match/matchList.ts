import type { Timestamp } from "firebase-admin/firestore";
import type { MatchDoc, MatchListEntry } from "./types.js";

// Home-screen projection paths (doc 08 §1). Owner-readable only.
export function matchListCollectionPath(uid: string): string {
  return `users/${uid}/matchList`;
}
export function matchListPath(uid: string, matchId: string): string {
  return `${matchListCollectionPath(uid)}/${matchId}`;
}

// Build one player's matchList card from the canonical match doc. Written for
// BOTH players on every match event so the home screen listens to a single
// projection per user (doc 06 §10) instead of the match doc directly.
export function matchListEntryFor(
  matchId: string,
  match: MatchDoc,
  uid: string,
  lastEventAt: Timestamp,
): MatchListEntry {
  const opponentUid = match.players.find((p) => p !== uid) ?? uid;
  return {
    matchId,
    opponentUid,
    state: match.state,
    yourTurn: match.turnUid === uid,
    roundWins: match.roundWins,
    currentRound: match.currentRound,
    categoryMode: match.categoryMode,
    result: match.result,
    lastEventAt,
  };
}
