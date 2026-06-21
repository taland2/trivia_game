import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { CreateDuelRequestSchema, type CategoryMode } from "@trivia/api-contract";
import { getBalance, type Balance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { loadUserLanguage } from "../user/profile.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import { deadlineFrom } from "./turn.js";
import type { MatchDoc, MatchListEntry } from "./types.js";
import {
  matchListCollectionPath,
  writeMatchTx,
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

// Concurrency caps (GDD §4.6) against the caller's active matchList. One
// single-field query (active duels are ⚖️ ≤ 20, so the read is tiny) covers both
// the global cap and the per-opponent cap — no composite index needed. Read
// inside a transaction so concurrent creates can't both pass the cap (M1).
export async function readActiveDuels(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<MatchListEntry[]> {
  const snap = await tx.get(
    db.collection(matchListCollectionPath(uid)).where("state", "==", "active"),
  );
  return snap.docs.map((d) => d.data() as MatchListEntry);
}

export function enforceActiveCaps(
  active: MatchListEntry[],
  opponentUid: string,
  balance: Balance,
): void {
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
  const { opponentUid, categoryMode, idempotencyKey } = parsed.data;

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
  // match locks that language for its lifetime. Read-only precondition — a
  // missing opponent profile is a not-found user; differing languages are a
  // clear, recoverable precondition. Safe to read before the transaction.
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

  const now = Timestamp.now();
  // Generated before the transaction so a replay returns the cached matchId and
  // this freshly-minted id is simply discarded.
  const matchId = db.collection("matches").doc().id;
  const iref = idempRef(db, uid, idempotencyKey);

  // One transaction: replay guard → cap check → persist. Putting the cap query
  // inside the txn closes the check-then-create race (M1); the idempotency
  // record makes a double-tap a no-op replay (H2).
  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotent<{ matchId: string }>(tx, iref);
    if (cached !== null) return cached;

    const active = await readActiveDuels(tx, db, uid);
    enforceActiveCaps(active, opponentUid, balance);

    const match = buildDuelMatch({
      challenger: uid,
      opponent: opponentUid,
      categoryMode,
      language: myLang, // locked at creation (GDD §4.7)
      now,
    });

    writeMatchTx(tx, db, matchId, match, now);
    const res = { matchId };
    writeIdempotent(tx, iref, res, now);
    return res;
  });

  return result;
});
