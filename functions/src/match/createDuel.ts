import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { CreateDuelRequestSchema, type CategoryMode } from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import type { MatchDoc } from "./types.js";
import { matchListEntryFor, matchListPath } from "./matchList.js";

// Build a fresh active async-duel doc. `players[0]` is the challenger and takes
// the first turn (GDD §4.2). Shared by createDuel and acceptRematch.
export function buildDuelMatch(opts: {
  challenger: string;
  opponent: string;
  categoryMode: CategoryMode;
  language: string;
  now: Timestamp;
}): MatchDoc {
  const { challenger, opponent, categoryMode, language, now } = opts;
  return {
    mode: "async_duel",
    categoryMode,
    players: [challenger, opponent],
    state: "active",
    roundWins: { [challenger]: 0, [opponent]: 0 },
    currentRound: 0,
    turnUid: challenger,
    language,
    isStrangerMatch: false,
    usedCategories: [],
    result: null,
    createdAt: now,
    finishedAt: null,
  };
}

// Persist a new match and seed both players' home-screen projections in one batch.
export async function persistNewMatch(
  db: FirebaseFirestore.Firestore,
  matchId: string,
  match: MatchDoc,
  now: Timestamp,
): Promise<void> {
  const batch = db.batch();
  batch.set(db.doc(`matches/${matchId}`), match);
  for (const p of match.players) {
    batch.set(
      db.doc(matchListPath(p, matchId)),
      matchListEntryFor(matchId, match, p, now),
    );
  }
  await batch.commit();
}

export const v1_createDuel = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = CreateDuelRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const { opponentUid, categoryMode } = parsed.data;

  if (opponentUid === uid) {
    throw new HttpsError("invalid-argument", "Cannot duel yourself", {
      reason: "invalid-argument",
      field: "opponentUid",
    });
  }

  // Phase 3 boundary: friendship validation, concurrency caps (GDD §4.6) and the
  // same-language rule (GDD §4.7) are deferred to Phase 4/8. All writes here are
  // function-side (guardrail #1); clients only ever read these docs.
  const db = getFirestore();
  const now = Timestamp.now();
  const matchId = db.collection("matches").doc().id;

  const match = buildDuelMatch({
    challenger: uid,
    opponent: opponentUid,
    categoryMode,
    language: "he", // Phase 6 language switch fills this from the user profile
    now,
  });

  await persistNewMatch(db, matchId, match, now);
  return { matchId };
});
