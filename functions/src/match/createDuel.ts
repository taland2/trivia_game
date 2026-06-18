import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { CreateDuelRequestSchema, type CategoryMode } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { loadUserLanguage } from "../user/profile.js";
import { deadlineFrom } from "./turn.js";
import type { MatchDoc, MatchListEntry } from "./types.js";
import {
  matchListCollectionPath,
  matchListEntryFor,
  matchListPath,
} from "./matchList.js";

// Build a fresh active async-duel doc. `players[0]` is the challenger and takes
// the first turn (GDD §4.2). Shared by createDuel, acceptRematch, and the
// stranger queue (which sets isStrangerMatch). The first turn's deadline is
// stamped here (GDD §4.4).
export function buildDuelMatch(opts: {
  challenger: string;
  opponent: string;
  categoryMode: CategoryMode;
  language: string;
  now: Timestamp;
  isStrangerMatch?: boolean;
}): MatchDoc {
  const { challenger, opponent, categoryMode, language, now } = opts;
  return {
    mode: "async_duel",
    categoryMode,
    players: [challenger, opponent],
    state: "active",
    roundWins: { [challenger]: 0, [opponent]: 0 },
    scoreTotals: { [challenger]: 0, [opponent]: 0 },
    currentRound: 0,
    turnUid: challenger,
    turnDeadline: deadlineFrom(now, getBalance()),
    language,
    isStrangerMatch: opts.isStrangerMatch ?? false,
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

  // All writes here are function-side (guardrail #1); clients only ever read
  // these docs. Friendship validation + the block rule land with the social
  // graph in Phase 8; this phase enforces the same-language rule (GDD §4.7) and
  // the concurrency caps (GDD §4.6).
  const db = getFirestore();
  const balance = getBalance();

  // Same-language rule (GDD §4.7): both players must share an app language; the
  // match locks that language for its lifetime. A missing opponent profile is a
  // not-found user; differing languages are a clear, recoverable precondition.
  const [myLang, oppLang] = await Promise.all([
    loadUserLanguage(db, uid),
    loadUserLanguage(db, opponentUid),
  ]);
  if (myLang === null) {
    throw new HttpsError("failed-precondition", "Set your language first", {
      reason: "language-mismatch",
    });
  }
  if (oppLang === null) {
    throw new HttpsError("not-found", "Opponent not found", { reason: "user" });
  }
  if (myLang !== oppLang) {
    throw new HttpsError("failed-precondition", "Different app languages", {
      reason: "language-mismatch",
    });
  }

  // Concurrency caps (GDD §4.6). One single-field query over the caller's home
  // projection (active duels are ⚖️ ≤ 20, so the read is tiny) covers both the
  // global cap and the per-opponent cap — no composite index needed.
  const activeSnap = await db
    .collection(matchListCollectionPath(uid))
    .where("state", "==", "active")
    .get();
  const active = activeSnap.docs.map((d) => d.data() as MatchListEntry);
  if (active.length >= balance.concurrency.maxActiveDuels) {
    throw new HttpsError("resource-exhausted", "Too many active duels", {
      reason: "max-active-duels",
    });
  }
  if (
    active.filter((e) => e.opponentUid === opponentUid).length >=
    balance.concurrency.maxDuelsPerOpponent
  ) {
    throw new HttpsError("resource-exhausted", "Too many duels with this player", {
      reason: "max-duels-with-friend",
    });
  }

  const now = Timestamp.now();
  const matchId = db.collection("matches").doc().id;

  const match = buildDuelMatch({
    challenger: uid,
    opponent: opponentUid,
    categoryMode,
    language: myLang, // locked at creation (GDD §4.7)
    now,
  });

  await persistNewMatch(db, matchId, match, now);
  return { matchId };
});
